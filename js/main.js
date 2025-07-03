// ===== 占位: 加载商品 =====
function loadProducts(){
    // TODO: 后续可通过 fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PRODUCTS}`) 获取商品
    console.log('loadProducts() 被调用 - 这是占位实现');
}

// 获取登录用户信息
document.addEventListener('DOMContentLoaded', function() {
    const userInfo = localStorage.getItem('userInfo');
    const userWelcome = document.querySelector('.user-welcome');
    const logoutLink = document.querySelector('.logout');
    
    if (!userInfo) {
        // 如果未登录，重定向到登录页面
        window.location.replace('index.html');
        return;
    }

    const user = JSON.parse(userInfo);
    // 检查登录是否过期
    const loginTime = user.loginTime;
    const currentTime = new Date().getTime();
    if (currentTime - loginTime > 24 * 60 * 60 * 1000) {
        // 登录已过期，清除用户信息并跳转到登录页面
        localStorage.clear();
        sessionStorage.clear();
        window.location.replace('index.html');
        return;
    }

    // 检查用户类型
    if (user.userType === 'merchant') {
        alert('商家用户请使用商家管理界面');
        window.location.replace('merchant_dashboard.html');
        return;
    }

    // 更新用户界面
    if (userWelcome && user) {
        userWelcome.textContent = `欢迎，${user.username}`;
    }

    // 添加退出登录事件监听
    if (logoutLink) {
        logoutLink.addEventListener('click', function(e) {
            e.preventDefault();
            logout();
        });
    }
});

// 轮播图功能
const carousel = {
    currentSlide: 0,
    slides: [
        'images/9.jpg',
        'images/11.png',
        'images/12.png'
    ],
    init: function() {
        // 检查必要的元素是否存在
        const banner = document.querySelector('.banner');
        const prevBtn = document.querySelector('.carousel-controls .prev');
        const nextBtn = document.querySelector('.carousel-controls .next');
        
        if (!banner || !prevBtn || !nextBtn) {
            console.log('轮播图元素未找到');
            return;
        }

        this.banner = banner;
        this.prevBtn = prevBtn;
        this.nextBtn = nextBtn;
        
        // 绑定事件监听器
        this.prevBtn.addEventListener('click', () => this.showSlide('prev'));
        this.nextBtn.addEventListener('click', () => this.showSlide('next'));
        
        // 自动轮播
        setInterval(() => this.showSlide('next'), 5000);
    },
    showSlide: function(direction) {
        if (!this.banner) return;
        
        if (direction === 'next') {
            this.currentSlide = (this.currentSlide + 1) % this.slides.length;
        } else {
            this.currentSlide = (this.currentSlide - 1 + this.slides.length) % this.slides.length;
        }
        this.banner.src = this.slides[this.currentSlide];
    }
};

// 初始化所有功能
document.addEventListener('DOMContentLoaded', function() {
    // 初始化轮播图
    try {
        carousel.init();
    } catch (error) {
        console.log('轮播图初始化失败:', error);
    }
    
    // 商品分类点击事件
    const categoryItems = document.querySelectorAll('.category-item');
    if (categoryItems && categoryItems.length > 0) {
        categoryItems.forEach(item => {
            item.addEventListener('click', function() {
                const categorySpan = this.querySelector('span');
                if (!categorySpan) return;
                
                const category = categorySpan.textContent;
                const categoryUrls = {
                    '服装': 'fuzhuang.html',
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

                const targetUrl = categoryUrls[category];
                if (targetUrl) {
                    window.location.href = targetUrl;
                    console.log(`正在跳转到 ${category} 分类页面: ${targetUrl}`);
                } else {
                    console.warn(`未找到 ${category} 分类的跳转路径`);
                    alert(`抱歉，${category}分类暂不可用`);
                }
            });

            // 添加悬停效果
            item.addEventListener('mouseenter', () => {
                item.style.transform = 'scale(1.05)';
                item.style.transition = 'transform 0.3s ease';
            });

            item.addEventListener('mouseleave', () => {
                item.style.transform = 'scale(1)';
            });
        });
    }

    // 商品卡片点击事件
    const productCards = document.querySelectorAll('.product-card');
    if (productCards && productCards.length > 0) {
        productCards.forEach(card => {
            // 检查是否已经有点击事件
            if (!card.hasClickEvent) {
                card.hasClickEvent = true;
                card.addEventListener('click', function(e) {
                    // 阻止事件冒泡，避免重复触发
                    e.stopPropagation();
                    const productName = this.querySelector('h3')?.textContent;
                    if (productName) {
                        console.log(`查看${productName}详情`);
                    }
                });
            }
        });
    }

    // 搜索功能
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                performSearch();
            }
        });
    }
});

// 搜索功能
function performSearch() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;
    
    const keyword = searchInput.value.trim();
    if (keyword) {
        window.location.href = `search.html?keyword=${encodeURIComponent(keyword)}`;
    }
}

// 页面加载时检查登录状态
window.addEventListener('DOMContentLoaded', function() {
    loadProducts();
});

// 检查登录状态
function checkLoginStatus() {
    const userInfo = localStorage.getItem('userInfo');
    if (!userInfo) {
        window.location.replace('index.html');
        return;
    }
    
    const user = JSON.parse(userInfo);
    // 检查登录是否过期
    const loginTime = user.loginTime;
    const currentTime = new Date().getTime();
    if (currentTime - loginTime > 24 * 60 * 60 * 1000) {
        // 登录已过期，清除用户信息并跳转到登录页面
        localStorage.clear();
        sessionStorage.clear();
        window.location.replace('index.html');
        return;
    }

    // 检查用户类型
    if (user.userType === 'merchant') {
        alert('商家用户请使用商家管理界面');
        window.location.replace('merchant_dashboard.html');
        return;
    }

    // 更新用户界面
    updateUserInterface(user);
}

// 更新用户界面
function updateUserInterface(user) {
    // 显示用户名
    const usernameElement = document.getElementById('username');
    if (usernameElement) {
        usernameElement.textContent = user.username;
    }
} 