// js/register.js - 用户注册（Netlify Functions + Netlify Identity）

const netlifyIdentity = window.netlifyIdentity;

// 提取 API 基本配置
const { BASE_URL: REG_BASE, ENDPOINTS: REG_ENDPOINTS } = API_CONFIG;

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('registerForm');
  if (form) form.addEventListener('submit', e => e.preventDefault());
});

async function localRegister() {
  clearErrors();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  const confirmPassword = document.getElementById('confirmPassword').value.trim();

  if (!validate(username, password, confirmPassword)) return;

  try {
    const res = await fetch(`${REG_BASE}${REG_ENDPOINTS.REGISTER}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, userType: 'user' })
    });
    const data = await res.json();
    if (data.success) {
      alert('注册成功，请登录');
      window.location.href = 'index.html';
    } else {
      showError('registerError', data.message);
    }
  } catch (err) {
    console.error(err);
    showError('registerError', '服务器错误，请稍后重试');
  }
}

function netlifySignup() {
  netlifyIdentity.open('signup');
  netlifyIdentity.on('signup', () => alert('注册成功！请查收邮件并确认注册'));
}

function validate(username, password, confirmPassword) {
  let ok = true;
  if (!username) { showError('usernameError', '请输入用户名'); ok = false; }
  if (!password) { showError('passwordError', '请输入密码'); ok = false; }
  else if (password.length < 6) { showError('passwordError', '密码长度至少为6位'); ok = false; }
  if (password !== confirmPassword) { showError('confirmPasswordError', '两次输入的密码不一致'); ok = false; }
  return ok;
}

function showError(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg;
}

function clearErrors() {
  document.querySelectorAll('.error-message').forEach(el => (el.textContent = ''));
}

// 本地注册
document.getElementById('registerForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    // 获取表单数据
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const confirmPassword = document.getElementById('confirmPassword').value.trim();
    
    // 重置错误信息
    clearErrors();
    
    // 表单验证
    if (!validate(username, password, confirmPassword)) {
        return;
    }
    
    // 从localStorage获取现有用户数据
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    
    // 检查用户名是否已存在（不区分大小写）
    if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
        showError('registerError', '用户名已存在');
        return;
    }
    
    // 创建新用户
    const newUser = {
        id: Date.now().toString(),
        username: username,
        password: password,
        userType: 'user',
        created_at: new Date().toISOString()
    };
    
    // 添加新用户并保存
    users.push(newUser);
    localStorage.setItem('users', JSON.stringify(users));
    
    alert('注册成功，请登录');
    window.location.replace('index.html');
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
        fetch(`${REG_BASE}${REG_ENDPOINTS.REGISTER}`, {
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

// 显示消息
function showMessage(message, type = 'error') {
    const messageElement = document.getElementById('message');
    if (messageElement) {
        messageElement.textContent = message;
        messageElement.className = `message ${type}`;
        messageElement.style.display = 'block';
    }
}

// 在search.js中增强搜索功能
function enhancedSearch(keyword, filters) {
    const { category, minPrice, maxPrice, page, pageSize } = filters;
    return fetch(`${API_CONFIG.BASE_URL}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            keyword,
            category,
            priceRange: { min: minPrice, max: maxPrice },
            pagination: { page, pageSize }
        })
    });
}

// 创建统一的API请求处理器
const apiClient = {
    async request(endpoint, options = {}) {
        try {
            const response = await fetch(`${API_CONFIG.BASE_URL}${endpoint}`, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API请求错误:', error);
            throw error;
        }
    }
};

// 监听Netlify注册事件
window.netlifyIdentity.on('signup', user => {
    // 注册成功后自动跳转到登录页面
    window.location.replace('index.html');
}); 
