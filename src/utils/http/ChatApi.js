import chatAxiosInstance from '@/utils/http/ChatAxiosInstance'

/**
 * 微信登录:按 domain + wechatId 查/建顾客,分配客服,预创建会话
 * 返回: { token, userId, name, avatarUrl, tenantName, agentUserId, agentName, sessionId }
 * token 用于 WebSocket 连接(/chat/ws?token=xxx)
 */
export async function chatWechatLoginApi(data) {
    const response = await chatAxiosInstance.post('/user/wechatLogin', data)
    return response.data
}

/** 根据 domain(主体编码) 获取主体信息(含 domainName 后端请求域名) */
export async function chatGetTenantByDomainApi(domain) {
    const response = await chatAxiosInstance.post('/tenant/getByDomain', { value: domain })
    return response.data
}

/** 分页拉取会话历史消息(消息落库在 chat_message 表) */
export async function chatGetMessagesApi(data) {
    const response = await chatAxiosInstance.post('/message/getMessagesBySession', data)
    return response.data
}

/** 上传聊天文件(图片/视频/文件/语音),返回 {url, fileName, fileSize} */
export async function chatUploadFileApi(file) {
    const formData = new FormData()
    formData.append('file', file)
    const response = await chatAxiosInstance.post('/file/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    })
    return response.data
}

// ==================== 客服端 ====================

/** 客服/管理员账号登录: {username, password} -> {token, userId, name, userType} */
export async function chatLoginApi(data) {
    const response = await chatAxiosInstance.post('/auth/login', data)
    return response.data
}

/** 客服自己的会话列表(带顾客信息/最后消息/未读数),需 Bearer token */
export async function chatMySessionListApi() {
    const response = await chatAxiosInstance.get('/session/myList')
    return response.data
}

/** 标记会话已读(进入会话时调用) */
export async function chatMarkReadApi(sessionId) {
    const response = await chatAxiosInstance.post('/message/read', { id: sessionId })
    return response.data
}

/** 上报设备 token(极光 registrationId);App 壳(uni-app web-view)登录后调用 */
export async function chatRegisterDeviceApi(data) {
    const response = await chatAxiosInstance.post('/device/register', data)
    return response.data
}
