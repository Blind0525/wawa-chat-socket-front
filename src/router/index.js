import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory('/imChat/'),
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
  ]
})

export default router
