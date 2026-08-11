// 多主体域名配置：域名 -> 主体 code（与后端 tenant.code 对应）
// 支持通配符匹配 + URL 参数 ?tenant=xxx 覆盖
const domainConfig = {
    exicat: {
        name: "小喜猫网络",
        domains: ["*.exicat.cn"]
    },
    myyynet: {
        name: "优伊米网络",
        domains: ["*.myyynet.com"]
    },
    jinxing: {
        name: "小福星网络",
        domains: ["*.mingjinxing.com", 'jxmer.fstistis7283.com.cn']
    },
    qianji: {
        name: "千机游网络",
        domains: ["*.eqianji.com", '*.fstistis7283.com.cn']
    },
    guangchang: {
        name: "广畅网络",
        domains: ["*.eguangchang.com"]
    },
    napai: {
        name: "喵咪网络",
        domains: ["*.meowmeowmimi.com"]
    },
    fengxinde: {
        name: "凤鑫德网络",
        domains: ["*.efengxinde.com"]
    },
    ykl: {
        name: "亿口来",
        domains: ["*.paopaohl.com"]
    },
    qingququ: {
        name: "青趣趣网络",
        domains: ["*.s8bmef9g.com"]
    },
    bolele: {
        name: "趣乐博网络",
        domains: ["*.boyiweb.com"]
    },
    xinshanshan: {
        name: "鑫闪闪",
        domains: ["*.xinshanshanweb.com"]
    },
    cloud: {
        name: "一朵小云",
        domains: ["*.e4g8n.cn"]
    },
};

/**
 * 将通配符模式转换为正则表达式
 * @param {string} pattern - 例如 "*.exicat.cn"
 * @returns {RegExp}
 */
function wildcardToRegExp(pattern) {
    // 转义特殊字符，然后将 * 替换为 .*
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    return new RegExp('^' + escaped + '$', 'i');
}

/**
 * 根据当前 host 获取匹配的主体 code
 * 优先级: URL 参数 ?tenant=xxx > 域名匹配 > 默认 fallback
 * @returns {string} 主体 code
 */
function getDomainName() {
    // 1. URL 参数优先
    const params = new URLSearchParams(window.location.search)
    const tenantParam = params.get('tenant')
    if (tenantParam) return tenantParam

    // 2. 域名匹配
    const host = window.location.host;
    for (const [key, config] of Object.entries(domainConfig)) {
        for (const pattern of config.domains) {
            const regex = wildcardToRegExp(pattern);
            if (regex.test(host)) {
                return key;
            }
        }
    }

    // 3. 默认
    return "qianji";
}

/**
 * 获取当前域名对应的主体数据
 * @returns {Object} 主体信息对象
 */
function getDomainData() {
    const domain = getDomainName();
    return domainConfig[domain] || { name: domain, domains: [] };
}

export { getDomainName, getDomainData };
