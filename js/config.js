// API配置
const API_CONFIG = {
    BASE_URL: '/.netlify/functions/api',
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