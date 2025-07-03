document.addEventListener('DOMContentLoaded', () => {
    const payMethod = sessionStorage.getItem('payMethod') || '';
    const payAmount = sessionStorage.getItem('payAmount') || '0.00';

    const payTitleEl = document.getElementById('payTitle');
    const payAmountEl = document.getElementById('payAmount');

    // 设置页面标题
    let title = '支付';
    switch (payMethod) {
        case 'wechat':
            title = '微信支付';
            break;
        case 'alipay':
            title = '支付宝支付';
            break;
        case 'unionpay':
            title = '银联支付';
            break;
    }
    payTitleEl.textContent = title;
    payAmountEl.textContent = parseFloat(payAmount).toFixed(2);

    // 生成随机二维码
    const qrValue = Math.random().toString(36).substring(2, 12);
    try {
        const qr = new QRious({
            element: document.getElementById('qrCanvas'),
            size: 200,
            value: qrValue // 随机字符串即可
        });
    } catch (e) {
        console.error('生成二维码失败', e);
    }

    // 在生成二维码后发送到后端，再转发至 ESP32
    const qrBase64 = document.getElementById('qrCanvas').toDataURL('image/png');
    const items = JSON.parse(sessionStorage.getItem('payItems') || '[]');

    // 构造要显示的文本：每行 "商品名  ¥单价"
    const textLines = items.map(it=>`${it.name}  ¥${it.price}`).join('\n');

    // (已移除硬件功能) 不再向 DISPLAY 接口发送数据

    // 取消支付返回上一页
    document.getElementById('cancelBtn').addEventListener('click', () => {
        // 如果历史记录中存在 checkout.html，就返回；否则直接跳转
        if (document.referrer && document.referrer.includes('checkout.html')) {
            window.history.back();
        } else {
            window.location.href = 'checkout.html';
        }
    });

    // 模拟支付完成按钮（或可监听扫码成功）
    document.getElementById('confirmPayBtn')?.addEventListener('click', async ()=>{
        const items = JSON.parse(sessionStorage.getItem('payItems')||'[]');
        const address = sessionStorage.getItem('shippingAddress') || '';
        const userInfo = JSON.parse(localStorage.getItem('userInfo')||'null');
        if(!userInfo){ alert('登录失效'); return; }
        try{
            const res = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.ORDERS||'/orders'}`, {
                method:'POST',
                headers:{'Content-Type':'application/json'},
                body: JSON.stringify({ user_id: userInfo.id || userInfo.userId, items, address })
            });
            const data = await res.json();
            if(data.success){
                // 清空购物车
                localStorage.removeItem('cartItems');
                // 通知成功
                alert('支付成功，订单已生成');
                window.location.replace('main.html');
            }else{
                alert(data.message||'下单失败');
            }
        }catch(err){ console.error('创建订单失败', err); alert('服务器错误'); }
    });
}); 