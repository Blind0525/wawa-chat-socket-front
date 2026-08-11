import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory('/imChat/'),
  routes: [
    {
      path: '/',
      name: 'chat',
      component: () => import('@/views/chat/ChatView.vue')
    },
  ]
})

export default router
