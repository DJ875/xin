let currentLoginType = 'user';

function switchLoginType(type) {
    currentLoginType = type;
    const userBtn = document.getElementById('userLoginBtn');
    const merchantBtn = document.getElementById('merchantLoginBtn');
    const registerLink = document.getElementById('registerLink');
    const merchantRegisterLink = document.getElementById('merchantRegisterLink');
    
    if (type === 'user') {
        userBtn.classList.add('active');
        merchantBtn.classList.remove('active');
        registerLink.style.display = 'block';
        merchantRegisterLink.style.display = 'none';
    } else {
        merchantBtn.classList.add('active');
        userBtn.classList.remove('active');
        registerLink.style.display = 'none';
        merchantRegisterLink.style.display = 'block';
    }
}

// 本地登录处理
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            
            clearErrors();
            
            if (!username || !password) {
                if (!username) showError('usernameError', '请输入用户名');
                if (!password) showError('passwordError', '请输入密码');
                return;
            }
            
            try {
                // 使用配置的API进行登录
                const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.LOGIN}`, {
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
                
                if (!response.ok) {
                    throw new Error(data.message || '登录失败');
                }
                
                if (data.success) {
                    localStorage.setItem('userInfo', JSON.stringify({
                        ...data.user,
                        loginType: 'local'
                    }));
                    
                    // 根据用户类型跳转
                    window.location.href = data.user.userType === 'merchant' ? 'merchant_dashboard.html' : 'main.html';
                }
            } catch (error) {
                console.error('登录错误:', error);
                showError('loginError', error.message || '登录失败，请稍后重试');
            }
        });
    }
    
    // 初始化登录类型
    switchLoginType('user');
});

// Netlify登录处理
function netlifyLogin() {
    // 设置当前登录类型
    sessionStorage.setItem('loginType', currentLoginType);
    
    // 初始化Netlify Identity
    window.netlifyIdentity.init({
        locale: 'zh'
    });
    
    // 监听登录事件
    window.netlifyIdentity.on('login', user => {
        // 获取用户类型
        const userType = sessionStorage.getItem('loginType') || 'user';
        
        // 使用配置的API验证用户
        fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.LOGIN}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: user.email,
                userType: userType,
                netlifyToken: user.token.access_token
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                localStorage.setItem('userInfo', JSON.stringify({
                    ...data.user,
                    loginType: 'netlify',
                    netlifyToken: user.token.access_token
                }));
                
                // 根据用户类型跳转
                window.location.href = userType === 'merchant' ? 'merchant_dashboard.html' : 'main.html';
            } else {
                throw new Error(data.message || '登录验证失败');
            }
        })
        .catch(error => {
            console.error('Netlify登录错误:', error);
            showError('loginError', error.message || '登录失败，请稍后重试');
            window.netlifyIdentity.logout();
        });
    });
    
    // 打开Netlify登录窗口
    window.netlifyIdentity.open('login');
}

// 退出登录
function logout() {
    const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
    
    if (userInfo.loginType === 'netlify' && window.netlifyIdentity) {
        window.netlifyIdentity.logout();
    }
    
    localStorage.removeItem('userInfo');
    sessionStorage.removeItem('loginType');
    window.location.href = 'index.html';
}

function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
}

function clearErrors() {
    const errorElements = document.querySelectorAll('.error-message');
    errorElements.forEach(element => {
        element.textContent = '';
        element.style.display = 'none';
    });
}

// 检查登录状态
function checkLoginStatus() {
    const userInfo = localStorage.getItem('userInfo');
    if (userInfo) {
        const user = JSON.parse(userInfo);
        const loginTime = user.loginTime;
        const currentTime = new Date().getTime();
        
        // 如果登录时间超过24小时，自动登出
        if (currentTime - loginTime > 24 * 60 * 60 * 1000) {
            logout();
            return false;
        }
        return true;
    }
    return false;
}

// 页面加载时检查登录状态
document.addEventListener('DOMContentLoaded', () => {
    if (!checkLoginStatus() && !window.location.pathname.includes('index.html')) {
        window.location.href = 'index.html';
    }
}); 