const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// 连接MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/shopping_system', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// 数据模型
const Product = mongoose.model('Product', {
    name: String,
    price: Number,
    description: String,
    image: String,
    merchantId: String,
    category: String,
    stock: Number,
    discount: Number,
    uploadTime: { type: Date, default: Date.now }
});

const User = mongoose.model('User', {
    username: String,
    password: String,
    userType: String,
    businessName: String,
    createdAt: { type: Date, default: Date.now }
});

const Order = mongoose.model('Order', {
    userId: String,
    products: [{
        productId: String,
        quantity: Number,
        price: Number
    }],
    totalAmount: Number,
    status: String,
    createdAt: { type: Date, default: Date.now }
});

// API路由
// 商品相关
app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find();
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/products', async (req, res) => {
    try {
        const product = new Product(req.body);
        await product.save();
        res.json(product);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 用户相关
app.post('/api/register', async (req, res) => {
    try {
        const { username, password, userType, businessName } = req.body;
        const user = new User({ username, password, userType, businessName });
        await user.save();
        res.json({ success: true, user });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username, password });
        if (user) {
            res.json({ success: true, user });
        } else {
            res.status(401).json({ error: '用户名或密码错误' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 订单相关
app.post('/api/orders', async (req, res) => {
    try {
        const order = new Order(req.body);
        await order.save();
        res.json(order);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/orders/:userId', async (req, res) => {
    try {
        const orders = await Order.find({ userId: req.params.userId });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 启动服务器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`服务器运行在端口 ${PORT}`);
}); 