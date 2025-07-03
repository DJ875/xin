// 初始化 Netlify Identity
const netlifyIdentity = window.netlifyIdentity;

// 提取 API 基本配置
const { ENDPOINTS } = API_CONFIG;  // 移除 BASE_URL 的解构，因为它在 api.js 中已定义

// 当前登录类型
let currentLoginType = 'user';

// 将所有函数声明移到全局作用域
window.switchLoginType = function(type) {
    console.log('切换登录类型:', type);
    currentLoginType = type;
    const userBtn = document.getElementById('userLoginBtn');
    const merchantBtn = document.getElementById('merchantLoginBtn');
    const merchantRegisterLink = document.getElementById('merchantRegisterLink');
    const userRegisterLink = document.getElementById('registerLink');

    if (type === 'merchant') {
        merchantBtn.classList.add('active');
        userBtn.classList.remove('active');
        merchantRegisterLink.style.display = 'block';
        userRegisterLink.style.display = 'none';
    } else {
        userBtn.classList.add('active');
        merchantBtn.classList.remove('active');
        merchantRegisterLink.style.display = 'none';
        userRegisterLink.style.display = 'block';
    }
};

// 显示 Netlify 登录窗口
window.showNetlifyLogin = function() {
    console.log('打开 Netlify 登录窗口');
    netlifyIdentity.open('login');
    netlifyIdentity.on('login', user => {
        console.log('Netlify 登录成功:', user);
        handleNetlifyLogin(user);
    });
};

// 处理 Netlify 登录
async function handleNetlifyLogin(user) {
    console.log('处理 Netlify 登录:', user);
    try {
        console.log('发送验证请求到:', `${API_CONFIG.BASE_URL}${ENDPOINTS.VERIFY}`);
        const response = await fetch(`${API_CONFIG.BASE_URL}${ENDPOINTS.VERIFY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'netlify-token': user.token.access_token
            },
            body: JSON.stringify({
                userType: currentLoginType
            })
        });

        const data = await response.json();
        console.log('验证响应:', data);
        
        if (data.success) {
            const savedUser = {
                id: data.user.id || data.userId,
                username: user.email || data.user.username,
                userType: currentLoginType,
                token: data.user?.token || null,
                loginTime: Date.now()
            };
            console.log('保存用户信息:', savedUser);
            localStorage.setItem('userInfo', JSON.stringify(savedUser));
            // 兼容旧逻辑
            localStorage.setItem('userId', savedUser.id);
            localStorage.setItem('userType', savedUser.userType);
            
            const redirectUrl = currentLoginType === 'merchant' ? 'merchant_dashboard.html' : 'main.html';
            console.log('重定向到:', redirectUrl);
            window.location.href = redirectUrl;
        } else {
            document.getElementById('loginError').textContent = data.message;
        }
    } catch (error) {
        console.error('登录错误:', error);
        document.getElementById('loginError').textContent = '登录过程中发生错误';
    }
}

// 本地登录处理
window.localLogin = async function() {
    console.log('开始本地登录');
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    // 清除之前的错误信息
    clearErrors();
    
    // 验证输入
    if (!validateInput(username, password)) {
        return;
    }

    try {
        console.log('发送登录请求到:', `${API_CONFIG.BASE_URL}${ENDPOINTS.LOGIN}`);
        const response = await fetch(`${API_CONFIG.BASE_URL}${ENDPOINTS.LOGIN}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username,
                password,
                userType: currentLoginType
            })
        });

        const data = await response.json();
        console.log('登录响应:', data);
        
        if (data.success) {
            const savedUser2 = {
                ...data.user,
                loginTime: Date.now()
            };
            console.log('保存用户信息:', savedUser2);
            localStorage.setItem('userInfo', JSON.stringify(savedUser2));
            // 兼容旧逻辑
            localStorage.setItem('userId', savedUser2.id);
            localStorage.setItem('userType', savedUser2.userType);
            
            const redirectUrl = currentLoginType === 'merchant' ? 'merchant_dashboard.html' : 'main.html';
            console.log('重定向到:', redirectUrl);
            window.location.href = redirectUrl;
        } else {
            document.getElementById('loginError').textContent = data.message;
        }
    } catch (error) {
        console.error('登录错误:', error);
        document.getElementById('loginError').textContent = '登录过程中发生错误';
    }
};

// 输入验证
function validateInput(username, password) {
    let isValid = true;
    
    if (!username) {
        document.getElementById('usernameError').textContent = '请输入用户名';
        isValid = false;
    }
    
    if (!password) {
        document.getElementById('passwordError').textContent = '请输入密码';
        isValid = false;
    }
    
    return isValid;
}

// 清除错误信息
function clearErrors() {
    document.getElementById('usernameError').textContent = '';
    document.getElementById('passwordError').textContent = '';
    document.getElementById('loginError').textContent = '';
}

// 初始化页面
document.addEventListener('DOMContentLoaded', () => {
    console.log('页面加载完成');
    console.log('API配置:', { BASE_URL: API_CONFIG.BASE_URL, ENDPOINTS });
    
    if (netlifyIdentity && typeof netlifyIdentity.on === 'function') {
        netlifyIdentity.on('init', user => {
            console.log('Netlify Identity 初始化:', user);
            if (user) {
                handleNetlifyLogin(user);
            }
        });
    }
}); 