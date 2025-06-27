// 获取用户信息
function getUserInfo() {
    const userInfo = localStorage.getItem('userInfo');
    return userInfo ? JSON.parse(userInfo) : null;
}

// 更新页面上的用户名显示
function updateUserDisplay() {
    const userInfo = getUserInfo();
    const userWelcome = document.querySelector('.user-welcome');
    const logoutLink = document.querySelector('.logout');
    
    if (userInfo) {
        userWelcome.textContent = userInfo.username;
        logoutLink.textContent = '退出登录';
    } else {
        window.location.href = 'index.html'; // 如果未登录，重定向到登录页
    }
}

// 购物车类
class ShoppingCart {
    constructor() {
        this.items = JSON.parse(localStorage.getItem('cartItems')) || [];
        this.init();
    }

    init() {
        // 创建购物车浮窗
        this.createCartWindow();
        // 更新购物车显示
        this.updateCartDisplay();
    }

    createCartWindow() {
        const cartHtml = `
            <div class="cart-window" id="cartWindow">
                <div class="cart-header">
                    <h3>购物车</h3>
                    <button class="toggle-cart" onclick="toggleCart()">▼</button>
                </div>
                <div class="cart-content">
                    <div class="cart-items" id="cartItems"></div>
                    <div class="cart-footer">
                        <div class="cart-total">总计: ¥<span id="cartTotal">0.00</span></div>
                        <button class="checkout-btn" onclick="checkout()">结算</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', cartHtml);
    }

    addItem(item) {
        const existingItem = this.items.find(i => i.id === item.id);
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            this.items.push({...item, quantity: 1});
        }
        this.saveToLocalStorage();
        this.updateCartDisplay();
    }

    removeItem(itemId) {
        this.items = this.items.filter(item => item.id !== itemId);
        this.saveToLocalStorage();
        this.updateCartDisplay();
    }

    updateQuantity(itemId, quantity) {
        const item = this.items.find(i => i.id === itemId);
        if (item) {
            item.quantity = quantity;
            if (quantity <= 0) {
                this.removeItem(itemId);
            }
        }
        this.saveToLocalStorage();
        this.updateCartDisplay();
    }

    saveToLocalStorage() {
        localStorage.setItem('cartItems', JSON.stringify(this.items));
    }

    updateCartDisplay() {
        const cartItems = document.getElementById('cartItems');
        const cartTotal = document.getElementById('cartTotal');
        
        cartItems.innerHTML = this.items.map(item => `
            <div class="cart-item">
                <img src="${item.image}" alt="${item.name}">
                <div class="item-details">
                    <h4>${item.name}</h4>
                    <p>¥${item.price}</p>
                    <div class="quantity-controls">
                        <button onclick="cart.updateQuantity('${item.id}', ${item.quantity - 1})">-</button>
                        <span>${item.quantity}</span>
                        <button onclick="cart.updateQuantity('${item.id}', ${item.quantity + 1})">+</button>
                    </div>
                </div>
                <button class="remove-item" onclick="cart.removeItem('${item.id}')">×</button>
            </div>
        `).join('');

        const total = this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        cartTotal.textContent = total.toFixed(2);
    }
}

// 商品详情弹窗
function showProductDetail(product) {
    const modal = document.createElement('div');
    modal.className = 'product-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close-modal" onclick="this.parentElement.parentElement.remove()">&times;</span>
            <div class="product-detail">
                <img src="${product.image}" alt="${product.name}">
                <div class="detail-info">
                    <h2>${product.name}</h2>
                    <p class="price">¥${product.price}</p>
                    <p class="description">${product.description || '暂无描述'}</p>
                    <p class="merchant-info">商家：${product.merchantName || '平台自营'}</p>
                    ${product.uploadTime ? `<p class="upload-time">上架时间：${new Date(product.uploadTime).toLocaleString()}</p>` : ''}
                    <button onclick="addToCart(${JSON.stringify(product).replace(/"/g, '&quot;')})">加入购物车</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// 添加商品到购物车
function addToCart(product) {
    // 创建蓝色主题动画元素
    const animationEl = document.createElement('div');
    animationEl.className = 'add-to-cart-animation';
    animationEl.innerHTML = `
        <div class="cart-icon-wrapper">
            <div class="cart-icon">🛒</div>
        </div>
    `;
    document.body.appendChild(animationEl);

    // 获取位置信息
    const productCard = event.target.closest('.product-card, .modal-content');
    const startRect = productCard.getBoundingClientRect();
    const cartWindow = document.querySelector('.cart-window');
    const endRect = cartWindow.getBoundingClientRect();

    // 设置起始位置
    animationEl.style.top = `${startRect.top}px`;
    animationEl.style.left = `${startRect.left}px`;

    // 触发动画
    requestAnimationFrame(() => {
        animationEl.style.top = `${endRect.top}px`;
        animationEl.style.left = `${endRect.left}px`;
        animationEl.style.opacity = '0';
        animationEl.style.transform = 'scale(0.2) rotate(360deg)';
    });

    // 动画结束后处理
    setTimeout(() => {
        animationEl.remove();
        cart.addItem(product);
        
        // 创建蓝色主题提示
        const toast = document.createElement('div');
        toast.className = 'cart-toast-notification';
        toast.innerHTML = `
            <div class="toast-icon">✓</div>
            <div class="toast-message">已添加到购物车</div>
        `;
        document.body.appendChild(toast);
        
        // 自动消失
        setTimeout(() => toast.remove(), 3000);
    }, 800);
}

// 动态添加CSS样式
const style = document.createElement('style');
style.textContent = `
/* 动画元素样式 - 蓝色主题 */
.add-to-cart-animation {
    position: fixed;
    z-index: 9999;
    pointer-events: none;
    transition: all 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.cart-icon-wrapper {
    background: linear-gradient(135deg, #4d94ff, #0066cc); /* 蓝色渐变背景 */
    border-radius: 50%;
    width: 50px;
    height: 50px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 15px rgba(0, 102, 204, 0.5); /* 蓝色阴影 */
    animation: pulse 0.5s ease-out;
}

.cart-icon {
    font-size: 28px;
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
}

/* 提示信息样式 - 蓝色主题 */
.cart-toast-notification {
    position: fixed;
    top: 30px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(to right, #3399ff, #0066cc); /* 蓝色渐变 */
    color: white;
    padding: 15px 30px;
    border-radius: 50px;
    z-index: 1000;
    display: flex;
    align-items: center;
    gap: 12px;
    box-shadow: 0 6px 20px rgba(0, 102, 204, 0.4);
    border: 2px solid #99ccff;
    animation: slideIn 0.3s ease-out;
}

.toast-icon {
    font-size: 24px;
    font-weight: bold;
    text-shadow: 0 2px 3px rgba(0,0,0,0.3);
}

.toast-message {
    font-size: 18px;
    font-weight: bold;
    letter-spacing: 0.5px;
}

/* 动画效果 */
@keyframes pulse {
    0% { transform: scale(0.8); opacity: 0.7; }
    70% { transform: scale(1.2); opacity: 1; }
    100% { transform: scale(1); }
}

@keyframes slideIn {
    from { top: -50px; opacity: 0; }
    to { top: 30px; opacity: 1; }
}
`;
document.head.appendChild(style);

// 切换购物车显示/隐藏
function toggleCart() {
    const cartContent = document.querySelector('.cart-content');
    const toggleBtn = document.querySelector('.toggle-cart');
    cartContent.style.display = cartContent.style.display === 'none' ? 'block' : 'none';
    toggleBtn.textContent = cartContent.style.display === 'none' ? '▼' : '▲';
}

// 结算功能
function checkout() {
    alert('结算功能正在开发中...');
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    updateUserDisplay();
    window.cart = new ShoppingCart();
});
// 商品分类点击事件
document.querySelectorAll('.category-item').forEach(item => {
    item.addEventListener('click', function() {
        const category = this.querySelector('span').textContent;
        // 这里可以添加分类跳转逻辑
        const categoryUrls = {
            '服装':'fuzhuang.html',
            '潮鞋': 'chaoxie.html',
            '零食': 'lingshi.html',
            '家具': 'jiaju.html',
            '电脑外设': 'dnws.html',
            '手机': 'shouji.html',
            '数码产品': 'smcp.html',
            '耳机': 'erji.html',
            '平板电脑': 'pbdn.html',
            '电脑': 'diannao.html',
            '上衣': 'shangyi.html',
            '裤子': 'kuzi.html',
            '休闲鞋': 'xie.html',
            '篮球鞋': 'lqx.html',
            '家电': 'jiaju.html',
            '生活用品': 'jiaju.html'
        };

        // 获取对应分类的URL
        const targetUrl = categoryUrls[category];

        if (targetUrl) {
            // 执行页面跳转
            window.location.href = targetUrl;

            // 控制台日志（实际部署时可移除）
            console.log(`正在跳转到 ${category} 分类页面: ${targetUrl}`);
        } else {
            // 处理未匹配分类的情况
            console.warn(`未找到 ${category} 分类的跳转路径`);

            // 可选：显示错误提示
            alert(`抱歉，${category}分类暂不可用`);
        }
    });

    // 添加悬停效果提升用户体验
    item.addEventListener('mouseenter', () => {
        item.style.transform = 'scale(1.05)';
        item.style.transition = 'transform 0.3s ease';
    });

    item.addEventListener('mouseleave', () => {
        item.style.transform = 'scale(1)';
    });
});