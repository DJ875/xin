// API配置
const API_CONFIG = {
    // 根据当前环境自动选择API基础URL
    BASE_URL: window.location.hostname.includes('netlify.app') 
        ? '/.netlify/functions/api'
        : (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? 'http://localhost:3000/api'
            : '/.netlify/functions/api'),
    ENDPOINTS: {
        LOGIN: '/login',
        REGISTER: '/register',
        PRODUCTS: '/products'
    }
};

// 导出配置
if (typeof module !== 'undefined' && module.exports) {
    module.exports = API_CONFIG;
} 