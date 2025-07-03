// 清理旧的 Node.js 代码，仅保留浏览器端逻辑

// 初始化 Netlify Identity
const netlifyIdentity = window.netlifyIdentity;

// API 配置
const { BASE_URL: REG_BASE, ENDPOINTS } = API_CONFIG; // ENDPOINTS.REGISTER 指向 /register

// 读取并转换头像文件为 base64
async function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// 本地注册处理（商家）
window.localRegister = async function () {
  clearErrors();

  // 获取表单数据
  const businessName = document.getElementById('businessName').value.trim();
  const businessTypes = Array.from(
    document.querySelectorAll('input[name="businessType"]:checked')
  ).map(cb => cb.value);

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const confirm = document.getElementById('confirmPassword').value;

  // 头像文件
  const avatarFile = document.getElementById('avatar')?.files?.[0] || null;
  let avatarBase64 = null;
  if (avatarFile) {
    avatarBase64 = await toBase64(avatarFile);
  }

  // 基本验证
  if (!validateForm(businessName, businessTypes, username, password, confirm)) return;

  try {
    const res = await fetch(`${REG_BASE}${ENDPOINTS.REGISTER}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userType: 'merchant',
        businessName,
        businessTypes,
        username,
        password,
        avatar: avatarBase64
      })
    });
    const data = await res.json();
    if (data.success) {
      alert('注册成功，请登录');
      window.location.replace('index.html');
    } else {
      showError('registerError', data.message || '注册失败');
    }
  } catch (e) {
    console.error('注册错误:', e);
    showError('registerError', '服务器错误');
  }
};

// Netlify 注册
window.netlifySignup = function () {
  const businessName = document.getElementById('businessName').value.trim();
  const businessTypes = Array.from(
    document.querySelectorAll('input[name="businessType"]:checked')
  ).map(cb => cb.value);

  if (!validateBusinessInfo(businessName, businessTypes)) return;

  // 保存到 sessionStorage，在 login 页同步到服务器
  sessionStorage.setItem('businessName', businessName);
  sessionStorage.setItem('businessTypes', JSON.stringify(businessTypes));
  sessionStorage.setItem('registrationType', 'netlify-merchant');

  netlifyIdentity.open('signup');
  netlifyIdentity.on('signup', () => {
    alert('注册成功，请查收验证邮件');
    setTimeout(() => (window.location.href = 'index.html'), 3000);
  });
};

function validateForm(businessName, businessTypes, username, password, confirmPassword) {
  let ok = true;
  if (!validateBusinessInfo(businessName, businessTypes)) ok = false;
  if (!username) { showError('usernameError', '请输入用户名'); ok = false; }
  if (!password) { showError('passwordError', '请输入密码'); ok = false; }
  else if (password.length < 6) { showError('passwordError', '密码至少6位'); ok = false; }
  if (password !== confirmPassword) { showError('confirmPasswordError', '两次输入不一致'); ok = false; }
  return ok;
}

function validateBusinessInfo(name, types) {
  let ok = true;
  if (!name) { showError('businessNameError', '请输入商家名称'); ok = false; }
  if (types.length === 0) { showError('businessTypeError', '至少选择一种经营类型'); ok = false; }
  return ok;
}

function clearErrors() {
  document.querySelectorAll('.error-message').forEach(el => (el.textContent = ''));
}

function showError(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg;
}

// 给表单动态加头像输入
document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('#merchantRegisterForm .login-form');
  if (form && !document.getElementById('avatar')) {
    const avatarGroup = document.createElement('div');
    avatarGroup.className = 'form-group';
    avatarGroup.innerHTML = `
      <input type="file" id="avatar" accept="image/*">
      <div class="error-message" id="avatarError"></div>
    `;
    const ref = form.querySelector('.error-message');
    if (ref) form.insertBefore(avatarGroup, ref); else form.appendChild(avatarGroup);
  }
}); 