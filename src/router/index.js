import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory('/socket2/'),
  routes: [
    {
      path: '/',
      name: 'chat',
      component: () => import('@/views/chat/ChatView.vue')
    },
    // ===== 客服端 =====
    {
      path: '/login',
      name: 'agentLogin',
      component: () => import('@/views/agent/AgentLogin.vue')
    },
    {
      path: '/agent',
      name: 'agentHome',
      component: () => import('@/views/agent/AgentHome.vue')
    },
    {
      path: '/agent/chat',
      name: 'agentChat',
      component: () => import('@/views/agent/AgentChat.vue')
    },
    // ===== 独立通话页(App 端 web-view 加载;微信/浏览器可直接打开)=====
    {
      path: '/call',
      name: 'callView',
      component: () => import('@/views/call/CallView.vue')
    },
  ]
})

export default router
