const express = require('express');
const serverless = require('serverless-http');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();

// 设置请求体大小限制为10MB
app.use(bodyParser.json({limit: '10mb'}));
app.use(bodyParser.urlencoded({limit: '10mb', extended: true}));

// CORS配置
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// 数据库连接配置
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// 将pool转换为支持promise的版本
const promisePool = pool.promise();

// API路由
const router = express.Router();

// 用户注册
router.post('/register', async (req, res) => {
    try {
        console.log('收到注册请求:', req.body);
        const { username, password, userType, businessName } = req.body;
        
        if (!username || !password || !userType) {
            return res.status(400).json({ message: '请提供所有必需的信息' });
        }

        if (userType === 'merchant' && !businessName) {
            return res.status(400).json({ message: '商家注册需要提供商家名称' });
        }
        
        // 检查用户名是否已存在
        const [existingUsers] = await promisePool.query(
            'SELECT id FROM users WHERE username = ?',
            [username]
        );
        
        if (existingUsers.length > 0) {
            return res.status(400).json({ message: '用户名已存在' });
        }
        
        // 开始事务
        await promisePool.query('START TRANSACTION');
        
        try {
            // 密码加密
            const hashedPassword = await bcrypt.hash(password, 10);
            
            // 插入用户数据
            const [userResult] = await promisePool.query(
                'INSERT INTO users (username, password, user_type) VALUES (?, ?, ?)',
                [username, hashedPassword, userType]
            );
            
            // 如果是商家，还需要插入商家信息
            if (userType === 'merchant' && businessName) {
                await promisePool.query(
                    'INSERT INTO merchant_info (user_id, business_name) VALUES (?, ?)',
                    [userResult.insertId, businessName]
                );
            }
            
            // 提交事务
            await promisePool.query('COMMIT');
            
            res.json({ 
                success: true, 
                userId: userResult.insertId,
                message: userType === 'merchant' ? '商家注册成功' : '用户注册成功'
            });
        } catch (error) {
            // 回滚事务
            await promisePool.query('ROLLBACK');
            throw error;
        }
    } catch (error) {
        console.error('注册错误:', error);
        res.status(500).json({ 
            success: false,
            message: '注册失败，请稍后重试',
            details: error.message 
        });
    }
});

// 用户登录
router.post('/login', async (req, res) => {
    try {
        const { username, password, userType } = req.body;
        
        // 获取用户信息
        const [users] = await promisePool.query(
            'SELECT id, username, password, user_type FROM users WHERE username = ?',
            [username]
        );
        
        if (users.length === 0) {
            return res.status(401).json({ message: '用户名不存在' });
        }
        
        const user = users[0];
        
        // 验证用户类型
        if (user.user_type !== userType) {
            return res.status(401).json({ 
                message: userType === 'user' ? 
                    '此账号是商家账号，请使用商家登录' : 
                    '此账号是用户账号，请使用用户登录'
            });
        }
        
        // 验证密码
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ message: '密码错误' });
        }
        
        // 如果是商家，获取商家信息
        let merchantInfo = null;
        if (user.user_type === 'merchant') {
            const [merchants] = await promisePool.query(
                'SELECT id, business_name FROM merchant_info WHERE user_id = ?',
                [user.id]
            );
            if (merchants.length > 0) {
                merchantInfo = merchants[0];
            }
        }
        
        res.json({
            success: true,
            message: '登录成功',
            user: {
                id: user.id,
                username: user.username,
                userType: user.user_type,
                ...(merchantInfo && { 
                    businessName: merchantInfo.business_name,
                    merchantId: merchantInfo.id
                })
            }
        });
    } catch (error) {
        console.error('登录错误:', error);
        res.status(500).json({ 
            success: false,
            message: '登录失败，请稍后重试',
            details: error.message 
        });
    }
});

// 商品上传API
router.post('/products', async (req, res) => {
    try {
        console.log('收到商品上传请求:', req.body);
        const { name, price, description, image_url, discount } = req.body;
        
        // 数据验证
        if (!name || !price || !description || !image_url) {
            console.log('缺少必要的商品信息:', { name, price, description });
            return res.status(400).json({ 
                success: false,
                message: '请提供所有必需的商品信息' 
            });
        }

        // 验证图片数据
        if (!image_url.startsWith('data:image/')) {
            console.log('无效的图片格式');
            return res.status(400).json({ 
                success: false,
                message: '无效的图片格式' 
            });
        }

        // 插入商品数据
        console.log('开始插入商品数据...');
        const [result] = await promisePool.query(
            'INSERT INTO products (name, price, description, image_url, discount) VALUES (?, ?, ?, ?, ?)',
            [name, price, description, image_url, discount || 100]
        );

        console.log('商品上传成功:', result);

        res.json({
            success: true,
            message: '商品上传成功',
            productId: result.insertId
        });
    } catch (error) {
        console.error('商品上传错误:', error);
        res.status(500).json({
            success: false,
            message: '商品上传失败，请稍后重试',
            details: error.message
        });
    }
});

// 获取商品列表
router.get('/products', async (req, res) => {
    try {
        console.log('获取商品列表');
        
        // 获取所有商品
        const [products] = await promisePool.query(
            'SELECT * FROM products ORDER BY created_at DESC'
        );

        console.log(`找到 ${products.length} 个商品`);

        res.json({
            success: true,
            products: products.map(product => ({
                ...product,
                image_url: product.image_url
            }))
        });
    } catch (error) {
        console.error('获取商品列表错误:', error);
        res.status(500).json({
            success: false,
            message: '获取商品列表失败，请稍后重试',
            details: error.message
        });
    }
});

app.use('/.netlify/functions/api', router);

// 导出serverless handler
module.exports.handler = serverless(app); 