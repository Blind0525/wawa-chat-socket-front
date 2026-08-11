// 添加
export function setCache(key, value) {
    window.sessionStorage.setItem(key, JSON.stringify(value))
}
// 查找
export function getCache(key) {
    const value = window.sessionStorage.getItem(key)
    if (value) {
        return JSON.parse(value)
    }
}
// 删除
export function deleteCatch(key) {
    window.sessionStorage.removeItem(key)
}
// 清理
export function clearCache() {
    window.sessionStorage.clear()
}
