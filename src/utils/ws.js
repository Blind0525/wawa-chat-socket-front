/**
 * 自建 IM WebSocket 客户端(替代腾讯云 TIM SDK)
 * 连接地址: ws(s)://host/chat/ws?token={jwt}
 *
 * 服务端 -> 客户端消息:
 *   {type:'pong'}                         心跳应答
 *   {type:'msg', data:{...落库消息}}       对方发来的聊天消息
 *   {type:'ack', localId, data:{...}}      自己消息的回执(带库 id / 真实文件 url)
 *   {type:'call', action, from, to, ...}   通话信令
 *   {type:'error', message}
 */
export class ChatSocket {
  constructor({ token, userId, onMsg, onCall, onAck, onError, onClose, onConnected }) {
    this.token = token
    this.userId = userId
    this.onMsg = onMsg || (() => {})
    this.onCall = onCall || (() => {})
    this.onAck = onAck || (() => {})
    this.onError = onError || (() => {})
    this.onClose = onClose || (() => {})
    this.onConnected = onConnected || (() => {})
    this.ws = null
    this.manualClose = false
    this.heartbeatTimer = null
    this.reconnectTimer = null
    this.attempts = 0
  }

  connect() {
    this.manualClose = false
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const url = `${proto}://${window.location.host}/chat/ws?token=${encodeURIComponent(this.token)}`
    this.ws = new WebSocket(url)

    this.ws.onopen = () => {
      this.attempts = 0
      this.onConnected()
      this.startHeartbeat()
    }

    this.ws.onmessage = (e) => {
      let obj = null
      try { obj = JSON.parse(e.data) } catch (err) { return }
      if (!obj || !obj.type) return
      switch (obj.type) {
        case 'pong':
          break
        case 'msg':
          this.onMsg(obj.data)
          break
        case 'ack':
          this.onAck(obj.localId, obj.data)
          break
        case 'call':
          this.onCall(obj)
          break
        case 'error':
          this.onError(obj.message || '未知错误')
          break
      }
    }

    this.ws.onclose = () => {
      this.stopHeartbeat()
      this.onClose()
      if (!this.manualClose) this.scheduleReconnect()
    }
    this.ws.onerror = () => { /* onclose 会随之触发 */ }
  }

  send(obj) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj))
    }
  }

  startHeartbeat() {
    this.stopHeartbeat()
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }))
      }
    }, 25000)
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return
    this.attempts++
    if (this.attempts > 20) return // 最多重试 20 次后放弃
    const delay = Math.min(30000, 3000 * this.attempts)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, delay)
  }

  close() {
    this.manualClose = true
    this.stopHeartbeat()
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      try { this.ws.close() } catch (e) { /* ignore */ }
      this.ws = null
    }
  }
}
