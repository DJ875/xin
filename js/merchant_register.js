// 本地商家注册
document.getElementById('merchantRegisterForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    // 获取表单数据
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const businessName = document.getElementById('businessName').value;
    
    // 重置错误信息
    clearErrors();
    
    // 表单验证
    if (!validateForm(username, password, confirmPassword, businessName)) {
        return;
    }
    
    try {
        // 使用本地API进行商家注册
        const response = await fetch('http://localhost:3000/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username,
                password,
                userType: 'merchant',
                businessName
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || '注册失败');
        }
        
        if (data.success) {
            alert('本地商家注册成功！');
            window.location.href = 'index.html';
        } else {
            throw new Error(data.message || '注册失败');
        }
    } catch (error) {
        console.error('注册错误:', error);
        showError('registerError', error.message || '注册失败，请稍后重试');
    }
});

// Netlify注册处理
function netlifyRegister() {
    // 获取商家名称
    const businessName = document.getElementById('businessName').value;
    if (!businessName) {
        showMessage('请输入商家名称', 'error');
        return;
    }

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
            logo: 'images/merchant-logo.png',
            title: '商家注册',
            labels: {
                login: '商家登录',
                signup: '商家注册',
                email: '邮箱',
                password: '密码',
                button: '确定'
            }
        }
    });
    
    // 保存商家名称
    sessionStorage.setItem('businessName', businessName);
    
    // 监听注册事件
    window.netlifyIdentity.on('signup', user => {
        showMessage('注册成功，请查收邮件并确认注册', 'success');
    });

    // 监听确认事件
    window.netlifyIdentity.on('confirm', user => {
        const businessName = sessionStorage.getItem('businessName');
        
        // 注册到本地系统
        fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.REGISTER}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: user.email,
                userType: 'merchant',
                businessName: businessName,
                netlifyToken: user.token.access_token
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // 清除临时数据
                sessionStorage.removeItem('businessName');
                
                showMessage('注册成功，即将跳转到登录页面...', 'success');
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 2000);
            } else {
                throw new Error(data.message || '注册失败');
            }
        })
        .catch(error => {
            console.error('注册错误:', error);
            showMessage(error.message || '注册失败，请稍后重试', 'error');
            // 清除临时数据
            sessionStorage.removeItem('businessName');
        });
    });
    
    // 打开注册窗口
    window.netlifyIdentity.open('signup');
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

function validateForm(username, password, confirmPassword, businessName) {
    let isValid = true;
    
    // 商家名称验证
    if (!businessName || businessName.length < 2) {
        showError('businessNameError', '商家名称至少需要2个字符');
        isValid = false;
    }
    
    // 用户名验证
    if (!username || username.length < 3) {
        showError('usernameError', '用户名至少需要3个字符');
        isValid = false;
    }
    
    // 密码验证
    if (!password || password.length < 6) {
        showError('passwordError', '密码至少需要6个字符');
        isValid = false;
    }
    
    // 确认密码验证
    if (password !== confirmPassword) {
        showError('confirmPasswordError', '两次输入的密码不一致');
        isValid = false;
    }
    
    return isValid;
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