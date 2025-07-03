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

// 搜索商品（新版，调用后端）
async function searchProducts(keyword){
    try{
        const res = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PRODUCTS}?kw=${encodeURIComponent(keyword)}`);
        const products = await res.json();
        document.getElementById('resultCount').textContent = products.length;
        const resultsGrid = document.getElementById('searchResults');
        if(products.length===0){
            resultsGrid.innerHTML = `<div class="no-results"><h3>未找到相关商品</h3><p>试试其他关键词吧</p></div>`;
            return; }
        resultsGrid.innerHTML = products.map(p=>`
            <div class="product-card" onclick="showProductDetail(${JSON.stringify({id:p.id,name:p.name,price:p.price,discount:p.discount,image:p.image_url,description:p.description,merchantName:p.merchantName||'平台自营'}).replace(/"/g,'&quot;')})">
                ${p.discount && p.discount < 100 ? `<div class="discount-tag">${p.discount}% OFF</div>`:''}
                <img src="${p.image_url}" alt="${p.name}">
                <h3>${p.name}</h3>
                <p class="price">¥${(p.discount<100?p.price*p.discount/100:p.price).toFixed(2)}</p>
            </div>`).join('');
    }catch(err){ console.error('搜索失败', err); }
} 