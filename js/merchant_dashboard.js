// 初始化 Netlify Identity
const netlifyIdentity = window.netlifyIdentity;

// API配置
const { BASE_URL: DASH_BASE } = API_CONFIG;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', async () => {
    // 检查登录状态
    const userId = localStorage.getItem('userId');
    const userType = localStorage.getItem('userType');

    if (!userId || userType !== 'merchant') {
        window.location.href = 'index.html';
        return;
    }
    
    // 加载商家信息
    await loadMerchantInfo();
    // 加载概览数据
    await loadOverviewData();
    // 加载商品列表
    await loadProducts();
    // 加载订单列表
    await loadOrders();
});

// 切换面板
function switchTab(tabName) {
    // 隐藏所有面板
    document.querySelectorAll('.dashboard-panel').forEach(panel => {
        panel.classList.remove('active');
    });
    
    // 显示选中的面板
    const current = document.getElementById(tabName);
    if(current){ current.classList.add('active'); }
    
    // 更新导航按钮状态
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    const navBtn = document.querySelector(`[onclick="switchTab('${tabName}')"]`);
    if(navBtn){ navBtn.classList.add('active'); }

    // 进入不同面板时动态加载数据
    if(tabName === 'discount'){
        loadDiscountProducts();
    } else if(tabName === 'sales'){
        loadSalesStats();
    }
}

// 兼容HTML中的showSection()
function showSection(name){
    switchTab(name);
}

// 加载商家信息
async function loadMerchantInfo() {
    try {
        const userId = localStorage.getItem('userId');
        const response = await fetch(`${DASH_BASE}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'get_merchant_info',
                userId
            })
        });

        const data = await response.json();
        if (data.success) {
            document.getElementById('merchantName').textContent = data.merchant.business_name;
            
            // 填充设置表单
            document.getElementById('businessName').value = data.merchant.business_name;
            document.getElementById('businessType').value = data.merchant.business_type.split(',');
            document.getElementById('description').value = data.merchant.description || '';
            document.getElementById('contactPhone').value = data.merchant.contact_phone || '';
            document.getElementById('address').value = data.merchant.address || '';
        }
    } catch (error) {
        console.error('加载商家信息失败:', error);
    }
}

// 加载概览数据
async function loadOverviewData() {
    try {
        const userId = localStorage.getItem('userId');
        const response = await fetch(`${DASH_BASE}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'get_merchant_overview',
                userId
            })
        });

        const data = await response.json();
        if (data.success) {
            document.getElementById('todayOrders').textContent = data.todayOrders;
            document.getElementById('todaySales').textContent = `¥${data.todaySales.toFixed(2)}`;
            document.getElementById('totalProducts').textContent = data.totalProducts;
            document.getElementById('pendingOrders').textContent = data.pendingOrders;

            // 加载最近订单
            const recentOrdersList = document.getElementById('recentOrdersList');
            recentOrdersList.innerHTML = data.recentOrders.map(order => `
                <div class="order-item">
                    <div class="order-info">
                        <span class="order-id">订单号：${order.id}</span>
                        <span class="order-time">${new Date(order.created_at).toLocaleString()}</span>
                    </div>
                    <div class="order-amount">¥${order.total_amount.toFixed(2)}</div>
                    <div class="order-status ${order.status}">${getOrderStatusText(order.status)}</div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('加载概览数据失败:', error);
    }
}

// 加载商品列表
async function loadProducts(kw = '') {
    try {
        const userId = localStorage.getItem('userId');
        const response = await fetch(`${DASH_BASE}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'get_merchant_products',
                userId,
                kw
            })
        });

        const data = await response.json();
        if (data.success) {
            const productsList = document.getElementById('productsList');
            productsList.innerHTML = data.products.map(product => `
                <div class="product-card">
                    <img src="${product.image_url}" alt="${product.name}" class="product-image">
                    <div class="product-info">
                    <h3>${product.name}</h3>
                        <p class="product-price">¥${formatPrice(product.price, product.discount)}</p>
                        <p class="product-stock">库存：${product.stock}</p>
                    </div>
                    <div class="product-actions">
                        <button onclick="editProduct(${product.id})" class="edit-button">编辑</button>
                        <button onclick="deleteProduct(${product.id})" class="delete-button">删除</button>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('加载商品列表失败:', error);
    }
}

// 加载订单列表
async function loadOrders(status = 'all', date = '') {
    try {
        const userId = localStorage.getItem('userId');
        const response = await fetch(`${DASH_BASE}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'get_merchant_orders', userId, status, date })
        });
        const data = await response.json();
        if (data.success) {
            const ordersList = document.getElementById('ordersList');
            ordersList.innerHTML = `
                <table>
                    <thead>
                        <tr><th>订单号</th><th>下单时间</th><th>订单金额</th><th>订单状态</th><th>操作</th></tr>
                    </thead>
                    <tbody>
                        ${data.orders.map(order=>`
                            <tr>
                              <td>${order.id}</td>
                              <td>${new Date(order.created_at).toLocaleString()}</td>
                              <td>¥${order.total_amount.toFixed(2)}</td>
                              <td>${getOrderStatusText(order.status)}</td>
                              <td></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>`;
        }
    } catch(err){ console.error('加载订单列表失败:',err); }
}

function searchProducts(){ const kw=document.getElementById('productSearch').value.trim(); loadProducts(kw);}

// 打开/关闭添加商品模态框
function showAddProductModal(){
  document.getElementById('addProductModal').style.display='block';
}

function closeAddProductModal(){
  document.getElementById('addProductModal').style.display='none';
}

// 暴露给 inline onclick
window.showAddProductModal=showAddProductModal;
window.closeAddProductModal=closeAddProductModal;

// ------------------------ 添加商品 ------------------------
const addProductForm = document.getElementById('addProductForm');
if(addProductForm){
    addProductForm.addEventListener('submit', async (e)=>{
        e.preventDefault();
        const name = document.getElementById('productName').value.trim();
        const description = document.getElementById('productDescription').value.trim();
            const price = parseFloat(document.getElementById('productPrice').value);
        const stock = parseInt(document.getElementById('productStock').value,10);
        const category = document.getElementById('productCategory').value;
        const discount = parseInt(document.getElementById('productDiscount').value,10);
        const merchantId = localStorage.getItem('userId');

        // 处理图片
        const fileInput = document.getElementById('productImage');
        const file = fileInput.files[0];
        if(!file){ alert('请选择商品图片'); return; }
        const toBase64 = f => new Promise((resolve, reject)=>{
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(f);
        });
        let imageBase64 = '';
        try{ imageBase64 = await toBase64(file); }catch(err){ console.error('读取图片失败', err); }

        try{
            const res = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PRODUCTS}`, {
                method:'POST',
                headers:{'Content-Type':'application/json'},
                body: JSON.stringify({ name, description, price, stock, category, discount, merchant_id: merchantId, image_url: imageBase64 })
            });
            const data = await res.json();
            if(data.success){
                alert('商品添加成功');
                closeAddProductModal();
                addProductForm.reset();
                        loadProducts();
            }else{
                alert(data.message || '添加失败');
                    }
        }catch(err){ console.error('添加商品失败', err); alert('网络错误'); }
    });
}

// 新增：加载折扣商品列表
async function loadDiscountProducts(){
    try{
        const userId = localStorage.getItem('userId');
        const res = await fetch(`${DASH_BASE}`,{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ action:'get_discount_products', userId })
        });
        const data = await res.json();
        if(data.success){
            const list = document.getElementById('discountProductsList');
            list.innerHTML = data.products.map(prod=>`
                <div class="discount-product-card">
                    <span class="discount-tag">${prod.discount}%</span>
                    <img src="${prod.image_url}" alt="${prod.name}">
                    <h3>${prod.name}</h3>
                    <div class="price">
                        <span class="original-price">¥${prod.price.toFixed(2)}</span>
                        <span class="discounted-price">¥${(prod.price * prod.discount / 100).toFixed(2)}</span>
                    </div>
                    <div class="discount-period">库存：${prod.stock}</div>
                </div>
            `).join('');
        }
    }catch(err){ console.error('加载折扣商品失败:', err); }
}

// 新增：加载销售统计
async function loadSalesStats(){
    try{
        const userId = localStorage.getItem('userId');
        const res = await fetch(`${DASH_BASE}`,{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ action:'get_sales_stats', userId })
        });
        const data = await res.json();
        if(data.success){
            const container = document.getElementById('salesList');
            container.innerHTML = data.stats.map(item=>`
                <div class="sales-item">
                    <img src="${item.image_url}" alt="${item.name}">
                    <div class="sales-info">
                        <h4>${item.name}</h4>
                        <p>总销量：<span class="sales-count">${item.totalSold}</span></p>
                        <p>销售额：¥${item.totalRevenue.toFixed(2)}</p>
                    </div>
                </div>
            `).join('');
        }
    }catch(err){ console.error('加载销售统计失败:', err); }
}

// Fallback：若 common.js 未加载，提供简易 logout
if(typeof window.logout !== 'function'){
    window.logout = function(){
        localStorage.clear();
        sessionStorage.clear();
        window.location.replace('index.html');
    };
}

// 格式化价格（考虑折扣）
function formatPrice(price, discount){
    const final = discount && discount < 100 ? price * discount / 100 : price;
    return final.toFixed(2);
}

function getOrderStatusText(status){
    switch(status){
        case 'pending': return '待处理';
        case 'paid': return '已支付';
        case 'shipped': return '已发货';
        case 'delivered': return '已完成';
        case 'cancelled': return '已取消';
        default: return status;
    }
}

// 删除商品
async function deleteProduct(id){
  if(!confirm('确定删除此商品?')) return;
  try{
    const res = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PRODUCTS}/${id}`,{method:'DELETE'});
    const data = await res.json();
    if(data.success){ alert('已删除'); loadProducts(); }
    else alert(data.message||'删除失败');
  }catch(err){ console.error('删除商品失败',err); alert('网络错误'); }
}

window.deleteProduct = deleteProduct; 