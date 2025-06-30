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
function netlifySignup() {
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
    
    // 设置注册信息
    sessionStorage.setItem('registration', JSON.stringify({
        userType: 'user',  // 用户注册页面默认为普通用户
        registrationTime: new Date().getTime()
    }));
    
    // 配置Netlify Identity
    window.netlifyIdentity.init({
        locale: 'zh'
    });

    // 注册事件监听
    window.netlifyIdentity.on('signup', user => {
        // 添加用户信息
        user.updateProfile({
            data: {
                type: 'user'  // 用户注册页面默认为普通用户
            }
        }).then(() => {
            // 使用Netlify API注册用户
            return fetch('/.netlify/functions/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: user.email,
                    userType: 'user'
                })
            });
        }).then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('Netlify注册成功！');
                // 清除临时数据
                sessionStorage.removeItem('registration');
                window.location.href = 'index.html';
            } else {
                throw new Error(data.message || '用户信息注册失败');
            }
        }).catch(error => {
            console.error('注册用户信息失败:', error);
            showError('registerError', '注册失败: ' + error.message);
            // 清除临时数据
            sessionStorage.removeItem('registration');
            // 删除Netlify用户
            user.delete().catch(console.error);
        });
    });

    window.netlifyIdentity.on('error', err => {
        console.error('Netlify Identity错误:', err);
        showError('registerError', '注册失败: ' + err.message);
        sessionStorage.removeItem('registration');
    });
    
    // 打开Netlify注册窗口
    window.netlifyIdentity.open('signup');
}

function validateForm(username, password, confirmPassword) {
    let isValid = true;
    
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