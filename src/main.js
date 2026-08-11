import '@/assets/main.css'

import App from '@/App.vue'
import router from "@/router/index"

import NProgress from 'nprogress'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'

const app = createApp(App)
const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

app.use(pinia)
app.use(router)

// 路由跳转后关闭进度条
router.afterEach(() => {
  NProgress.done()
})

app.mount('#app')
