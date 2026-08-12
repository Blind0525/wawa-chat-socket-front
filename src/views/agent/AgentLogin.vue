<template>
  <div class="al-page">
    <div class="al-card">
      <div class="al-logo">客服工作台</div>
      <div class="al-sub">账号登录</div>
      <input v-model="username" class="al-input" placeholder="账号" />
      <input v-model="password" type="password" class="al-input" placeholder="密码" @keydown.enter="doLogin" />
      <button class="al-btn" :disabled="loading" @click="doLogin">{{ loading ? '登录中...' : '登 录' }}</button>
      <div v-if="errorText" class="al-error">{{ errorText }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { chatLoginApi } from '@/utils/http/ChatApi'
import { setCache } from '@/utils/LocalCache'
import { TOKEN } from '@/utils/CacheKey'

const router = useRouter()
const username = ref('')
const password = ref('')
const loading = ref(false)
const errorText = ref('')

async function doLogin() {
  if (!username.value.trim() || !password.value) {
    errorText.value = '请输入账号和密码'
    return
  }
  loading.value = true
  errorText.value = ''
  try {
    const res = await chatLoginApi({ username: username.value.trim(), password: password.value })
    const data = res.data || res
    if (!data || !data.token) {
      errorText.value = res.message || res.msg || '登录失败'
      return
    }
    // 存登录信息(token + userId),ChatAxiosInstance 自动带 Bearer 头
    setCache(TOKEN, { token: data.token, userId: data.userId, name: data.name, userType: data.userType })
    router.replace('/agent')
  } catch (e) {
    const msg = (e.response && e.response.data && (e.response.data.message || e.response.data.msg))
      || e.message || '登录失败'
    errorText.value = msg
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.al-page {
  position: fixed; inset: 0;
  background: #ededed;
  display: flex; align-items: center; justify-content: center;
  padding: 24px;
}
.al-card {
  width: 100%; max-width: 340px;
  background: #fff; border-radius: 14px;
  padding: 36px 24px 28px;
  display: flex; flex-direction: column;
  box-shadow: 0 6px 24px rgba(0,0,0,0.08);
}
.al-logo {
  text-align: center; font-size: 22px; font-weight: 700; color: #1c1917;
}
.al-sub {
  text-align: center; font-size: 13px; color: #999; margin: 6px 0 26px;
}
.al-input {
  height: 46px; border: 1px solid #d9d9d9; border-radius: 8px;
  padding: 0 14px; font-size: 15px; margin-bottom: 14px; outline: none;
}
.al-input:focus { border-color: #07c160; }
.al-btn {
  height: 46px; border: none; border-radius: 8px;
  background: #07c160; color: #fff; font-size: 16px; font-weight: 600;
  cursor: pointer; margin-top: 6px;
}
.al-btn:disabled { opacity: 0.6; }
.al-error {
  margin-top: 14px; text-align: center;
  font-size: 13px; color: #e54d42;
}
</style>
