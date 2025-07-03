document.addEventListener('DOMContentLoaded', () => {
    // 获取购物车商品
    const items = JSON.parse(localStorage.getItem('cartItems')) || [];
    const itemsContainer = document.getElementById('checkoutItems');
    const totalEl = document.getElementById('checkoutTotal');

    // 渲染商品列表并计算总价
    let total = 0;
    itemsContainer.innerHTML = items.map(item => {
        const subtotal = item.price * item.quantity;
        total += subtotal;
        return `
            <div class="cart-item">
                <img src="${item.image}" alt="${item.name}">
                <div class="item-info">
                    <h4>${item.name}</h4>
                    <p>数量: ${item.quantity}</p>
                </div>
                <div class="price">¥${subtotal.toFixed(2)}</div>
            </div>
        `;
    }).join('');

    totalEl.textContent = total.toFixed(2);

    // 绑定支付按钮点击事件
    document.querySelectorAll('.payment-options button').forEach(btn => {
        btn.addEventListener('click', () => {
            const payMethod = btn.getAttribute('data-pay');
            const address = document.getElementById('shippingAddress').value.trim();
            if(!address){ alert('请填写收货地址'); return; }
            // 使用 sessionStorage 传递支付方式与金额到支付页
            sessionStorage.setItem('payMethod', payMethod);
            sessionStorage.setItem('payAmount', total.toFixed(2));
            sessionStorage.setItem('payItems', JSON.stringify(items));
            window.location.href = 'payment.html';
        });
    });
}); 