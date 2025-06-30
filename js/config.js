// API配置
const API_CONFIG = {
    // Netlify API配置
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