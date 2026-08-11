import axios from 'axios'
import { getCache } from '@/utils/LocalCache'
import { TOKEN } from '@/utils/CacheKey'

const chatAxiosInstance = axios.create({
    baseURL: '/chat',
    timeout: 20000,
    withCredentials: false,
})

// 请求拦截器
chatAxiosInstance.interceptors.request.use((config) => {
    if (getCache(TOKEN)) {
        const token = JSON.parse(JSON.stringify(getCache(TOKEN))).token
        config.headers['Authorization'] = 'Bearer ' + token
    }
    return config
}, (error) => {
    console.log("请求错误", error)
    return Promise.reject(error)
})

// 响应拦截器
chatAxiosInstance.interceptors.response.use((response) => {
    let { code, message } = response.data
    if (code == null) {
        return response
    } else {
        switch (code) {
            case 200:
                return response
            default:
                console.log('状态码未匹配默认输出', message)
                break
        }
    }
    return Promise.reject(message)
},
    (error) => {
        console.log("请求失败:", error.message || '未知错误')
        return Promise.reject(error)
    }
)

export default chatAxiosInstance
