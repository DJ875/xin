// API配置
const API_CONFIG = {
    // 根据当前环境自动选择基础URL
    BASE_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:3000/api'  // 本地开发环境
        : '/.netlify/functions/api',    // Netlify环境
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