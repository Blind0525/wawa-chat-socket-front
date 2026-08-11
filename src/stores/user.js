import { defineStore } from "pinia"

export const useUserStore = defineStore('user', {
    state: () => ({
        // 用户信息 (顾客): phone / name / wechatId
        userinfo: {},
    }),
    getters: {},
    actions: {
        setUserinfo(data) {
            this.userinfo = data
        },
    },
    // 持久化到 sessionStorage
    persist: {
        enabled: true,
        storage: sessionStorage,
        key: 'chat-user',
        paths: ['userinfo'],
    }
})
