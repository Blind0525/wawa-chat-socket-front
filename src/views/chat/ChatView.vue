<template>
  <!-- 加载中 -->
  <div v-if="pageState === 'loading'" class="cs-login">
    <div class="cs-login-card">
      <div class="cs-loading-spinner"></div>
      <p class="cs-login-tip">{{ loadingText }}</p>
    </div>
  </div>

  <!-- 错误提示 -->
  <div v-else-if="pageState === 'error'" class="cs-login">
    <div class="cs-login-card">
      <div class="cs-login-logo">在线客服</div>
      <p class="cs-login-tip">{{ errorText }}</p>
      <button class="cs-login-btn" @click="reload">重新加载</button>
    </div>
  </div>

  <!-- 聊天页 -->
  <div v-else class="cs-overlay">
    <div class="cs-header">
      <button class="cs-back" @click="goBack" aria-label="返回">‹</button>
      <span class="cs-title">{{ agentName || '在线客服' }}</span>
      <span v-if="connecting" class="cs-connecting">连接中...</span>
    </div>
    <div class="cs-body" ref="msgListRef" @scroll="onBodyScroll">
      <div v-for="(msg, i) in chatMsgs" :key="i" class="cs-msg" :class="[msg.mine ? 'cs-msg-right' : 'cs-msg-left', msg.type === 'call' ? 'cs-call-record' : '']">
        <!-- 日期分隔条 -->
        <div v-if="i === 0 || (msg.day || '今天') !== (chatMsgs[i - 1].day || '今天')" class="cs-date-divider">{{ msg.day || '今天' }}</div>
        <!-- 通话记录（气泡样式） -->
        <div v-else-if="msg.type === 'call'" class="cs-bubble cs-call-bubble">
          <span class="cs-call-ico">{{ msg.callType === 'video' ? '📹' : '📞' }}</span>
          <span class="cs-call-text">{{ msg.text }}</span>
          <span v-if="msg.duration && msg.duration !== '00:00'" class="cs-call-dur">{{ msg.duration }}</span>
        </div>
        <template v-else>
          <!-- 头像 -->
          <div class="cs-avatar">{{ msg.mine ? '我' : '客' }}</div>
          <div class="cs-msg-main">
            <!-- 文本消息 -->
            <div v-if="msg.type === 'text'" class="cs-bubble">{{ msg.text }}</div>
            <!-- 图片消息 -->
            <div v-else-if="msg.type === 'image'" class="cs-bubble cs-image-bubble" @click="openPreview('image', msg.url)">
              <img :src="msg.url" class="cs-image-preview" alt="图片" @load="scrollToBottom" />
            </div>
            <!-- 视频消息 -->
            <div v-else-if="msg.type === 'video'" class="cs-bubble cs-video-bubble" @click="openPreview('video', msg.url)">
              <video :src="msg.url" class="cs-video-preview" preload="metadata" @loadedmetadata="scrollToBottom" />
              <div class="cs-play-icon">▶</div>
            </div>
            <!-- 语音消息 -->
            <div v-else-if="msg.type === 'voice'" class="cs-bubble cs-voice-bubble" @click="toggleVoice(msg, $event)">
              <span class="cs-voice-icon">{{ msg.playing ? '⏹' : '▶' }}</span>
              <span v-if="msg.duration" class="cs-voice-duration">{{ msg.duration }}″</span>
              <audio :src="msg.url" preload="none" style="display:none"></audio>
            </div>
            <!-- 文件消息 -->
            <div v-else-if="msg.type === 'file'" class="cs-bubble cs-file-bubble" @click="openUrl(msg.url)">
              <div class="cs-file-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
              </div>
              <div class="cs-file-info">
                <div class="cs-file-name">{{ msg.fileName }}</div>
                <div class="cs-file-size">{{ formatFileSize(msg.fileSize) }}</div>
              </div>
            </div>
            <div v-if="msg.time" class="cs-time">{{ msg.time }}</div>
          </div>
        </template>
      </div>
    </div>
    <div class="cs-input-bar">
      <div class="cs-tools-row">
        <!-- 图片选择 -->
        <input type="file" ref="imageInputRef" accept="image/*" style="display:none" @change="onImageSelected" />
        <button class="cs-tool-btn" @click="pickImage" :disabled="!wsConnected" title="发送图片">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        </button>
        <!-- 视频选择 -->
        <input type="file" ref="videoInputRef" accept="video/*" style="display:none" @change="onVideoSelected" />
        <button class="cs-tool-btn" @click="pickVideo" :disabled="!wsConnected" title="发送视频">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="23 7 16 12 23 17 23 7"/>
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
          </svg>
        </button>
        <!-- 文件选择 -->
        <input type="file" ref="fileInputRef" style="display:none" @change="onFileSelected" />
        <button class="cs-tool-btn" @click="pickFile" :disabled="!wsConnected" title="发送文件">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
        </button>
        <!-- 通话（语音/视频合一） -->
        <button class="cs-tool-btn" @click="showCallMenu = true" :disabled="!wsConnected" title="通话">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
          </svg>
        </button>
      </div>
      <div class="cs-input-row">
        <!-- 话筒：点击切换 输入框/按住说话 模式（微信风格） -->
        <button class="cs-voice-input-btn"
          :class="{ 'cs-active': voiceMode }"
          @click="toggleVoiceMode"
          :disabled="!wsConnected"
          :title="voiceMode ? '切换键盘' : '按住说话'">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        </button>
        <!-- 按住说话按钮（语音模式） -->
        <button v-if="voiceMode" class="cs-press-talk"
          :class="{ 'cs-press-active': isPressing, 'cs-press-cancel': pressCancel }"
          @touchstart.prevent="startPressRecord"
          @mousedown.prevent="startPressRecord"
          @touchmove.prevent="onPressMove"
          @mousemove.prevent="onPressMove"
          @touchend.prevent="endPressRecord"
          @mouseup.prevent="endPressRecord"
          @touchcancel.prevent="endPressRecord"
          :disabled="!wsConnected">
          {{ pressCancel ? '松开手指,取消发送' : (isPressing ? '松开 结束' : '按住 说话') }}
        </button>
        <!-- 键盘输入模式 -->
        <template v-else>
          <input class="cs-input" v-model="chatText" placeholder="输入消息..." @keydown.enter="sendMsg" :disabled="!wsConnected" />
          <button class="cs-send" @click="sendMsg" :disabled="!wsConnected">发送</button>
        </template>
      </div>
    </div>
  </div>

  <!-- 通话类型选择（底部弹出） -->
  <div v-if="showCallMenu" class="cs-call-menu" @click.self="showCallMenu = false">
    <div class="cs-call-menu-box">
      <div class="cs-call-menu-item" @click="chooseCall('audio')">📞 语音通话</div>
      <div class="cs-call-menu-item" @click="chooseCall('video')">📹 视频通话</div>
      <div class="cs-call-menu-cancel" @click="showCallMenu = false">取消</div>
    </div>
  </div>

  <!-- 图片/视频预览弹窗 -->
  <div v-if="preview.show" class="cs-preview-overlay" @click.self="closePreview">
    <button class="cs-preview-close" @click="closePreview">✕</button>
    <img v-if="preview.type === 'image'" :src="preview.url" class="cs-preview-media" @click.self="closePreview" />
    <video v-else-if="preview.type === 'video'" :src="preview.url" class="cs-preview-media" controls autoplay @click.self="closePreview"></video>
  </div>

  <!-- ===== 音视频通话覆盖层 ===== -->
  <div v-if="callState !== 'idle'" class="cs-call-overlay">
    <!-- 来电 -->
    <template v-if="callState === 'ringing'">
      <div class="cs-call-avatar">{{ callType === 'video' ? '📹' : '📞' }}</div>
      <div class="cs-call-title">客服来电</div>
      <div class="cs-call-subtitle">{{ callType === 'video' ? '视频通话' : '语音通话' }}</div>
      <div class="cs-call-btns">
        <button class="cs-call-btn cs-call-decline" @click="rejectCall">拒 绝</button>
        <button class="cs-call-btn cs-call-accept" @click="acceptCall">接 听</button>
      </div>
    </template>

    <!-- 呼叫中 -->
    <template v-else-if="callState === 'calling'">
      <div class="cs-call-avatar">{{ callType === 'video' ? '📹' : '📞' }}</div>
      <div class="cs-call-title">正在呼叫客服...</div>
      <div class="cs-call-subtitle">{{ callType === 'video' ? '视频通话' : '语音通话' }}</div>
      <div class="cs-call-btns">
        <button class="cs-call-btn cs-call-hangup" @click="hangUpCall">取 消</button>
      </div>
    </template>

    <!-- 通话中 -->
    <template v-else>
      <div class="cs-call-videos" :class="{ 'cs-pip-swapped': pipSwapped }">
        <div id="remote-video" class="cs-call-remote" @click="pipSwapped && swapPip()"></div>
        <div id="local-video" v-if="callType === 'video'" class="cs-call-local" @click="swapPip"></div>
      </div>
      <div class="cs-call-timer">{{ callTimer }}</div>
      <div class="cs-call-btns">
        <template v-if="callType === 'video'">
          <button class="cs-call-btn cs-call-ctrl" @click="switchCamera">翻转</button>
          <button class="cs-call-btn cs-call-ctrl" @click="toggleCamera">{{ cameraOn ? '关摄像头' : '开摄像头' }}</button>
        </template>
        <button class="cs-call-btn cs-call-hangup" @click="hangUpCall">挂 断</button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { chatWechatLoginApi, chatGetTenantByDomainApi, chatGetMessagesApi, chatUploadFileApi } from '@/utils/http/ChatApi'
import { ChatSocket } from '@/utils/ws'
import { setCache } from '@/utils/LocalCache'
import { TOKEN } from '@/utils/CacheKey'

// ===== 连接状态 =====
let ws = null
let myUserId = null
let agentUserId = null  // 客服的目标 userId
let sessionId = null    // 会话 id(历史消息拉取用)
let wsToken = null      // WebSocket 连接 JWT
let historyPage = 0     // 历史消息分页页码(从 1 开始)
let historyHasMore = false
let historyLoading = false

// ===== 音视频通话状态(原生 WebRTC + ws 信令) =====
let pc = null                 // RTCPeerConnection
let localStream = null        // 通话本地媒体流
let extraMediaStreams = []    // 通话用 getUserMedia 原生流(结束时统一释放)
let callTimerInterval = null
let callSeconds = 0
let pendingOffer = null       // 来电的 offer 信令 {sdp, from, callType}
let callRecordRef = null      // 当前通话记录消息引用(挂断后补时长)
const callState = ref('idle')   // idle | calling | ringing | incall
const callType = ref('video')   // audio | video
const callTimer = ref('00:00')
const showCallMenu = ref(false) // 通话类型选择弹层
let cameraFacing = 'user'       // 摄像头朝向: user=前置 environment=后置
const cameraOn = ref(true)      // 摄像头开关(视频通话中)
const pipSwapped = ref(false)   // 小窗/大画面互换(点击小窗切换)
const wsConnected = ref(false)  // 模板按钮禁用状态

// STUN 用于 NAT 打洞;若打洞失败(复杂网络),在 iceServers 里加自建 TURN:
// { urls: 'turn:your-turn-server:3478', username: 'user', credential: 'pass' }
const RTC_CONFIG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }

// 微信授权后端入口(mer1.eguangchang.com 已在网页授权域名白名单)
const WX_AUTH_URL = 'https://mer1.eguangchang.com/restful/oauth/authorize'

// ===== 页面状态 =====
const pageState = ref('loading')   // loading | error | chat
const loadingText = ref('正在连接客服...')
const errorText = ref('')
const connecting = ref(false)
const chatText = ref('')
const chatMsgs = ref([])
const msgListRef = ref(null)
const agentName = ref('')      // 客服昵称(登录接口返回)
const fileInputRef = ref(null)
const imageInputRef = ref(null)
const videoInputRef = ref(null)

// ===== 语音录制(微信按住说话模式)=====
const voiceMode = ref(false)    // false=键盘输入 true=按住说话
const isRecording = ref(false)
const isPressing = ref(false)
const pressCancel = ref(false)
let recordStartTime = 0
let micStream = null            // 复用的麦克风流(页面内只获取一次)
let mediaRecorder = null
let audioChunks = []

// 图片/视频预览
const preview = ref({ show: false, type: 'image', url: '' })

onMounted(() => {
  const params = new URLSearchParams(window.location.search)
  const domain = params.get('domain')
  const wechatId = params.get('wechatId')

  if (!domain) {
    pageState.value = 'error'
    errorText.value = '缺少 domain 参数'
    return
  }

  if (wechatId) {
    // 已有 wechatId(微信授权后由 wawa 后端跳回携带):直接登录聊天
    // wawa 授权回调带回 name(微信昵称)和 avatarUrl(微信头像),随登录提交保存
    wechatLoginAndChat(domain, wechatId, params.get('name') || '', params.get('avatarUrl') || '')
  } else {
    // 无 wechatId:跳后端发起微信授权
    startWechatAuth(domain)
  }
})

function reload() {
  window.location.reload()
}

/** 微信授权:验证主体后跳后端 authorize 接口(后端拼微信授权 URL 并处理回调) */
async function startWechatAuth(domain) {
  pageState.value = 'loading'
  loadingText.value = '正在获取微信授权...'
  try {
    // 验证主体存在(domain 无效时给出友好错误,避免白跳一圈)
    const res = await chatGetTenantByDomainApi(domain)
    const tenant = res.data || res
    if (!tenant || !tenant.code) {
      pageState.value = 'error'
      errorText.value = '主体不存在或未配置'
      return
    }

    // 跳后端授权入口,state 携带当前前端 URL(授权完成后后端跳回并带 wechatId)
    const state = encodeURIComponent(window.location.href)
    window.location.replace(WX_AUTH_URL + '?state=' + state)
  } catch (e) {
    console.error('微信授权流程失败', e)
    // 优先显示后端返回的真实错误信息(如"主体不存在: xxx")
    const msg = (e.response && e.response.data && (e.response.data.message || e.response.data.msg))
      || e.message || '未知错误'
    pageState.value = 'error'
    errorText.value = '微信授权失败: ' + msg
  }
}

/** 按 domain + wechatId 登录并进入聊天(name=微信昵称,avatarUrl=微信头像) */
async function wechatLoginAndChat(domain, wechatId, name, avatarUrl) {
  pageState.value = 'loading'
  loadingText.value = '正在连接客服...'
  connecting.value = true

  try {
    const res = await chatWechatLoginApi({ domain, wechatId, name, avatarUrl })
    const data = res.data || res
    if (!data || !data.userId) {
      pageState.value = 'error'
      errorText.value = (res.message || res.msg || '登录失败')
      return
    }

    myUserId = data.userId
    agentUserId = data.agentUserId || null
    sessionId = data.sessionId
    wsToken = data.token
    agentName.value = data.agentName || ''

    // 存 token:历史消息接口 /message/** 需要认证,ChatAxiosInstance 会自动带 Bearer
    setCache(TOKEN, { token: data.token, userId: data.userId, name: data.name, userType: 'CUSTOMER' })

    if (!agentUserId) {
      pageState.value = 'error'
      errorText.value = '暂无可用客服,请稍后再试'
      return
    }

    // 连接 WebSocket(消息收发 + 通话信令)
    connectWs()

    // 拉取落库历史消息
    await loadHistoryMessages()

    pageState.value = 'chat'
    if (chatMsgs.value.length === 0) {
      chatMsgs.value.push({ type: 'text', text: '您好,请问有什么可以帮您?', mine: false })
    }
    scrollToBottom()
    preloadMic() // 预获取麦克风,后续录音不再重复请求权限
  } catch (e) {
    console.error(e)
    pageState.value = 'error'
    errorText.value = '连接失败: ' + (e.message || e)
  }
  connecting.value = false
}

/** 建立 WebSocket 连接 */
function connectWs() {
  ws = new ChatSocket({
    token: wsToken,
    userId: myUserId,
    onConnected: () => { wsConnected.value = true },
    onMsg: (data) => {
      const formatted = formatMsg(data)
      if (formatted) {
        chatMsgs.value.push(formatted)
        scrollToBottom()
      }
    },
    onCall: handleCallMessage,
    onAck: (localId, data) => {
      const idx = chatMsgs.value.findIndex(m => m.localId === localId)
      if (idx >= 0) {
        chatMsgs.value[idx].id = data.id
        // 媒体消息:上传成功后用真实 url 替换 blob 预览
        if (data.fileUrl && chatMsgs.value[idx].url && chatMsgs.value[idx].url.startsWith('blob:')) {
          chatMsgs.value[idx].url = data.fileUrl
        }
      }
    },
    onError: (msg) => alert('连接错误: ' + msg),
    onClose: () => { wsConnected.value = false },
  })
  ws.connect()
}

function openPreview(type, url) {
  if (url) preview.value = { show: true, type, url }
}

function closePreview() {
  preview.value.show = false
}

function scrollToBottom(force) {
  nextTick(() => {
    const el = msgListRef.value
    if (!el) return
    // 用户正在上滑看历史时不强制拽回底部;只有接近底部或 force 时才滚动
    if (force || el.scrollHeight - el.scrollTop - el.clientHeight < 120) {
      el.scrollTop = el.scrollHeight
    }
  })
}

/** Date -> 日期分隔文案(今天/昨天/具体日期) */
function formatDay(d) {
  if (!d) return null
  const now = new Date()
  const same = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  if (same(d, now)) return '今天'
  const yest = new Date(now); yest.setDate(now.getDate() - 1)
  if (same(d, yest)) return '昨天'
  return (d.getMonth() + 1) + '月' + d.getDate() + '日'
}

/** 返回上一页 */
function goBack() {
  if (window.history.length > 1) {
    window.history.back()
  } else {
    window.location.href = '/'
  }
}

/** 后端落库消息(MessageResp) -> 前端消息对象 */
function formatMsg(m) {
  if (!m) return null
  const time = m.createTime ? new Date(String(m.createTime).replace(' ', 'T')) : new Date()
  const base = {
    mine: m.senderImId === myUserId,
    time: time.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    day: formatDay(time)
  }
  switch (m.messageType) {
    case 'TEXT':
      return { ...base, type: 'text', text: m.content || '' }
    case 'IMAGE':
      return { ...base, type: 'image', url: m.fileUrl || m.content || '' }
    case 'VIDEO':
      return { ...base, type: 'video', url: m.fileUrl || m.content || '' }
    case 'FILE':
      return { ...base, type: 'file', url: m.fileUrl, fileName: m.fileName || m.content || '文件', fileSize: m.fileSize }
    case 'AUDIO': {
      let duration = 0
      try { if (m.customData) duration = Number(JSON.parse(m.customData).duration) || 0 } catch (e) { /* ignore */ }
      return { ...base, type: 'voice', url: m.fileUrl || m.content || '', duration, playing: false }
    }
    case 'SYSTEM': {
      // 通话记录(后端落库的通话邀请)
      let callTypeStr = 'audio', duration = null
      try {
        if (m.customData) {
          const cd = JSON.parse(m.customData)
          callTypeStr = cd.callType || 'audio'
          duration = cd.duration || null
        }
      } catch (e) { /* ignore */ }
      return { ...base, type: 'call', callType: callTypeStr, text: m.content || '通话', duration }
    }
    default:
      return null
  }
}

/** 首次加载历史消息(后端分页,第 1 页) */
async function loadHistoryMessages() {
  if (!sessionId) return
  try {
    const res = await chatGetMessagesApi({ sessionId, page: { page: 1, size: 30 } })
    const pd = res.data || {}
    const list = pd.list || []
    chatMsgs.value = list.map(formatMsg).filter(Boolean)
    historyPage = 1
    historyHasMore = pd.total > list.length
  } catch (e) {
    console.log('加载历史消息失败', e.message)
  }
}

/** 上滑触顶:加载更早的历史消息,插入列表头部并保持滚动位置 */
async function loadOlderMessages() {
  if (!sessionId || historyLoading || !historyHasMore) return
  historyLoading = true
  const el = msgListRef.value
  const prevHeight = el ? el.scrollHeight : 0
  try {
    const res = await chatGetMessagesApi({ sessionId, page: { page: historyPage + 1, size: 30 } })
    const older = ((res.data || {}).list || []).map(formatMsg).filter(Boolean)
    if (older.length > 0) {
      chatMsgs.value = older.concat(chatMsgs.value)
      historyPage++
      // 保持视口内容位置不变(不跳动)
      nextTick(() => {
        const el2 = msgListRef.value
        if (el2) el2.scrollTop = el2.scrollHeight - prevHeight
      })
    } else {
      historyHasMore = false
    }
  } catch (e) {
    console.log('加载更早消息失败', e.message)
  }
  historyLoading = false
}

/** 滚动监听:触顶加载更早消息 */
function onBodyScroll() {
  const el = msgListRef.value
  if (el && el.scrollTop < 40) loadOlderMessages()
}

// ===== 文本消息 =====
async function sendMsg() {
  const text = chatText.value.trim()
  if (!text || !wsConnected.value || !agentUserId) return

  const localId = genLocalId()
  chatMsgs.value.push({
    localId, type: 'text', text, mine: true,
    time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    day: formatDay(new Date())
  })
  chatText.value = ''
  scrollToBottom()

  ws.send({ type: 'text', to: agentUserId, sessionId, content: text, localId })
}

// ===== 上传文件并发送媒体消息 =====
async function uploadAndSend(file, msgType, extra) {
  try {
    const up = await chatUploadFileApi(file)
    const d = up.data || up
    // 上传成功立即用真实 Minio URL 替换本地 blob 预览(不等 ws ack,避免 ack 丢失后刷新裂图)
    if (extra && extra.localId) {
      const idx = chatMsgs.value.findIndex(m => m.localId === extra.localId)
      if (idx >= 0 && chatMsgs.value[idx].url && chatMsgs.value[idx].url.startsWith('blob:')) {
        chatMsgs.value[idx].url = d.url
      }
    }
    ws.send(Object.assign({
      type: msgType,
      to: agentUserId,
      sessionId,
      url: d.url,
      fileName: d.fileName || file.name,
      fileSize: d.fileSize || file.size
    }, extra || {}))
  } catch (e) {
    console.error('上传失败', e)
    const msg = (e.response && e.response.data && (e.response.data.message || e.response.data.msg)) || e.message || '未知错误'
    alert('文件上传失败: ' + msg)
  }
}

// ===== 发送图片 =====
function pickImage() {
  if (imageInputRef.value) imageInputRef.value.click()
}

async function onImageSelected(e) {
  const file = e.target.files[0]
  if (!file || !agentUserId) return
  e.target.value = ''

  const localId = genLocalId()
  chatMsgs.value.push({
    localId, type: 'image', url: URL.createObjectURL(file), mine: true,
    time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    day: formatDay(new Date())
  })
  scrollToBottom()

  await uploadAndSend(file, 'image', { localId })
}

// ===== 发送视频 =====
function pickVideo() {
  if (videoInputRef.value) videoInputRef.value.click()
}

async function onVideoSelected(e) {
  const file = e.target.files[0]
  if (!file || !agentUserId) return
  e.target.value = ''

  const localId = genLocalId()
  chatMsgs.value.push({
    localId, type: 'video', url: URL.createObjectURL(file), mine: true,
    time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    day: formatDay(new Date())
  })
  scrollToBottom()

  await uploadAndSend(file, 'video', { localId })
}

// ===== 发送文件 =====
function pickFile() {
  if (fileInputRef.value) fileInputRef.value.click()
}

async function onFileSelected(e) {
  const file = e.target.files[0]
  if (!file || !agentUserId) return
  e.target.value = '' // 允许重复选择同一文件

  // 限制文件大小 100MB
  if (file.size > 100 * 1024 * 1024) {
    alert('文件大小不能超过 100MB')
    return
  }

  const localId = genLocalId()
  chatMsgs.value.push({
    localId, type: 'file', fileName: file.name, fileSize: file.size, url: URL.createObjectURL(file), mine: true,
    time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    day: formatDay(new Date())
  })
  scrollToBottom()

  await uploadAndSend(file, 'file', { localId })
}

function openUrl(url) {
  if (url) window.open(url, '_blank')
}

// ===== 语音录制(微信按住说话模式)=====

/** 获取/复用麦克风流:页面内只请求一次权限 */
async function ensureMicStream() {
  if (micStream && micStream.getAudioTracks().length > 0 && micStream.getAudioTracks()[0].readyState === 'live') {
    return micStream
  }
  micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
  return micStream
}

/** 登录后预获取麦克风权限(浏览器记住授权后,进页面只会询问一次) */
async function preloadMic() {
  try {
    await ensureMicStream()
  } catch (e) {
    // 预获取失败不阻塞(用户真正录音时再提示)
    console.log('预获取麦克风失败(可能未授权,录音时再请求)', e.name || e.message)
  }
}

/** 点击话筒:切换 输入框/按住说话 模式 */
function toggleVoiceMode() {
  voiceMode.value = !voiceMode.value
  // 从语音模式切回键盘时,若正在录音则取消
  if (!voiceMode.value && isRecording.value) {
    pressCancel.value = true
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop()
    }
  }
}

/** 选择浏览器支持的录音格式: mp4 优先(iOS 微信只支持 mp4,不支持 webm) */
function pickAudioMimeType() {
  const candidates = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm']
  for (const c of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(c)) return c
    } catch (e) { /* ignore */ }
  }
  return ''
}

/** 按住开始录音 */
async function startPressRecord() {
  if (isRecording.value || !wsConnected.value || !agentUserId) return
  pressCancel.value = false
  isPressing.value = true
  audioChunks = []
  recordStartTime = Date.now()

  try {
    const stream = await ensureMicStream()
    const mimeType = pickAudioMimeType() || 'audio/webm'

    mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) audioChunks.push(event.data)
    }

    mediaRecorder.onstop = async () => {
      // 注意:不复用流的 tracks,micStream 保留供下次录音复用(页面内只请求一次权限)
      isRecording.value = false
      isPressing.value = false
      if (audioChunks.length === 0) return

      const durationMs = Date.now() - recordStartTime
      const blob = new Blob(audioChunks, { type: mimeType })
      audioChunks = []

      // 微信规则:短于 1 秒提示"说话时间太短";滑出按钮松开 = 取消发送
      if (durationMs < 1000) {
        if (!pressCancel.value) alert('说话时间太短')
        pressCancel.value = false
        return
      }
      if (pressCancel.value) {
        pressCancel.value = false
        return
      }

      const ext = mimeType.includes('mp4') ? 'm4a' : 'webm'
      const file = new File([blob], `voice_${Date.now()}.${ext}`, { type: mimeType })
      const duration = Math.max(1, Math.round(durationMs / 1000)) // 本地显示用秒

      // 本地先显示(blob URL 会话内可播放)
      const localId = genLocalId()
      const voiceMsg = {
        localId, type: 'voice', url: URL.createObjectURL(blob), duration, mine: true, playing: false,
        time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        day: formatDay(new Date())
      }
      chatMsgs.value.push(voiceMsg)
      scrollToBottom()

      // 上传后发送语音消息(ack 会把 blob url 替换为真实 url)
      await uploadAndSend(file, 'voice', { localId, duration: String(duration) })
    }

    mediaRecorder.start()
    isRecording.value = true
  } catch (e) {
    console.error('recording error', e)
    isPressing.value = false
    let hint = '无法访问麦克风。'
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      hint += ' 当前浏览器不支持录音 API,请使用最新版 Chrome/Safari,需 HTTPS 访问。'
    } else if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
      hint += ' 麦克风权限被拒绝,请在浏览器设置中允许麦克风访问。'
    } else if (e.name === 'NotFoundError') {
      hint += ' 未检测到麦克风设备。'
    } else {
      hint += ' 请检查:1) HTTPS 访问 2) 麦克风权限已授予。'
    }
    alert(hint)
  }
}

/** 松开结束录音(松手即发送,短于1秒或滑出则取消) */
function endPressRecord() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop()
  } else {
    isPressing.value = false
  }
}

/** 按住滑动:移出按钮区域 = 取消发送(微信交互) */
function onPressMove(e) {
  if (!isPressing.value) return
  const point = e.touches ? e.touches[0] : e
  const btn = e.currentTarget
  const rect = btn.getBoundingClientRect()
  const inside = point.clientX >= rect.left - 30 && point.clientX <= rect.right + 30 &&
                 point.clientY >= rect.top - 60 && point.clientY <= rect.bottom + 60
  pressCancel.value = !inside
}

/** 语音播放切换 */
function toggleVoice(msg, event) {
  if (msg.playing) {
    // 停止所有播放
    const audios = msgListRef.value?.querySelectorAll('audio')
    if (audios) audios.forEach(a => { a.pause(); a.currentTime = 0 })
    msg.playing = false
  } else {
    // 先停止其他播放
    chatMsgs.value.forEach(m => { if (m !== msg) m.playing = false })
    const audioEl = event.currentTarget.querySelector('audio')
    if (audioEl) {
      msg.playing = true
      // 用真实音频时长校准显示(老消息 second 可能为 0)
      audioEl.onloadedmetadata = () => {
        if (audioEl.duration && isFinite(audioEl.duration) && audioEl.duration > 0) {
          msg.duration = Math.round(audioEl.duration)
        }
      }
      audioEl.play().catch(() => { msg.playing = false })
      audioEl.onended = () => { msg.playing = false }
    }
  }
}

function formatFileSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function genLocalId() {
  return 'l' + Date.now() + Math.random().toString(36).slice(2, 7)
}

// ===== 音视频通话(原生 WebRTC + ws 信令)=====

/** 创建 RTCPeerConnection,绑定 ICE/远端流事件 */
function createPeer() {
  pc = new RTCPeerConnection(RTC_CONFIG)

  pc.onicecandidate = (e) => {
    if (e.candidate && agentUserId) {
      ws.send({ type: 'call', action: 'candidate', to: agentUserId, sessionId, candidate: e.candidate })
    }
  }

  pc.ontrack = (e) => {
    const remoteStream = e.streams[0]
    if (!remoteStream) return
    const container = document.getElementById('remote-video')
    if (!container) return
    container.innerHTML = ''
    const v = document.createElement('video')
    v.autoplay = true
    v.playsInline = true
    v.setAttribute('playsinline', '')
    v.style.width = '100%'
    v.style.height = '100%'
    v.srcObject = remoteStream
    v.play().catch(() => { /* ignore */ })
    container.appendChild(v)
  }

  pc.onconnectionstatechange = () => {
    if (pc && (pc.connectionState === 'failed' || pc.connectionState === 'disconnected')) {
      endCall()
    }
  }
  return pc
}

/** 获取通话媒体流:音频单独 getUserMedia,视频通话再单独取摄像头 addTrack(微信兼容方案) */
async function getCallMedia() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  extraMediaStreams.push(stream)
  if (callType.value === 'video') {
    try {
      const vs = await navigator.mediaDevices.getUserMedia({ video: true })
      extraMediaStreams.push(vs)
      vs.getVideoTracks().forEach(t => stream.addTrack(t))
    } catch (e) {
      console.error('摄像头获取失败', e)
      alert('无法访问摄像头,请检查摄像头权限: ' + (e && e.message || '未知错误'))
      throw e
    }
  }
  return stream
}

/** 本地视频预览(通话中显示自己画面) */
function showLocalPreview(stream) {
  const container = document.getElementById('local-video')
  if (!container) return
  container.innerHTML = ''
  const v = document.createElement('video')
  v.autoplay = true
  v.playsInline = true
  v.muted = true
  v.setAttribute('muted', '')
  v.setAttribute('playsinline', '')
  v.style.width = '100%'
  v.style.height = '100%'
  v.srcObject = stream
  v.play().catch(() => { /* ignore */ })
  container.appendChild(v)
}

/** 点击小窗:与远端大画面互换(再点换回) */
function swapPip() {
  if (callType.value === 'video') {
    pipSwapped.value = !pipSwapped.value
  }
}

/** 从选择菜单发起通话 */
function chooseCall(type) {
  showCallMenu.value = false
  startCall(type)
}

/** 发起通话(语音/视频) */
async function startCall(type) {
  if (!wsConnected.value || !agentUserId || callState.value !== 'idle') return
  callType.value = type
  callState.value = 'calling'
  startCallTimer()

  // 发起方本地也补一条通话记录(挂断时补时长;后端同时落库一条 SYSTEM 记录)
  callRecordRef = {
    type: 'call',
    callType: type,
    text: type === 'video' ? '视频通话' : '语音通话',
    mine: true,
    time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    day: formatDay(new Date()),
    duration: null
  }
  chatMsgs.value.push(callRecordRef)
  scrollToBottom()

  try {
    createPeer()
    localStream = await getCallMedia()
    localStream.getTracks().forEach(t => pc.addTrack(t, localStream))
    if (callType.value === 'video') showLocalPreview(localStream)

    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    ws.send({ type: 'call', action: 'invite', to: agentUserId, sessionId, callType: type, sdp: pc.localDescription })
  } catch (e) {
    console.error('发起通话失败', e)
    alert('通话建立失败: ' + (e.message || e))
    endCall()
  }
}

/** 接听来电 */
async function acceptCall() {
  callState.value = 'incall'
  startCallTimer()
  try {
    createPeer()
    localStream = await getCallMedia()
    localStream.getTracks().forEach(t => pc.addTrack(t, localStream))
    if (callType.value === 'video') showLocalPreview(localStream)

    if (pendingOffer && pendingOffer.sdp) {
      await pc.setRemoteDescription(new RTCSessionDescription(pendingOffer.sdp))
    }
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    ws.send({ type: 'call', action: 'accept', to: pendingOffer.from || agentUserId, sessionId, sdp: pc.localDescription })
  } catch (e) {
    console.error('接听失败', e)
    alert('接听失败: ' + (e.message || e))
    endCall()
  }
}

/** 拒绝来电 */
function rejectCall() {
  ws.send({ type: 'call', action: 'reject', to: pendingOffer.from || agentUserId, sessionId })
  endCall()
}

/** 挂断/取消 */
function hangUpCall() {
  ws.send({ type: 'call', action: 'hangup', to: agentUserId, sessionId, duration: callTimer.value })
  endCall()
}

/** 翻转摄像头(前置/后置切换),通话中实时生效 */
async function switchCamera() {
  if (callType.value !== 'video' || !localStream) return
  try {
    // 枚举摄像头设备,按 deviceId 切到下一个(facingMode 在电脑/部分安卓无对应设备会报错)
    const devices = await navigator.mediaDevices.enumerateDevices()
    const cams = devices.filter(d => d.kind === 'videoinput')
    if (cams.length < 2) {
      alert('未检测到其他摄像头,无法翻转')
      return
    }
    const curTrack = localStream.getVideoTracks()[0]
    const curDeviceId = (curTrack && curTrack.getSettings && curTrack.getSettings().deviceId) || ''
    const next = cams.find(c => c.deviceId && c.deviceId !== curDeviceId) || cams[0]

    let vs = null
    try {
      vs = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: next.deviceId } } })
    } catch (e1) {
      // exact 约束失败(部分微信内核):回退默认摄像头
      console.log('deviceId 精确切换失败,回退默认摄像头', e1.name)
      vs = await navigator.mediaDevices.getUserMedia({ video: true })
    }
    const newTrack = vs.getVideoTracks()[0]
    if (!newTrack) throw new Error('未获取到摄像头')

    // 本地流:移除旧 video track 并停止,加入新 track
    const oldTracks = localStream.getVideoTracks()
    oldTracks.forEach(t => {
      localStream.removeTrack(t)
      t.stop()
    })
    localStream.addTrack(newTrack)
    // 发送端:replaceTrack 让对端立即切换
    if (pc) {
      const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video')
      if (sender) await sender.replaceTrack(newTrack)
    }
    // 本地预览刷新
    const localEl = document.getElementById('local-video')
    if (localEl && localEl.firstChild) localEl.firstChild.srcObject = localStream
  } catch (e) {
    console.error('切换摄像头失败', e)
    alert('切换摄像头失败: ' + (e.message || e))
  }
}

/** 关闭/开启摄像头画面(本地黑屏,对方看到黑画面) */
function toggleCamera() {
  if (!localStream) return
  const tracks = localStream.getVideoTracks()
  if (tracks.length === 0) return
  cameraOn.value = !cameraOn.value
  tracks.forEach(t => { t.enabled = cameraOn.value })
}

/** 结束通话(清理 RTCPeerConnection + 媒体流,并给通话记录补时长) */
async function endCall() {
  stopCallTimer()
  callState.value = 'idle'
  pendingOffer = null
  // 重置摄像头状态
  cameraOn.value = true
  cameraFacing = 'user'
  pipSwapped.value = false
  // 通话记录补时长(对方已传时长则保留;未接通/被拒时保持 null 不显示)
  if (callRecordRef && callRecordRef.type === 'call') {
    if (!callRecordRef.duration) {
      callRecordRef.duration = callSeconds > 0 ? callTimer.value : null
    }
    callRecordRef = null
  }
  if (localStream) {
    try { localStream.getTracks().forEach(t => t.stop()) } catch (e) { /* ignore */ }
    localStream = null
  }
  // 释放分步获取的原生媒体流(麦克风/摄像头指示灯熄灭)
  if (extraMediaStreams.length > 0) {
    extraMediaStreams.forEach(s => { try { s.getTracks().forEach(t => t.stop()) } catch (e) { /* ignore */ } })
    extraMediaStreams = []
  }
  if (pc) {
    try {
      pc.ontrack = null
      pc.onicecandidate = null
      pc.close()
    } catch (e) { /* ignore */ }
    pc = null
  }
  // 清空视频容器
  ;['remote-video', 'local-video'].forEach(id => {
    const el = document.getElementById(id)
    if (el) el.innerHTML = ''
  })
}

/** 处理通话信令(ws 收到 {type:'call', ...}) */
function handleCallMessage(payload) {
  if (!payload || payload.type !== 'call') return
  const action = payload.action
  switch (action) {
    case 'invite':
      // 客服来电
      if (callState.value === 'idle') {
        callType.value = payload.callType || 'audio'
        callState.value = 'ringing'
        pendingOffer = payload
        // 被叫方本地补一条通话记录
        callRecordRef = {
          type: 'call',
          callType: callType.value,
          text: callType.value === 'video' ? '视频通话' : '语音通话',
          mine: false,
          time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
          day: formatDay(new Date()),
          duration: null
        }
        chatMsgs.value.push(callRecordRef)
        scrollToBottom()
      }
      break
    case 'accept':
      // 对方接听:设置远端 answer
      if (callState.value === 'calling' && payload.sdp && pc) {
        try {
          pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
        } catch (e) {
          console.error('setRemoteDescription(accept) 失败', e)
        }
        callState.value = 'incall'
        startCallTimer()
      }
      break
    case 'reject':
      if (callState.value === 'calling') {
        endCall()
        alert('对方拒绝了通话')
      }
      break
    case 'candidate':
      if (pc && payload.candidate) {
        pc.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(e => console.error('addIceCandidate 失败', e))
      }
      break
    case 'hangup':
      // 对方挂断:若带时长,补到当前通话记录上
      if (payload.duration && callRecordRef && callRecordRef.type === 'call') {
        callRecordRef.duration = payload.duration
      }
      endCall()
      break
  }
}

/** 通话计时 */
function startCallTimer() {
  stopCallTimer()
  callSeconds = 0
  callTimer.value = '00:00'
  callTimerInterval = setInterval(() => {
    callSeconds++
    const m = String(Math.floor(callSeconds / 60)).padStart(2, '0')
    const s = String(callSeconds % 60).padStart(2, '0')
    callTimer.value = m + ':' + s
  }, 1000)
}

function stopCallTimer() {
  if (callTimerInterval) {
    clearInterval(callTimerInterval)
    callTimerInterval = null
  }
}

onUnmounted(() => {
  // 清理录音资源
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    try { mediaRecorder.stop() } catch (e) { /* ignore */ }
  }
  if (micStream) {
    try { micStream.getTracks().forEach(t => t.stop()) } catch (e) { /* ignore */ }
    micStream = null
  }
  if (ws) {
    ws.close()
    ws = null
  }
  endCall()
})
</script>

<style scoped>
/* 加载/错误页 */
.cs-login {
  position: fixed; inset: 0; z-index: 999;
  background: #f5f5f5;
  display: flex; align-items: center; justify-content: center;
  padding: 24px;
}
.cs-login-card {
  width: 100%; max-width: 360px;
  background: #fff; border-radius: 16px;
  padding: 32px 24px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.08);
  display: flex; flex-direction: column; align-items: center;
}
.cs-login-logo {
  font-size: 22px; font-weight: 700; color: #1677ff;
  margin-bottom: 8px;
}
.cs-login-tip {
  font-size: 13px; color: #999; margin-bottom: 24px;
  text-align: center;
}
.cs-loading-spinner {
  width: 32px; height: 32px;
  border: 3px solid #e5e5e5; border-top-color: #1677ff;
  border-radius: 50%;
  animation: cs-spin 0.8s linear infinite;
  margin-bottom: 16px;
}
@keyframes cs-spin {
  to { transform: rotate(360deg); }
}
.cs-login-btn {
  width: 100%; padding: 12px; border: none; border-radius: 10px;
  background: #1677ff; color: #fff; font-size: 15px; cursor: pointer;
  margin-top: 8px;
}
.cs-login-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* 聊天页（微信风格） */
.cs-overlay {
  position: fixed; inset: 0; z-index: 999;
  background: #ededed;
  display: flex; flex-direction: column;
}
.cs-header {
  display: flex; align-items: center;
  padding: 10px 8px;
  background: #f7f7f7;
  color: #111;
  border-bottom: 0.5px solid #d9d9d9;
  position: relative;
  z-index: 10;
  flex-shrink: 0;
}
.cs-back {
  width: 34px; height: 34px;
  border: none; background: none;
  font-size: 26px; line-height: 1;
  color: #111; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  padding: 0;
}
.cs-title {
  flex: 1; text-align: center;
  font-size: 17px; font-weight: 500;
  margin-right: 34px; /* 平衡返回按钮，标题居中 */
  letter-spacing: 0.5px;
}
.cs-connecting { font-size: 12px; font-weight: 400; color: #999; position: absolute; right: 12px; }
.cs-body { flex: 1; overflow-y: auto; padding: 12px 12px 20px; }
.cs-msg { display: flex; align-items: flex-start; margin-bottom: 16px; }
.cs-msg-left { flex-direction: row; }
.cs-msg-right { flex-direction: row-reverse; }
/* 头像（微信圆角方形） */
.cs-avatar {
  width: 38px; height: 38px; border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  font-size: 15px; font-weight: 600; color: #fff;
  flex-shrink: 0;
  user-select: none;
}
.cs-msg-left .cs-avatar { background: #1677ff; }
.cs-msg-right .cs-avatar { background: #b0b6bf; }
/* 消息主体 */
.cs-msg-main {
  max-width: 68%;
  margin: 0 10px;
  display: flex; flex-direction: column;
  min-width: 0;
}
.cs-msg-left .cs-msg-main { align-items: flex-start; }
.cs-msg-right .cs-msg-main { align-items: flex-end; }
.cs-bubble {
  padding: 9px 12px;
  border-radius: 6px; font-size: 15px;
  line-height: 1.45; word-break: break-all;
  position: relative;
  color: #111;
}
/* 对方：白底 + 左侧小尾巴 */
.cs-msg-left .cs-bubble {
  background: #fff;
}
.cs-msg-left .cs-bubble::before {
  content: '';
  position: absolute; left: -6px; top: 12px;
  border: 5px solid transparent;
  border-right-color: #fff;
  border-left: 0;
}
/* 自己：微信绿 + 右侧小尾巴 */
.cs-msg-right .cs-bubble {
  background: #95ec69;
  color: #111;
}
.cs-msg-right .cs-bubble::before {
  content: '';
  position: absolute; right: -6px; top: 12px;
  border: 5px solid transparent;
  border-left-color: #95ec69;
  border-right: 0;
}
.cs-time {
  font-size: 10px; color: #b2b2b2; margin-top: 4px; padding: 0 2px;
}
/* 日期分隔条 */
.cs-date-divider {
  text-align: center;
  font-size: 12px;
  color: #b2b2b2;
  margin: 6px 0 14px;
  width: 100%;
}
/* 通话记录（左右对齐气泡，带尾巴） */
.cs-call-record { padding: 0 48px; }
.cs-call-bubble {
  display: flex; align-items: center; gap: 6px;
  max-width: 68%;
  white-space: nowrap;
}
.cs-call-ico { font-size: 15px; }
.cs-call-text { font-size: 14px; }
.cs-call-dur { font-size: 12px; opacity: 0.65; margin-left: 2px; }
/* 图片消息气泡（无尾巴无背景） */
.cs-image-bubble { padding: 4px; background: transparent; }
.cs-image-bubble::before, .cs-video-bubble::before { display: none; }
.cs-msg-left .cs-image-bubble { background: transparent; }
.cs-msg-right .cs-image-bubble { background: transparent; }
.cs-image-preview {
  max-width: 200px; max-height: 200px; border-radius: 6px;
  display: block; cursor: pointer;
}
/* 视频消息气泡 */
.cs-video-bubble {
  position: relative; padding: 4px; background: transparent; cursor: pointer;
}
.cs-msg-left .cs-video-bubble { background: transparent; }
.cs-msg-right .cs-video-bubble { background: transparent; }
.cs-video-preview {
  max-width: 200px; max-height: 200px; border-radius: 6px;
  display: block;
}
.cs-play-icon {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  width: 36px; height: 36px; border-radius: 50%;
  background: rgba(0,0,0,0.6); color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 16px;
}
/* 语音消息气泡 */
.cs-voice-bubble {
  display: flex; align-items: center; gap: 6px;
  min-width: 80px; cursor: pointer;
}
.cs-voice-icon { font-size: 16px; }
.cs-voice-duration { font-size: 13px; }
/* 左侧语音适配 */
.cs-msg-left .cs-voice-bubble { background: #fff; }
/* 右侧语音适配（微信绿） */
.cs-msg-right .cs-voice-bubble { background: #95ec69; color: #111; }
/* 文件消息气泡 */
.cs-file-bubble {
  display: flex; align-items: center; gap: 10px;
  cursor: pointer; padding: 10px 14px;
  min-width: 160px;
}
.cs-file-icon {
  flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
}
.cs-file-info { min-width: 0; }
.cs-file-name {
  font-size: 13px; font-weight: 500;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.cs-file-size { font-size: 11px; opacity: 0.7; margin-top: 2px; }
/* 右侧文件消息颜色适配 */
.cs-msg-right .cs-file-icon { color: #07c160; }
/* 输入栏（微信风格） */
.cs-input-bar {
  flex-shrink: 0;
  background: #f7f7f7;
  border-top: 0.5px solid #d9d9d9;
  padding-bottom: env(safe-area-inset-bottom);
}
.cs-tools-row {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 6px 12px 0;
}
.cs-tool-btn {
  background: none; border: none;
  padding: 6px; cursor: pointer; color: #333;
  display: flex; align-items: center; justify-content: center;
  border-radius: 8px;
  transition: background 0.2s, color 0.2s;
  min-width: 32px; min-height: 32px;
}
.cs-tool-btn:hover { background: #f0f0f0; }
.cs-tool-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.cs-voice-btn.cs-recording {
  color: #ff4d4f;
  background: #fff1f0;
  animation: cs-pulse 1s infinite;
}
@keyframes cs-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255,77,79,0.4); }
  50% { box-shadow: 0 0 0 8px rgba(255,77,79,0); }
}
.cs-rec-indicator {
  font-size: 12px;
  white-space: nowrap;
  animation: cs-blink 0.6s infinite;
}
@keyframes cs-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
.cs-input-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px 10px;
}
/* 输入框前的话筒按钮 */
.cs-voice-input-btn {
  flex-shrink: 0;
  width: 36px; height: 36px;
  border: none; background: none;
  color: #333;
  display: flex; align-items: center; justify-content: center;
  border-radius: 8px;
  cursor: pointer;
  padding: 0;
}
.cs-voice-input-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.cs-voice-input-btn.cs-active {
  color: #07c160;
  background: #e8f8ef;
}
/* 按住说话按钮（微信风格） */
.cs-press-talk {
  flex: 1;
  height: 38px;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  background: #fff;
  color: #333;
  font-size: 15px;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}
.cs-press-talk:disabled { opacity: 0.5; cursor: not-allowed; }
.cs-press-talk.cs-press-active {
  background: #e5e5e5;
  border-color: #c8c8c8;
}
.cs-press-talk.cs-press-cancel {
  color: #ff4d4f;
  background: #fff1f0;
  border-color: #ffb8b3;
}
.cs-input {
  flex: 1; padding: 9px 14px;
  border: 1px solid #d9d9d9; border-radius: 6px;
  font-size: 15px; outline: none;
  background: #fff;
  transition: border-color 0.2s;
}
.cs-input:focus { border-color: #07c160; }
.cs-send {
  padding: 9px 20px; border: none; border-radius: 6px;
  background: #07c160;
  color: #fff; font-size: 15px; cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: opacity 0.2s;
}
.cs-send:disabled, .cs-input:disabled { opacity: 0.5; cursor: not-allowed; }
/* 图片/视频预览弹窗 */
.cs-preview-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  z-index: 9999;
  background: rgba(0,0,0,0.92);
  display: flex; align-items: center; justify-content: center;
}
.cs-preview-close {
  position: fixed; top: 16px; right: 16px;
  width: 36px; height: 36px; border-radius: 50%;
  background: rgba(255,255,255,0.2); border: none;
  color: #fff; font-size: 18px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; z-index: 10;
}
.cs-preview-media {
  max-width: 95vw; max-height: 95vh;
  object-fit: contain;
  border-radius: 4px;
}

/* 通话类型选择（底部弹出） */
.cs-call-menu {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  z-index: 9997;
  background: rgba(0, 0, 0, 0.45);
  display: flex; align-items: flex-end;
}
.cs-call-menu-box {
  width: 100%;
  background: #f7f7f7;
  border-radius: 12px 12px 0 0;
  padding: 8px 8px calc(12px + env(safe-area-inset-bottom));
}
.cs-call-menu-item {
  background: #fff;
  text-align: center;
  padding: 14px;
  font-size: 16px;
  color: #111;
  border-radius: 10px;
  margin-bottom: 8px;
  cursor: pointer;
}
.cs-call-menu-item:active { background: #f0f0f0; }
.cs-call-menu-cancel {
  background: #fff;
  text-align: center;
  padding: 14px;
  font-size: 16px;
  color: #888;
  border-radius: 10px;
  cursor: pointer;
}
.cs-call-menu-cancel:active { background: #f0f0f0; }

/* ===== 音视频通话覆盖层 ===== */
.cs-call-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  z-index: 9998;
  background: #1c1c1e;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  color: #fff;
}
.cs-call-avatar {
  width: 88px; height: 88px;
  border-radius: 50%;
  background: rgba(255,255,255,0.12);
  display: flex; align-items: center; justify-content: center;
  font-size: 40px;
  margin-bottom: 20px;
}
.cs-call-title {
  font-size: 20px; font-weight: 600;
  margin-bottom: 8px;
}
.cs-call-subtitle {
  font-size: 14px; color: rgba(255,255,255,0.6);
  margin-bottom: 40px;
}
.cs-call-btns {
  display: flex; gap: 40px; align-items: center;
}
.cs-call-btn {
  min-width: 84px; padding: 14px 22px;
  border: none; border-radius: 32px;
  font-size: 15px; color: #fff; cursor: pointer;
  transition: transform 0.15s, opacity 0.15s;
}
.cs-call-btn:active { transform: scale(0.94); }
.cs-call-accept { background: #07c160; }
.cs-call-decline { background: #ff4d4f; }
.cs-call-hangup { background: #ff4d4f; }
.cs-call-ctrl { background: rgba(255, 255, 255, 0.28); min-width: 72px; padding: 12px 16px; }
.cs-call-videos {
  position: relative;
  width: 100%; flex: 1;
  display: flex; align-items: center; justify-content: center;
  background: #111;
}
.cs-call-remote {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
}
.cs-call-remote video {
  width: 100%; height: 100%;
  object-fit: contain;
}
.cs-call-local {
  position: absolute; top: 16px; right: 16px;
  width: 110px; height: 150px;
  border-radius: 10px;
  overflow: hidden;
  background: #000;
  border: 1px solid rgba(255,255,255,0.3);
  box-shadow: 0 4px 16px rgba(0,0,0,0.4);
  z-index: 2;
}
.cs-call-local video {
  width: 100%; height: 100%;
  object-fit: cover;
}
/* 点击小窗互换:远端变小窗,本地变全屏 */
.cs-call-videos.cs-pip-swapped .cs-call-remote {
  position: absolute; top: 16px; right: 16px;
  width: 110px; height: 150px;
  border-radius: 10px; overflow: hidden;
  background: #000; border: 1px solid rgba(255,255,255,0.3);
  box-shadow: 0 4px 16px rgba(0,0,0,0.4); z-index: 2;
}
.cs-call-videos.cs-pip-swapped .cs-call-remote video {
  width: 100%; height: 100%; object-fit: cover;
}
.cs-call-videos.cs-pip-swapped .cs-call-local {
  position: static; width: 100%; height: 100%;
  border: none; border-radius: 0; box-shadow: none; z-index: 1;
}
.cs-call-videos.cs-pip-swapped .cs-call-local video {
  width: 100%; height: 100%; object-fit: contain;
}
.cs-call-timer {
  font-size: 18px; font-weight: 500;
  padding: 18px 0 8px;
  letter-spacing: 1px;
}
.cs-call-videos + .cs-call-timer { padding-bottom: 22px; }
</style>
