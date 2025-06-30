// 获取登录用户信息
document.addEventListener('DOMContentLoaded', function() {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const currentUser = localStorage.getItem('currentUser');
    const userWelcome = document.querySelector('.user-welcome');
    const logoutLink = document.querySelector('.logout');
    
    if (currentUser && userWelcome && logoutLink) {
        const user = users.find(u => u.username === currentUser);
        if (user) {
            userWelcome.textContent = `欢迎，${user.username}`;
            logoutLink.textContent = '退出登录';
        }
        
        // 退出登录
        logoutLink.addEventListener('click', function(e) {
            if (currentUser) {
                e.preventDefault();
                localStorage.removeItem('currentUser');
                window.location.href = 'index.html';
            }
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
        this.banner = document.querySelector('.banner');
        this.prevBtn = document.querySelector('.carousel-controls .prev');
        this.nextBtn = document.querySelector('.carousel-controls .next');
        
        // 检查必要的元素是否存在
        if (!this.banner || !this.prevBtn || !this.nextBtn) {
            console.log('轮播图元素未找到');
            return;
        }
        
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

// 初始化轮播图
document.addEventListener('DOMContentLoaded', function() {
    carousel.init();
    
    // 商品分类点击事件
    const categoryItems = document.querySelectorAll('.category-item');
    if (categoryItems) {
        categoryItems.forEach(item => {
            item.addEventListener('click', function() {
                const categorySpan = this.querySelector('span');
                if (!categorySpan) return;
                
                const category = categorySpan.textContent;
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
    if (productCards) {
        productCards.forEach(card => {
            card.addEventListener('click', function() {
                const productName = this.querySelector('h3')?.textContent;
                if (productName) {
                    console.log(`查看${productName}详情`);
                }
            });
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