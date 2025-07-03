// API基础URL (从全局 API_CONFIG 中获取)
const BASE_URL = typeof API_CONFIG !== 'undefined' ? API_CONFIG.BASE_URL : '';

// 获取认证头
function getAuthHeader() {
    const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
    return userInfo.token ? { 'Authorization': `Bearer ${userInfo.token}` } : {};
}

// API请求工具
async function apiRequest(endpoint, options = {}) {
    try {
        const headers = {
            'Content-Type': 'application/json',
            ...getAuthHeader(),
            ...options.headers
        };

        const response = await fetch(`${BASE_URL}${endpoint}`, {
            ...options,
            headers
        });

        const data = await response.json();

        if (!response.ok) {
            // 如果是认证错误，清除登录信息并跳转到登录页面
            if (response.status === 401 || response.status === 403) {
                localStorage.clear();
                sessionStorage.clear();
                window.location.replace('index.html');
                throw new Error('登录已过期，请重新登录');
            }
            throw new Error(data.message || '请求失败');
        }

        return data;
    } catch (error) {
        console.error('API请求错误:', error);
        throw error;
    }
}

// 导出API方法
const api = {
    // 用户认证
    auth: {
        login: (username, password, userType) => 
            apiRequest('/api/login', {
                method: 'POST',
                body: JSON.stringify({ username, password, userType })
            }),
        
        netlifyLogin: (email, netlifyToken, userType) =>
            apiRequest('/api/login/netlify', {
                method: 'POST',
                body: JSON.stringify({ email, netlifyToken, userType })
            }),
        
        registerMerchant: (merchantData) =>
            apiRequest('/api/merchant/register', {
                method: 'POST',
                body: JSON.stringify(merchantData)
            }),
        
        registerMerchantNetlify: (merchantData) =>
            apiRequest('/api/merchant/register-netlify', {
                method: 'POST',
                body: JSON.stringify(merchantData)
            })
    },

    // 检查认证状态
    checkAuth: () => apiRequest('/api/auth/check'),

    // 其他API方法可以在这里添加...
};

// 导出
window.api = api; 