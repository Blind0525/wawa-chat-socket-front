<template>
  <div class="ah-page">
    <div class="ah-header">
      <span class="ah-title">客服工作台</span>
      <span class="ah-logout" @click="logout">退出</span>
    </div>

    <div v-if="loading && sessions.length === 0" class="ah-tip">加载中...</div>
    <div v-else-if="sessions.length === 0" class="ah-tip">暂无会话</div>

    <div v-else class="ah-list">
      <div v-for="s in sessions" :key="s.id" class="ah-item" @click="openChat(s)">
        <div class="ah-avatar">{{ (s.customerName || '客').slice(0, 1) }}</div>
        <div class="ah-main">
          <div class="ah-row1">
            <span class="ah-name">{{ s.customerName || '微信用户' }}</span>
            <span class="ah-time">{{ fmtTime(s.lastMessageTime) }}</span>
          </div>
          <div class="ah-row2">
            <span class="ah-last" :class="{ 'ah-unread': s.unreadCount > 0 }">{{ preview(s) }}</span>
            <span v-if="s.unreadCount > 0" class="ah-badge">{{ s.unreadCount > 99 ? '99+' : s.unreadCount }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { chatMySessionListApi } from '@/utils/http/ChatApi'
import { ChatSocket } from '@/utils/ws'
import { getCache, clearCache } from '@/utils/LocalCache'
import { TOKEN } from '@/utils/CacheKey'

const router = useRouter()
// 【调试】确认客服端会话列表版本,确认后移除
alert('[客服端] 会话列表页已加载 URL=' + location.href + ' 版本=带切换按钮版')
const sessions = ref([])
const loading = ref(false)
let ws = null
let pollTimer = null

/** 最后一条消息预览(按类型) */
function preview(s) {
  const t = s.lastMessageType
  if (t === 'IMAGE') return '[图片]'
  if (t === 'VIDEO') return '[视频]'
  if (t === 'AUDIO') return '[语音]'
  if (t === 'SYSTEM') return '[通话] ' + (s.lastMessageContent || '')
  if (t === 'FILE') return '[文件] ' + (s.lastMessageContent || '')
  return s.lastMessageContent || ''
}

/** 时间显示:今天 HH:MM / 昨天 / MM-DD */
function fmtTime(ts) {
  if (!ts) return ''
  const d = new Date(String(ts).replace(' ', 'T'))
  const now = new Date()
  const same = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  if (same(d, now)) return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  const yest = new Date(now); yest.setDate(now.getDate() - 1)
  if (same(d, yest)) return '昨天'
  return (d.getMonth() + 1) + '-' + d.getDate()
}

async function refresh() {
  try {
    const res = await chatMySessionListApi()
    const list = res.data || []
    sessions.value = list
  } catch (e) {
    console.log('会话列表刷新失败', e.message)
  } finally {
    loading.value = false
  }
}

function openChat(s) {
  router.push({
    path: '/agent/chat',
    query: { sessionId: s.id, peerId: s.customerImId, customerName: s.customerName }
  })
}

function logout() {
  clearCache()
  router.replace('/login')
}

onMounted(() => {
  const auth = getCache(TOKEN)
  if (!auth || !auth.token) {
    router.replace('/login')
    return
  }
  loading.value = true
  refresh()
  // 轮询刷新未读/新会话(5s)
  pollTimer = setInterval(refresh, 5000)
  // 常驻 WebSocket:新消息到达立即刷新列表(未读实时)
  ws = new ChatSocket({
    token: auth.token,
    userId: auth.userId,
    onMsg: () => refresh(),
    onCall: () => refresh(),
    onClose: () => {},
    onError: () => {},
  })
  ws.connect()
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
  if (ws) { ws.close(); ws = null }
})
</script>

<style scoped>
.ah-page {
  min-height: 100vh;
  background: #ededed;
  padding-bottom: 20px;
}
.ah-header {
  position: sticky; top: 0; z-index: 10;
  background: #f7f7f7;
  border-bottom: 0.5px solid #d9d9d9;
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px;
}
.ah-title { font-size: 17px; font-weight: 600; color: #1c1917; }
.ah-logout { font-size: 14px; color: #576b95; cursor: pointer; }
.ah-tip {
  text-align: center; color: #999; font-size: 14px;
  padding: 60px 0;
}
.ah-list { padding: 10px 12px; }
.ah-item {
  display: flex; align-items: center; gap: 12px;
  background: #fff; border-radius: 10px;
  padding: 12px; margin-bottom: 10px;
  cursor: pointer;
}
.ah-avatar {
  width: 42px; height: 42px; border-radius: 8px;
  background: #95ec69; color: #1c1917;
  display: flex; align-items: center; justify-content: center;
  font-size: 18px; font-weight: 600; flex-shrink: 0;
}
.ah-main { flex: 1; min-width: 0; }
.ah-row1 { display: flex; align-items: center; justify-content: space-between; }
.ah-name { font-size: 15px; font-weight: 600; color: #1c1917; }
.ah-time { font-size: 12px; color: #b2b2b2; }
.ah-row2 { display: flex; align-items: center; justify-content: space-between; margin-top: 4px; }
.ah-last {
  font-size: 13px; color: #999;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  max-width: 240px;
}
.ah-last.ah-unread { color: #1c1917; }
.ah-badge {
  min-width: 18px; height: 18px; border-radius: 9px;
  background: #fa5151; color: #fff; font-size: 11px;
  display: flex; align-items: center; justify-content: center;
  padding: 0 5px; flex-shrink: 0;
}
</style>
