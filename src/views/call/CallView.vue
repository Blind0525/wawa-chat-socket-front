<template>
  <!-- 音视频通话页(独立页面,App 端经 web-view 加载;微信/浏览器也可直接打开) -->
  <div class="call-overlay">

    <!-- 来电 -->
    <template v-if="callState === 'ringing'">
      <div class="call-avatar">{{ callType === 'video' ? '📹' : '📞' }}</div>
      <div class="call-title">顾客来电</div>
      <div class="call-subtitle">{{ callType === 'video' ? '视频通话' : '语音通话' }}</div>
      <div class="call-btns">
        <button class="call-btn call-decline" @click="rejectCall">拒 绝</button>
        <button class="call-btn call-accept" @click="acceptCall">接 听</button>
      </div>
    </template>

    <!-- 呼叫中 -->
    <template v-else-if="callState === 'calling'">
      <div class="call-avatar">{{ callType === 'video' ? '📹' : '📞' }}</div>
      <div class="call-title">正在呼叫...</div>
      <div class="call-subtitle">{{ callType === 'video' ? '视频通话' : '语音通话' }}</div>
      <div class="call-btns">
        <button class="call-btn call-hangup" @click="hangUpCall">取 消</button>
      </div>
    </template>

    <!-- 通话中 -->
    <template v-else-if="callState === 'incall'">
      <div class="call-videos" :class="{ 'call-pip-swapped': pipSwapped }">
        <div id="remote-video" class="call-remote" @click="swapPip" @touchend.prevent="swapPip"></div>
        <div id="local-video" v-if="callType === 'video'" class="call-local" @click="swapPip" @touchend.prevent="swapPip">
          <!-- 静态 video:安卓微信X5对动态创建的video渲染MediaStream不稳定 -->
          <video autoplay muted playsinline webkit-playsinline x5-playsinline x5-video-player-type="h5" class="local-video-el"></video>
          <!-- 本地渲染失败时的占位(摄像头工作正常,仅X5无法本地预览) -->
          <div class="local-placeholder">📷 摄像头已开启</div>
        </div>
      </div>
      <div class="call-timer">{{ callTimer }}</div>
      <div class="call-btns">
        <template v-if="callType === 'video'">
          <button class="call-btn call-ctrl" @click="switchCamera">翻转</button>
          <button class="call-btn call-ctrl" @click="toggleCamera">{{ cameraOn ? '关摄像头' : '开摄像头' }}</button>
        </template>
        <button class="call-btn call-hangup" @click="hangUpCall">挂 断</button>
      </div>
    </template>

    <!-- 通话结束/失败 -->
    <template v-else-if="callState === 'ended'">
      <div class="call-avatar">{{ callType === 'video' ? '📹' : '📞' }}</div>
      <div class="call-title">{{ endText }}</div>
      <div v-if="callTimer !== '00:00'" class="call-subtitle">通话时长 {{ callTimer }}</div>
      <div class="call-btns">
        <button class="call-btn call-hangup" @click="closePage">关 闭</button>
      </div>
    </template>
  </div>
</template>

<script>
import { ChatSocket } from '@/utils/ws'

// STUN 用于 NAT 打洞;若打洞失败(复杂网络),在 iceServers 里加自建 TURN:
// { urls: 'turn:your-turn-server:3478', username: 'user', credential: 'pass' }
const RTC_CONFIG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }

/**
 * 独立通话页:从 AgentChat.vue 抽出(原生 WebRTC + ws 信令)
 * URL 参数:
 *   sessionId 会话ID  peerId 对端imUserId  token 客服JWT  name 对端名称
 *   type video|audio  mode outgoing(主叫)|incoming(被叫)  auto 1=收到invite自动接听
 * 信令流:
 *   - 主叫:连接ws后自动 invite(带sdp) -> 等 accept(带answer) -> incall
 *   - 被叫:等 invite(实时或后端补发) -> auto=1 自动接听 / 否则响铃人工接听
 */
export default {
  name: 'CallView',
  data() {
    return {
      callState: 'idle',     // idle | calling | ringing | incall | ended
      callType: 'video',
      callTimer: '00:00',
      endText: '通话已结束',
      cameraOn: true,
      pipSwapped: false,
      wsConnected: false,
    }
  },
  mounted() {
    this.init()
  },
  beforeUnmount() {
    this.endCall()
    if (this.ws) { this.ws.close(); this.ws = null }
  },
  methods: {
    init() {
      const params = new URLSearchParams(window.location.search)
      this.sessionId = Number(params.get('sessionId')) || null
      this.peerUserId = params.get('peerId') || null
      this.token = params.get('token') || ''
      this.customerName = params.get('name') || ''
      this.callType = params.get('type') || 'video'
      this.mode = params.get('mode') || 'outgoing'
      this.autoAccept = params.get('auto') === '1'

      if (!this.peerUserId || !this.token) {
        this.endText = '参数缺失,无法通话'
        this.callState = 'ended'
        return
      }

      // 连接 ws(信令通道)
      this.ws = new ChatSocket({
        token: this.token,
        onConnected: () => {
          this.wsConnected = true
          // 主叫:连接成功后自动发起通话
          if (this.mode === 'outgoing') {
            this.startCall(this.callType)
          }
          // 被叫:等 invite(实时到达或后端补发)
        },
        onCall: (payload) => this.handleCallMessage(payload),
        onMsg: () => {},
        onAck: () => {},
        onError: (msg) => { console.log('信令连接错误:', msg) },
        onClose: () => { this.wsConnected = false },
      })
      this.ws.connect()
    },

    // ===== 信令处理 =====
    handleCallMessage(payload) {
      if (!payload || payload.type !== 'call') return
      const action = payload.action
      switch (action) {
        case 'invite':
          // 来电(实时或后端补发)
          this.callType = payload.callType || this.callType
          this.pendingOffer = payload
          if (this.autoAccept) {
            this.acceptCall()
          } else {
            this.callState = 'ringing'
          }
          break
        case 'accept':
          if (this.callState === 'calling' && payload.sdp && this.pc) {
            try {
              this.pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
            } catch (e) {
              console.error('setRemoteDescription(accept) 失败', e)
            }
            this.callState = 'incall'
            this.startCallTimer()
          }
          break
        case 'reject':
          if (this.callState === 'calling') {
            this.endText = '对方拒绝了通话'
            this.callState = 'ended'
            this.endCall()
          }
          break
        case 'candidate':
          if (this.pc && payload.candidate) {
            this.pc.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(e => console.error('addIceCandidate 失败', e))
          }
          break
        case 'hangup':
          if (this.callState === 'incall' || this.callState === 'ringing' || this.callState === 'calling') {
            this.endText = '对方已挂断'
            this.endCall()
            this.callState = 'ended'
          }
          break
      }
    },

    // ===== WebRTC =====
    createPeer() {
      this.pc = new RTCPeerConnection(RTC_CONFIG)

      this.pc.onicecandidate = (e) => {
        if (e.candidate && this.peerUserId) {
          this.wsSend({ type: 'call', action: 'candidate', to: this.peerUserId, sessionId: this.sessionId, candidate: e.candidate })
        }
      }

      this.pc.ontrack = (e) => {
        const remoteStream = e.streams[0]
        if (!remoteStream) return
        const container = document.getElementById('remote-video')
        if (!container) return
        container.innerHTML = ''
        const v = document.createElement('video')
        v.autoplay = true
        v.playsInline = true
        v.muted = false
        v.setAttribute('playsinline', '')
        v.style.width = '100%'
        v.style.height = '100%'
        v.style.pointerEvents = 'none'
        try {
          if ('srcObject' in v) {
            v.srcObject = remoteStream
          } else {
            v.src = URL.createObjectURL(remoteStream)
          }
        } catch (e) {
          v.src = URL.createObjectURL(remoteStream)
        }
        container.appendChild(v)
        // 自动播放可能被无手势策略拦截(web-view 页面),失败时提示点击启用声音
        const tryPlay = () => {
          const p = v.play()
          if (p && p.catch) {
            p.catch(() => {
              container.classList.add('need-gesture')
            })
          } else {
            container.classList.remove('need-gesture')
          }
        }
        v.onloadedmetadata = tryPlay
        setTimeout(tryPlay, 100)
        setTimeout(tryPlay, 500)
        container.addEventListener('click', () => {
          tryPlay()
          container.classList.remove('need-gesture')
        })
        container.addEventListener('touchend', () => {
          tryPlay()
          container.classList.remove('need-gesture')
        })
      }

      this.pc.onconnectionstatechange = () => {
        if (!this.pc) return
        const st = this.pc.connectionState
        if (st === 'failed') {
          this.endText = '连接已断开'
          this.endCall()
          this.callState = 'ended'
        } else if (st === 'disconnected') {
          // 网络抖动:给 8 秒恢复窗口,避免误挂断
          if (!this.recoverTimer) {
            this.recoverTimer = setTimeout(() => {
              if (this.pc && this.pc.connectionState === 'disconnected') {
                this.endText = '连接已断开'
                this.endCall()
                this.callState = 'ended'
              }
              this.recoverTimer = null
            }, 8000)
          }
        } else if (st === 'connected') {
          if (this.recoverTimer) { clearTimeout(this.recoverTimer); this.recoverTimer = null }
        }
      }
      return this.pc
    },

    /** 获取通话媒体流:音频单独 getUserMedia,视频通话再单独取摄像头 addTrack(微信兼容方案) */
    async getCallMedia() {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      this.extraMediaStreams.push(stream)
      let videoStream = null
      if (this.callType === 'video') {
        try {
          videoStream = await navigator.mediaDevices.getUserMedia({ video: true })
          this.extraMediaStreams.push(videoStream)
          videoStream.getVideoTracks().forEach(t => stream.addTrack(t))
        } catch (e) {
          console.error('摄像头获取失败', e)
          alert('无法访问摄像头,请检查摄像头权限: ' + (e && e.message || '未知错误'))
          throw e
        }
      }
      return { stream, videoStream }
    },

    /** 本地视频预览(回退到当初能正常显示的方案:混合流srcObject + 动态video) */
    showLocalPreview(stream) {
      const container = document.getElementById('local-video')
      if (!container) return
      container.innerHTML = ''
      const v = document.createElement('video')
      v.autoplay = true
      v.playsInline = true
      v.muted = true
      v.setAttribute('muted', '')
      v.setAttribute('playsinline', '')
      v.setAttribute('webkit-playsinline', '')
      v.style.width = '100%'
      v.style.height = '100%'
      v.style.objectFit = 'cover'
      v.style.pointerEvents = 'none'
      v.srcObject = stream
      container.appendChild(v)
      const doPlay = () => { v.play().catch(() => { /* ignore */ }) }
      v.onloadedmetadata = doPlay
      setTimeout(doPlay, 100)
      // 兜底:800ms 后仍无画面则显示占位
      setTimeout(() => {
        if (v.videoWidth === 0) {
          const ph = container.querySelector('.local-placeholder')
          if (ph) ph.classList.add('show')
        }
      }, 800)
    },

    /** 点击画面:本地小窗 <-> 远端大画面互换 */
    swapPip() {
      this.pipSwapped = !this.pipSwapped
      const remote = document.getElementById('remote-video')
      const local = document.getElementById('local-video')
      if (!remote || !local) return
      if (this.pipSwapped) {
        remote.style.cssText = 'position:absolute;top:16px;right:16px;width:110px;height:150px;border-radius:10px;overflow:hidden;background:#000;border:1px solid rgba(255,255,255,.3);box-shadow:0 4px 16px rgba(0,0,0,.4);z-index:2'
        const rv = remote.querySelector('video')
        if (rv) rv.style.objectFit = 'cover'
        local.style.cssText = 'width:100%;height:100%;border:none;border-radius:0;box-shadow:none;z-index:1'
        const lv = local.querySelector('video')
        if (lv) lv.style.objectFit = 'contain'
      } else {
        remote.style.cssText = ''
        local.style.cssText = ''
      }
    },

    // ===== 通话流程 =====
    async startCall(type) {
      if (!this.wsConnected || !this.peerUserId || this.callState !== 'idle') return
      this.callType = type
      this.callState = 'calling'
      this.startCallTimer()
      try {
        this.createPeer()
        const media = await this.getCallMedia()
        this.localStream = media.stream
        // 先 addTrack 发送,再渲染本地预览(当初客服端能正常显示的时序)
        this.localStream.getTracks().forEach(t => this.pc.addTrack(t, this.localStream))
        if (this.callType === 'video') this.showLocalPreview(this.localStream)

        const offer = await this.pc.createOffer()
        await this.pc.setLocalDescription(offer)
        this.wsSend({ type: 'call', action: 'invite', to: this.peerUserId, sessionId: this.sessionId, callType: type, sdp: this.pc.localDescription })
      } catch (e) {
        console.error('发起通话失败', e)
        alert('通话建立失败: ' + (e.message || e))
        this.endText = '通话建立失败'
        this.endCall()
        this.callState = 'ended'
      }
    },

    async acceptCall() {
      this.callState = 'incall'
      this.startCallTimer()
      try {
        this.createPeer()
        const media = await this.getCallMedia()
        this.localStream = media.stream
        this.localStream.getTracks().forEach(t => this.pc.addTrack(t, this.localStream))
        if (this.callType === 'video') this.showLocalPreview(this.localStream)

        if (this.pendingOffer && this.pendingOffer.sdp) {
          await this.pc.setRemoteDescription(new RTCSessionDescription(this.pendingOffer.sdp))
        }
        const answer = await this.pc.createAnswer()
        await this.pc.setLocalDescription(answer)
        this.wsSend({ type: 'call', action: 'accept', to: this.pendingOffer.from || this.peerUserId, sessionId: this.sessionId, sdp: this.pc.localDescription })
      } catch (e) {
        console.error('接听失败', e)
        alert('接听失败: ' + (e.message || e))
        this.endText = '接听失败'
        this.endCall()
        this.callState = 'ended'
      }
    },

    rejectCall() {
      this.wsSend({ type: 'call', action: 'reject', to: this.pendingOffer.from || this.peerUserId, sessionId: this.sessionId })
      this.endText = '已拒绝通话'
      this.endCall()
      this.callState = 'ended'
    },

    hangUpCall() {
      this.wsSend({ type: 'call', action: 'hangup', to: this.peerUserId, sessionId: this.sessionId, duration: this.callTimer })
      this.endText = '通话已结束'
      this.endCall()
      this.callState = 'ended'
    },

    /** 翻转摄像头(前置/后置切换),通话中实时生效 */
    async switchCamera() {
      if (this.callType !== 'video' || !this.localStream) return
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const cams = devices.filter(d => d.kind === 'videoinput')
        if (cams.length < 2) {
          alert('未检测到其他摄像头,无法翻转')
          return
        }
        const curTrack = this.localStream.getVideoTracks()[0]
        const curDeviceId = (curTrack && curTrack.getSettings && curTrack.getSettings().deviceId) || ''
        const next = cams.find(c => c.deviceId && c.deviceId !== curDeviceId) || cams[0]

        let vs = null
        try {
          vs = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: next.deviceId } } })
        } catch (e1) {
          console.log('deviceId 精确切换失败,回退默认摄像头', e1.name)
          vs = await navigator.mediaDevices.getUserMedia({ video: true })
        }
        const newTrack = vs.getVideoTracks()[0]
        if (!newTrack) throw new Error('未获取到摄像头')

        const oldTracks = this.localStream.getVideoTracks()
        oldTracks.forEach(t => {
          this.localStream.removeTrack(t)
          t.stop()
        })
        this.localStream.addTrack(newTrack)
        if (this.pc) {
          const sender = this.pc.getSenders().find(s => s.track && s.track.kind === 'video')
          if (sender) await sender.replaceTrack(newTrack)
        }
        this.showLocalPreview(this.localStream)
      } catch (e) {
        console.error('切换摄像头失败', e)
        alert('切换摄像头失败: ' + (e.message || e))
      }
    },

    /** 关闭/开启摄像头画面 */
    toggleCamera() {
      if (!this.localStream) return
      const tracks = this.localStream.getVideoTracks()
      if (tracks.length === 0) return
      this.cameraOn = !this.cameraOn
      tracks.forEach(t => { t.enabled = this.cameraOn })
    },

    /** 结束通话(清理 RTCPeerConnection + 媒体流) */
    endCall() {
      this.stopCallTimer()
      if (this.recoverTimer) { clearTimeout(this.recoverTimer); this.recoverTimer = null }
      this.pendingOffer = null
      this.cameraOn = true
      this.pipSwapped = false
      if (this.localStream) {
        try { this.localStream.getTracks().forEach(t => t.stop()) } catch (e) { /* ignore */ }
        this.localStream = null
      }
      if (this.extraMediaStreams && this.extraMediaStreams.length > 0) {
        this.extraMediaStreams.forEach(s => { try { s.getTracks().forEach(t => t.stop()) } catch (e) { /* ignore */ } })
        this.extraMediaStreams = []
      }
      if (this.pc) {
        try {
          this.pc.ontrack = null
          this.pc.onicecandidate = null
          this.pc.close()
        } catch (e) { /* ignore */ }
        this.pc = null
      }
      ;['remote-video', 'local-video'].forEach(id => {
        const el = document.getElementById(id)
        if (el) el.innerHTML = ''
      })
    },

    // ===== 工具 =====
    wsSend(obj) {
      if (this.ws) this.ws.send(obj)
    },
    startCallTimer() {
      this.stopCallTimer()
      this.callSeconds = 0
      this.callTimer = '00:00'
      this.callTimerInterval = setInterval(() => {
        this.callSeconds++
        const m = String(Math.floor(this.callSeconds / 60)).padStart(2, '0')
        const s = String(this.callSeconds % 60).padStart(2, '0')
        this.callTimer = m + ':' + s
      }, 1000)
    },
    stopCallTimer() {
      if (this.callTimerInterval) {
        clearInterval(this.callTimerInterval)
        this.callTimerInterval = null
      }
    },
    /** 关闭页面:App 内由外层 web-view 的返回按钮处理;浏览器里直接返回历史 */
    closePage() {
      if (window.history.length > 1) {
        window.history.back()
      } else {
        window.location.href = '/socket2/login'
      }
    },
  },
}
</script>

<style scoped>
.call-overlay {
  position: fixed; inset: 0; z-index: 999;
  background: #000;
  color: #fff;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif;
}
.call-avatar {
  width: 84px; height: 84px; border-radius: 50%;
  background: rgba(255,255,255,0.12);
  display: flex; align-items: center; justify-content: center;
  font-size: 38px;
  margin-bottom: 20px;
}
.call-title { font-size: 20px; font-weight: 600; margin-bottom: 8px; }
.call-subtitle { font-size: 14px; color: rgba(255,255,255,0.7); margin-bottom: 40px; }

.call-videos {
  position: fixed; inset: 0;
  background: #000;
}
.call-remote {
  position: absolute; inset: 0;
  background: #000;
}
.call-remote.need-gesture::after {
  content: '点击画面启用声音';
  position: absolute; left: 0; right: 0; bottom: 30%;
  text-align: center;
  color: #fff;
  font-size: 14px;
  background: rgba(0,0,0,0.4);
  padding: 8px 0;
}
.call-local {
  position: absolute; top: 16px; right: 16px;
  width: 110px; height: 150px;
  border-radius: 10px; overflow: hidden;
  background: #000;
  border: 1px solid rgba(255,255,255,0.3);
  box-shadow: 0 4px 16px rgba(0,0,0,0.4);
  z-index: 2;
}
.local-video-el {
  width: 100%; height: 100%;
  object-fit: cover;
  pointer-events: none;
}
.local-placeholder {
  position: absolute; inset: 0;
  display: none;
  align-items: center; justify-content: center;
  font-size: 13px; color: rgba(255,255,255,0.85);
  background: #1a1a1a;
}
.local-placeholder.show { display: flex; }

.call-timer {
  position: fixed; top: 24px; left: 0; right: 0;
  text-align: center;
  font-size: 15px; color: rgba(255,255,255,0.9);
  z-index: 5;
  text-shadow: 0 1px 4px rgba(0,0,0,0.5);
}
.call-btns {
  position: fixed; bottom: 60px; left: 0; right: 0;
  display: flex; align-items: center; justify-content: center;
  gap: 24px;
  z-index: 5;
}
.call-btn {
  min-width: 76px; height: 44px;
  border: none; border-radius: 22px;
  font-size: 15px; font-weight: 600;
  color: #fff;
  padding: 0 18px;
  cursor: pointer;
}
.call-decline { background: #fa5151; }
.call-accept { background: #07c160; }
.call-hangup { background: #fa5151; }
.call-ctrl { background: rgba(255,255,255,0.18); }
</style>
