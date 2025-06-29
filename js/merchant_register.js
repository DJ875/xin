// 本地注册
document.getElementById('merchantRegisterForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const businessName = document.getElementById('businessName').value;
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    // 重置错误信息
    clearErrors();
    
    // 表单验证
    if (!validateForm(businessName, username, password, confirmPassword)) {
        return;
    }
    
    try {
        const response = await fetch('http://localhost:3000/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                username,
                password,
                userType: 'merchant',
                businessName
            })
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.message || '注册失败');
        }

        const data = await response.json();
        
        if (data.success) {
            alert('商家注册成功！');
            window.location.href = 'index.html';
        } else {
            throw new Error(data.message || '注册失败');
        }
    } catch (error) {
        console.error('注册错误:', error);
        if (error.message.includes('已存在')) {
            showError('usernameError', '用户名已存在');
        } else {
            showError('usernameError', error.message || '注册失败，请稍后重试');
        }
    }
});

// Netlify注册
function netlifyMerchantSignup() {
    const businessName = document.getElementById('businessName').value;
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    // 重置错误信息
    clearErrors();
    
    // 表单验证
    if (!validateForm(businessName, username, password, confirmPassword)) {
        return;
    }
    
    // 设置标记，表示这是从注册页面来的
    sessionStorage.setItem('fromRegister', 'true');
    
    // 配置Netlify Identity
    window.netlifyIdentity.init({
        locale: 'zh' // 设置中文语言
    });

    // 注册事件监听
    window.netlifyIdentity.on('signup', user => {
        // 注册成功后的处理
        console.log('注册成功:', user);
        // 添加商家信息
        user.updateProfile({
            data: {
                businessName: businessName,
                userType: 'merchant'
            }
        }).then(() => {
            alert('商家注册成功！');
            window.location.href = 'index.html';
        }).catch(error => {
            console.error('更新用户信息失败:', error);
            showError('usernameError', '注册成功但更新商家信息失败');
            sessionStorage.removeItem('fromRegister');
        });
    });

    window.netlifyIdentity.on('error', err => {
        console.error('Netlify Identity错误:', err);
        showError('usernameError', '注册失败: ' + err.message);
        sessionStorage.removeItem('fromRegister');
    });

    // 打开注册窗口
    window.netlifyIdentity.open('signup');
}

function validateForm(businessName, username, password, confirmPassword) {
    let isValid = true;
    
    if (!businessName) {
        showError('businessNameError', '请输入商家名称');
        isValid = false;
    }
    
    if (username.length < 3) {
        showError('usernameError', '用户名至少需要3个字符');
        isValid = false;
    }
    
    if (password.length < 6) {
        showError('passwordError', '密码至少需要6个字符');
        isValid = false;
    }
    
    if (password !== confirmPassword) {
        showError('confirmPasswordError', '两次输入的密码不一致');
        isValid = false;
    }
    
    return isValid;
}

function showError(elementId, message) {
    document.getElementById(elementId).textContent = message;
}

function clearErrors() {
    document.getElementById('businessNameError').textContent = '';
    document.getElementById('usernameError').textContent = '';
    document.getElementById('passwordError').textContent = '';
    document.getElementById('confirmPasswordError').textContent = '';
} 