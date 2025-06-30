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

// 初始化Netlify Identity
if (window.netlifyIdentity) {
    // 检查当前页面是否是登录页面
    const isLoginPage = window.location.pathname.includes('index.html') || window.location.pathname === '/';
    
    window.netlifyIdentity.on("init", user => {
        // 检查是否正在退出
        const isLoggingOut = sessionStorage.getItem('isLoggingOut');
        if (isLoggingOut) {
            sessionStorage.removeItem('isLoggingOut');
            localStorage.removeItem('userInfo');
            window.netlifyIdentity.signout();
            return;
        }

        if (!user) {
            // 未登录状态，清除所有存储的登录信息
            localStorage.removeItem('userInfo');
            sessionStorage.removeItem('fromRegister');
            if (!isLoginPage) {
                window.location.href = 'index.html';
            }
            return;
        }
        
        // 检查是否是从注册页面跳转来的
        const isFromRegister = sessionStorage.getItem('fromRegister');
        if (isFromRegister) {
            sessionStorage.removeItem('fromRegister');
            return;
        }

        // 如果已登录且在登录页面，则跳转到相应页面
        if (isLoginPage) {
            const userType = user.user_metadata?.type || 'user';
            redirectToHome(userType);
        }
    });

    // 添加登录成功事件监听
    window.netlifyIdentity.on("login", user => {
        const userType = user.user_metadata?.type || 'user';
        // 设置用户信息到localStorage
        localStorage.setItem('userInfo', JSON.stringify({
            username: user.email,
            userType: userType,
            userId: user.id,
            loginTime: new Date().getTime()
        }));
        redirectToHome(userType);
    });

    // 添加退出事件监听
    window.netlifyIdentity.on("logout", () => {
        console.log("用户退出");
        sessionStorage.setItem('isLoggingOut', 'true');
        localStorage.removeItem('userInfo');
        // 确保清除Netlify Identity的状态
        window.netlifyIdentity.logout();
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 100);
    });
}

// 添加退出函数
function logout() {
    if (window.netlifyIdentity) {
        sessionStorage.setItem('isLoggingOut', 'true');
        // 先清除本地存储
        localStorage.removeItem('userInfo');
        sessionStorage.removeItem('fromRegister');
        // 然后调用Netlify退出
        window.netlifyIdentity.logout();
    } else {
        // 本地登录的退出处理
        localStorage.removeItem('userInfo');
        window.location.href = 'index.html';
    }
}

// 在页面加载完成后添加事件监听器
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            
            // 清除之前的错误信息
            clearErrors();
            
            // 简单的验证
            if (!username || !password) {
                if (!username) showError('usernameError', '请输入用户名');
                if (!password) showError('passwordError', '请输入密码');
                return;
            }
            
            try {
                console.log('发送登录请求:', {
                    url: `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.LOGIN}`,
                    userType: currentLoginType,
                    username
                });
                
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
                
                console.log('收到响应:', {
                    status: response.status,
                    statusText: response.statusText
                });
                
                const data = await response.json();
                console.log('响应数据:', data);
                
                if (!response.ok) {
                    throw new Error(data.message || '登录失败');
                }
                
                if (data.success) {
                    // 保存用户信息到localStorage
                    localStorage.setItem('userInfo', JSON.stringify(data.user));
                    
                    // 根据用户类型跳转到不同页面
                    if (data.user.userType === 'merchant') {
                        console.log('商家登录成功，跳转到商家管理页面');
                        // 确保清除任何可能导致循环的状态
                        sessionStorage.removeItem('loginRedirect');
                        window.location.replace('merchant_dashboard.html');
                    } else {
                        console.log('用户登录成功，跳转到主页');
                        window.location.replace('main.html');
                    }
                    return; // 确保不会继续执行
                }
            } catch (error) {
                console.error('登录错误:', error);
                console.error('错误详情:', error.message);
                if (error.message.includes('用户名不存在')) {
                    showError('usernameError', '用户名不存在');
                } else if (error.message.includes('密码错误')) {
                    showError('passwordError', '密码错误');
                } else if (error.message.includes('商家账号')) {
                    showError('usernameError', '此账号是商家账号，请使用商家登录');
                } else if (error.message.includes('用户账号')) {
                    showError('usernameError', '此账号是用户账号，请使用用户登录');
                } else {
                    showError('passwordError', `登录失败: ${error.message}`);
                }
            }
        });
    }
});

// 重定向到主页
function redirectToHome(userType) {
    // 防止重复跳转
    const currentPage = window.location.pathname;
    const targetPage = userType === 'merchant' ? 'merchant_dashboard.html' : 'main.html';
    
    if (!currentPage.includes(targetPage)) {
        // 添加延时确保状态已经完全更新
        setTimeout(() => {
            window.location.href = targetPage;
        }, 100);
    }
}

function showError(elementId, message) {
    document.getElementById(elementId).textContent = message;
}

function clearErrors() {
    document.getElementById('usernameError').textContent = '';
    document.getElementById('passwordError').textContent = '';
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