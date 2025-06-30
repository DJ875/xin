// 本地注册
document.getElementById('registerForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    // 获取表单数据
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    // 重置错误信息
    clearErrors();
    
    // 表单验证
    if (!validateForm(username, password, confirmPassword)) {
        return;
    }
    
    try {
        // 使用本地API进行注册
        const response = await fetch('http://localhost:3000/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username,
                password,
                userType: 'user'  // 用户注册页面默认为普通用户
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || '注册失败');
        }
        
        if (data.success) {
            alert('本地注册成功！');
            window.location.href = 'index.html';
        } else {
            throw new Error(data.message || '注册失败');
        }
    } catch (error) {
        console.error('注册错误:', error);
        showError('registerError', error.message || '注册失败，请稍后重试');
    }
});

// Netlify注册
function netlifyRegister() {
    // 初始化Netlify Identity
    window.netlifyIdentity.init({
        locale: 'zh'
    });

    // 配置Netlify Identity Widget
    const container = document.querySelector('#netlify-modal') || document.body;
    window.netlifyIdentity.setConfig({
        locale: 'zh',
        container: container,
        theme: {
            mode: 'light',
            logo: 'images/user-logo.png',
            title: '用户注册',
            labels: {
                login: '用户登录',
                signup: '用户注册',
                email: '邮箱',
                password: '密码',
                button: '确定'
            }
        }
    });
    
    // 监听注册事件
    window.netlifyIdentity.on('signup', user => {
        showMessage('注册成功，请查收邮件并确认注册', 'success');
    });

    // 监听确认事件
    window.netlifyIdentity.on('confirm', user => {
        // 注册到本地系统
        fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.REGISTER}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: user.email,
                userType: 'user',
                netlifyToken: user.token.access_token
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showMessage('注册成功，即将跳转到登录页面...', 'success');
                // 设置注册类型，用于登录页面自动选择登录方式
                sessionStorage.setItem('registrationType', 'netlify');
                setTimeout(() => {
                    window.location.replace('index.html');
                }, 2000);
            } else {
                throw new Error(data.message || '注册失败');
            }
        })
        .catch(error => {
            console.error('注册错误:', error);
            showMessage(error.message || '注册失败，请稍后重试', 'error');
        });
    });
    
    // 打开注册窗口
    window.netlifyIdentity.open('signup');
}

// 本地注册处理
function localRegister() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    clearErrors();
    
    if (!validateForm(username, password, confirmPassword)) {
        return;
    }
    
    // 使用API注册
    fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.REGISTER}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            username,
            password,
            userType: 'user',
            loginType: 'local'
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showMessage('注册成功，即将跳转到登录页面...', 'success');
            // 设置注册类型，用于登录页面自动选择登录方式
            sessionStorage.setItem('registrationType', 'local');
            setTimeout(() => {
                window.location.replace('index.html');
            }, 2000);
        } else {
            throw new Error(data.message || '注册失败');
        }
    })
    .catch(error => {
        console.error('注册错误:', error);
        showMessage(error.message || '注册失败，请稍后重试', 'error');
    });
}

function validateForm(username, password, confirmPassword) {
    if (!username || !password || !confirmPassword) {
        if (!username) showError('usernameError', '请输入用户名');
        if (!password) showError('passwordError', '请输入密码');
        if (!confirmPassword) showError('confirmPasswordError', '请确认密码');
        return false;
    }
    
    if (password !== confirmPassword) {
        showError('confirmPasswordError', '两次输入的密码不一致');
        return false;
    }
    
    return true;
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

// 显示消息
function showMessage(message, type = 'error') {
    const messageElement = document.getElementById('message');
    if (messageElement) {
        messageElement.textContent = message;
        messageElement.className = `message ${type}`;
        messageElement.style.display = 'block';
    }
} 
} 