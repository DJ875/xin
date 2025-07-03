// 根据运行环境动态设置 API 基础路径
// 本地开发（localhost 或 127.0.0.1）=> "http://localhost:3000/api" 或相对「/api"
// 生产/Netlify 部署                               => "/.netlify/functions/api"

const isLocalhost = [
  'localhost',
  '127.0.0.1'
].includes(window.location.hostname);

const API_BASE = isLocalhost ? '/api' : '/.netlify/functions/api';

const API_CONFIG = {
    BASE_URL: API_BASE,
    ENDPOINTS: {
        LOGIN: '/login',          // POST: 用户登录
        REGISTER: '/register',    // POST: 用户注册
        VERIFY: '/auth/sync',     // POST: Netlify Identity 登录后同步/验证
        CART: '/cart',
        PRODUCTS: '/products',
        ORDERS: '/orders',
        // 硬件相关字段已删除
    }
};

// 兼容旧脚本: 将 BASE_URL 暴露为全局常量
window.BASE_URL = API_CONFIG.BASE_URL;

// 导出配置
if (typeof module !== 'undefined' && module.exports) {
    module.exports = API_CONFIG;
} 