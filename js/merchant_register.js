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

// Netlify商家注册
function netlifySignup() {
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
    
    // 设置商家注册信息
    sessionStorage.setItem('registration', JSON.stringify({
        userType: 'merchant',
        businessName,
        registrationTime: new Date().getTime()
    }));
    
    // 配置Netlify Identity
    window.netlifyIdentity.init({
        locale: 'zh'
    });

    // 注册事件监听
    window.netlifyIdentity.on('signup', user => {
        // 获取商家注册信息
        const merchantInfo = JSON.parse(sessionStorage.getItem('registration') || '{}');
        
        // 添加商家信息
        user.updateProfile({
            data: {
                type: 'merchant',
                businessName: merchantInfo.businessName
            }
        }).then(() => {
            // 使用Netlify API注册商家
            return fetch('/.netlify/functions/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: user.email,
                    userType: 'merchant',
                    businessName: merchantInfo.businessName
                })
            });
        }).then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('Netlify商家注册成功！');
                // 清除临时数据
                sessionStorage.removeItem('registration');
                window.location.href = 'index.html';
            } else {
                throw new Error(data.message || '商家信息注册失败');
            }
        }).catch(error => {
            console.error('注册商家信息失败:', error);
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