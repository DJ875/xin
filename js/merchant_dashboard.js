document.addEventListener('DOMContentLoaded', function() {
    // 获取用户信息
    const userInfo = JSON.parse(localStorage.getItem('userInfo'));
    if (!userInfo || userInfo.userType !== 'merchant') {
        window.location.href = 'index.html';
        return;
    }
    
    currentMerchant = userInfo;
    
    // 更新页面显示
    updateMerchantInfo();
    
    // 立即加载所有数据
    loadProducts();
    loadSalesData();
    loadDiscountProducts();
    
    // 设置默认显示商品管理页面
    document.getElementById('productsSection').style.display = 'block';
    document.getElementById('salesSection').style.display = 'none';
    document.getElementById('discountSection').style.display = 'none';
    document.getElementById('productsLink').classList.add('active');
});

// 获取当前登录的商家信息
let currentMerchant = null;
let currentSection = 'products';

function updateMerchantInfo() {
    document.querySelector('.merchant-welcome').textContent = currentMerchant.businessName;
    document.getElementById('merchantName').textContent = currentMerchant.businessName;
    document.getElementById('registrationDate').textContent = new Date().toLocaleDateString();
    document.getElementById('businessTypes').textContent = '所有类目';
    document.getElementById('contactInfo').textContent = currentMerchant.username;
}

function showSection(section) {
    currentSection = section;
    // 更新导航栏激活状态
    document.querySelectorAll('.nav-menu a').forEach(link => link.classList.remove('active'));
    document.getElementById(`${section}Link`).classList.add('active');
    
    // 隐藏所有section
    document.getElementById('productsSection').style.display = 'none';
    document.getElementById('salesSection').style.display = 'none';
    document.getElementById('discountSection').style.display = 'none';
    
    // 显示选中的section
    document.getElementById(`${section}Section`).style.display = 'block';
    
    // 根据需要重新加载数据
    if (section === 'sales') {
        loadSalesData();
    } else if (section === 'products') {
        loadProducts();
    } else if (section === 'discount') {
        loadDiscountProducts();
    }
}

async function loadProducts() {
    try {
        const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PRODUCTS}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        if (data.success) {
            const productsGrid = document.getElementById('productsGrid');
            productsGrid.innerHTML = data.products.map(product => `
                <div class="product-card">
                    <div class="product-actions">
                        <button class="edit-btn" onclick="editProduct('${product.id}')">✎</button>
                        <button class="delete-btn" onclick="deleteProduct('${product.id}')">×</button>
                    </div>
                    <img src="${product.image_url}" alt="${product.name}" onerror="this.src='images/default-product.jpg'">
                    <h3>${product.name}</h3>
                    <p class="price">¥${product.price}</p>
                    <p class="upload-time">上架时间: ${new Date(product.created_at).toLocaleString()}</p>
                </div>
            `).join('');
        } else {
            throw new Error(data.message || '加载失败');
        }
    } catch (error) {
        console.error('加载商品列表失败：', error);
        alert('加载商品列表失败，请刷新页面重试');
    }
}

async function loadSalesData() {
    try {
        const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PRODUCTS}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        if (data.success) {
            const salesList = document.getElementById('salesList');
            // 按销量排序（目前默认为0）
            const sortedProducts = data.products.map(product => ({
                ...product,
                sales: 0 // 后续可以添加实际销量
            })).sort((a, b) => (b.sales || 0) - (a.sales || 0));
            
            salesList.innerHTML = sortedProducts.map(product => `
                <div class="sales-item">
                    <img src="${product.image_url}" alt="${product.name}" onerror="this.src='images/default-product.jpg'">
                    <div class="sales-info">
                        <h3>${product.name}</h3>
                        <p class="price">¥${product.price}</p>
                    </div>
                    <div class="sales-count">销量：${product.sales || 0}</div>
                </div>
            `).join('') || '<p>暂无销售数据</p>';
        }
    } catch (error) {
        console.error('加载销售数据失败：', error);
        document.getElementById('salesList').innerHTML = '<p>加载销售数据失败</p>';
    }
}

async function loadDiscountProducts() {
    try {
        const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PRODUCTS}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        if (data.success) {
            const discountList = document.getElementById('discountList');
            const discountedProducts = data.products.filter(product => product.discount && product.discount < 100);
            
            discountList.innerHTML = discountedProducts.map(product => `
                <div class="product-card">
                    <div class="discount-tag">${product.discount}% OFF</div>
                    <img src="${product.image_url}" alt="${product.name}" onerror="this.src='images/default-product.jpg'">
                    <h3>${product.name}</h3>
                    <p>
                        <span class="original-price">¥${product.price.toFixed(2)}</span>
                        <span class="discounted-price">¥${(product.price * product.discount / 100).toFixed(2)}</span>
                    </p>
                    <p class="upload-time">上架时间: ${new Date(product.created_at).toLocaleString()}</p>
                </div>
            `).join('') || '<p>暂无折扣商品</p>';
        }
    } catch (error) {
        console.error('加载折扣商品失败：', error);
        document.getElementById('discountList').innerHTML = '<p>加载折扣商品失败</p>';
    }
}

function showAddProductModal() {
    const modal = document.createElement('div');
    modal.className = 'product-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h2>添加新商品</h2>
            <form id="productForm">
                <div class="form-group">
                    <label>商品名称</label>
                    <input type="text" id="productName" required>
                </div>
                <div class="form-group">
                    <label>商品价格</label>
                    <input type="number" id="productPrice" step="0.01" required>
                </div>
                <div class="form-group">
                    <label>折扣设置</label>
                    <div class="discount-setting">
                        <input type="checkbox" id="enableDiscount" onchange="toggleDiscountInput()">
                        <label for="enableDiscount">启用折扣</label>
                        <input type="number" id="discountPercent" min="1" max="99" disabled
                               onchange="updateDiscountedPrice()" onkeyup="updateDiscountedPrice()">
                        <span>%</span>
                    </div>
                    <p id="discountedPriceDisplay" style="display: none;"></p>
                </div>
                <div class="form-group">
                    <label>商品图片</label>
                    <div class="image-upload" onclick="document.getElementById('imageInput').click()">
                        <input type="file" id="imageInput" accept="image/*" style="display: none" onchange="handleImageUpload(event)">
                        <p>点击上传图片</p>
                        <img id="previewImage" style="display: none">
                    </div>
                </div>
                <div class="form-group">
                    <label>商品描述</label>
                    <textarea id="productDescription" required></textarea>
                </div>
                <div class="modal-buttons">
                    <button type="button" class="cancel-btn" onclick="this.closest('.product-modal').remove()">取消</button>
                    <button type="submit" class="save-btn">保存</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('productForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // 显示加载提示
        const submitButton = this.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = '上传中...';
        
        try {
            // 获取表单数据
            const name = document.getElementById('productName').value;
            const price = parseFloat(document.getElementById('productPrice').value);
            const description = document.getElementById('productDescription').value;
            const imageInput = document.getElementById('imageInput');
            const enableDiscount = document.getElementById('enableDiscount').checked;
            const discountPercent = enableDiscount ? parseInt(document.getElementById('discountPercent').value) : 100;
            
            console.log('表单数据:', { name, price, description, discountPercent, enableDiscount });
            
            // 基本验证
            if (!name || !price || !description) {
                throw new Error('请填写所有必需的商品信息');
            }
            
            if (isNaN(price) || price <= 0) {
                throw new Error('请输入有效的商品价格');
            }
            
            // 验证图片是否已上传
            if (!imageInput.files || imageInput.files.length === 0) {
                throw new Error('请选择商品图片');
            }

            // 读取图片文件并转换为base64
            const imageFile = imageInput.files[0];
            console.log('图片信息:', {
                name: imageFile.name,
                type: imageFile.type,
                size: imageFile.size
            });
            
            const reader = new FileReader();
            
            reader.onload = async function(event) {
                try {
                    const image_url = event.target.result;
                    console.log('图片已转换为base64');
                    
                    // 准备商品数据
                    const productData = {
                        name,
                        price,
                        description,
                        image_url,
                        discount: discountPercent
                    };
                    
                    console.log('准备发送的数据:', {
                        ...productData,
                        image_url: '(base64数据已省略)'
                    });

                    // 发送请求
                    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PRODUCTS}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(productData)
                    });

                    console.log('服务器响应状态:', response.status);
                    
                    if (!response.ok) {
                        const errorText = await response.text();
                        console.error('服务器错误响应:', errorText);
                        throw new Error(`上传失败: ${response.status} ${errorText}`);
                    }

                    const result = await response.json();
                    console.log('服务器响应数据:', result);
                    
                    if (result.success) {
                        alert('商品上传成功！');
                        // 关闭模态框
                        document.querySelector('.product-modal').remove();
                        // 重新加载所有商品列表
                        loadProducts();
                        loadSalesData();
                        loadDiscountProducts();
                    } else {
                        throw new Error(result.message || '上传失败');
                    }
                } catch (error) {
                    console.error('商品上传失败：', error);
                    alert('商品上传失败：' + error.message);
                } finally {
                    // 恢复按钮状态
                    submitButton.disabled = false;
                    submitButton.textContent = '保存';
                }
            };
            
            reader.onerror = function(error) {
                console.error('图片读取错误:', error);
                alert('图片读取失败，请重试');
                submitButton.disabled = false;
                submitButton.textContent = '保存';
            };
            
            reader.readAsDataURL(imageFile);
        } catch (error) {
            console.error('表单处理错误：', error);
            alert('表单处理错误：' + error.message);
            // 恢复按钮状态
            submitButton.disabled = false;
            submitButton.textContent = '保存';
        }
    });
}

function handleImageUpload(event) {
    const file = event.target.files[0];
    const previewImage = document.getElementById('previewImage');
    const uploadText = event.target.parentElement.querySelector('p');
    
    if (file) {
        // 验证文件类型
        if (!file.type.startsWith('image/')) {
            alert('请选择图片文件');
            return;
        }
        
        // 验证文件大小（限制为5MB）
        if (file.size > 5 * 1024 * 1024) {
            alert('图片大小不能超过5MB');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            previewImage.src = e.target.result;
            previewImage.style.display = 'block';
            uploadText.style.display = 'none';
        };
        reader.readAsDataURL(file);
    }
}

function editProduct(productId) {
    const product = currentMerchant.products.find(p => p.id === productId);
    if (!product) return;

    const modal = document.createElement('div');
    modal.className = 'product-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h2>编辑商品</h2>
            <form id="productForm">
                <div class="form-group">
                    <label>商品名称</label>
                    <input type="text" id="productName" value="${product.name}" required>
                </div>
                <div class="form-group">
                    <label>商品价格</label>
                    <input type="number" id="productPrice" value="${product.price}" step="0.01" required>
                </div>
                <div class="form-group">
                    <label>折扣设置</label>
                    <div class="discount-setting">
                        <input type="checkbox" id="enableDiscount" onchange="toggleDiscountInput()" ${product.discount && product.discount < 100 ? 'checked' : ''}>
                        <label for="enableDiscount">启用折扣</label>
                        <input type="number" id="discountPercent" min="1" max="99" value="${product.discount || 90}" 
                               ${product.discount && product.discount < 100 ? '' : 'disabled'}
                               onchange="updateDiscountedPrice()" onkeyup="updateDiscountedPrice()">
                        <span>%</span>
                    </div>
                    <p id="discountedPriceDisplay" style="display: ${product.discount && product.discount < 100 ? 'block' : 'none'};"></p>
                </div>
                <div class="form-group">
                    <label>商品图片</label>
                    <div class="image-upload" onclick="document.getElementById('imageInput').click()">
                        <input type="file" id="imageInput" accept="image/*" style="display: none" onchange="handleImageUpload(event)">
                        <p>点击更换图片</p>
                        <img id="previewImage" src="${product.image}" style="display: block">
                    </div>
                </div>
                <div class="form-group">
                    <label>商品描述</label>
                    <textarea id="productDescription" required>${product.description}</textarea>
                </div>
                <div class="form-group">
                    <label>上架时间</label>
                    <input type="text" value="${new Date(product.uploadTime).toLocaleString()}" disabled>
                </div>
                <div class="modal-buttons">
                    <button type="button" class="cancel-btn" onclick="this.closest('.product-modal').remove()">取消</button>
                    <button type="submit" class="save-btn">保存</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);

    // 如果有折扣，初始化折扣价格显示
    if (product.discount && product.discount < 100) {
        updateDiscountedPrice();
    }

    document.getElementById('productForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const enableDiscount = document.getElementById('enableDiscount').checked;
        const discount = enableDiscount ? parseFloat(document.getElementById('discountPercent').value) : 100;
        
        // 更新商品信息
        product.name = document.getElementById('productName').value;
        product.price = parseFloat(document.getElementById('productPrice').value);
        product.description = document.getElementById('productDescription').value;
        product.discount = discount;
        
        const previewImage = document.getElementById('previewImage');
        if (previewImage.src !== product.image) {
            product.image = previewImage.src;
        }
        
        // 更新localStorage中的商家信息
        updateMerchantData();
        
        // 刷新所有相关页面
        loadProducts();
        loadSalesData();
        loadDiscountProducts();
        
        // 关闭弹窗
        modal.remove();
    });
}

function deleteProduct(productId) {
    if (confirm('确定要删除这个商品吗？')) {
        currentMerchant.products = currentMerchant.products.filter(p => p.id !== productId);
        updateMerchantData();
        loadProducts();
        loadSalesData();
        loadDiscountProducts();
    }
}

function updateMerchantData() {
    // 更新localStorage中的商家信息
    localStorage.setItem('userInfo', JSON.stringify(currentMerchant));
    
    // 更新merchants数组中的商家信息
    const merchants = JSON.parse(localStorage.getItem('merchants') || '[]');
    const index = merchants.findIndex(m => m.id === currentMerchant.id);
    if (index !== -1) {
        merchants[index] = currentMerchant;
        localStorage.setItem('merchants', JSON.stringify(merchants));
    }
}

function toggleDiscountInput() {
    const discountInput = document.getElementById('discountPercent');
    const enableDiscount = document.getElementById('enableDiscount');
    const priceDisplay = document.getElementById('discountedPriceDisplay');
    
    discountInput.disabled = !enableDiscount.checked;
    priceDisplay.style.display = enableDiscount.checked ? 'block' : 'none';
    
    if (enableDiscount.checked) {
        discountInput.value = discountInput.value || '90';
        updateDiscountedPrice();
    }
}

function updateDiscountedPrice() {
    const price = parseFloat(document.getElementById('productPrice').value) || 0;
    const discount = parseFloat(document.getElementById('discountPercent').value) || 100;
    const discountedPrice = price * discount / 100;
    
    document.getElementById('discountedPriceDisplay').innerHTML = `
        折后价格: <span class="discounted-price">¥${discountedPrice.toFixed(2)}</span>
        <span class="original-price">¥${price.toFixed(2)}</span>
    `;
} 