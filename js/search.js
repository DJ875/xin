// 页面加载时从URL获取搜索关键词
document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const keyword = urlParams.get('keyword');
    
    if (keyword) {
        document.getElementById('searchInput').value = keyword;
        document.getElementById('searchKeyword').textContent = keyword;
        searchProducts(keyword);
    }
});

// 搜索功能
function performSearch() {
    const keyword = document.getElementById('searchInput').value.trim();
    if (keyword) {
        window.location.href = `search.html?keyword=${encodeURIComponent(keyword)}`;
    }
}

// 监听回车键
document.getElementById('searchInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        performSearch();
    }
});

// 搜索商品
function searchProducts(keyword) {
    // 获取所有商家的商品
    const merchants = JSON.parse(localStorage.getItem('merchants') || '[]');
    let allProducts = [];
    
    merchants.forEach(merchant => {
        if (merchant.products) {
            allProducts = allProducts.concat(merchant.products.map(product => ({
                ...product,
                merchantName: merchant.businessName
            })));
        }
    });
    
    // 搜索匹配的商品
    const results = allProducts.filter(product => {
        const searchText = `${product.name} ${product.description} ${product.merchantName}`.toLowerCase();
        return searchText.includes(keyword.toLowerCase());
    });
    
    // 更新结果数量
    document.getElementById('resultCount').textContent = results.length;
    
    // 显示搜索结果
    const resultsGrid = document.getElementById('searchResults');
    
    if (results.length === 0) {
        resultsGrid.innerHTML = `
            <div class="no-results">
                <h3>未找到相关商品</h3>
                <p>试试其他关键词吧</p>
            </div>
        `;
        return;
    }
    
    resultsGrid.innerHTML = results.map(product => `
        <div class="product-card" onclick="showProductDetail(${JSON.stringify(product).replace(/"/g, '&quot;')})">
            ${product.discount && product.discount < 100 ? 
                `<div class="discount-tag">${product.discount}% OFF</div>` : ''}
            <img src="${product.image}" alt="${product.name}">
            <h3>${product.name}</h3>
            <p class="merchant">商家：${product.merchantName}</p>
            ${product.discount && product.discount < 100 ?
                `<p>
                    <span class="original-price">¥${product.price.toFixed(2)}</span>
                    <span class="discounted-price">¥${(product.price * product.discount / 100).toFixed(2)}</span>
                </p>` :
                `<p class="price">¥${product.price.toFixed(2)}</p>`
            }
        </div>
    `).join('');
} 