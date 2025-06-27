const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();

// 设置请求体大小限制为10MB
app.use(bodyParser.json({limit: '10mb'}));
app.use(bodyParser.urlencoded({limit: '10mb', extended: true}));

// 设置超时时间为120秒
app.use((req, res, next) => {
    res.setTimeout(120000, () => {
        console.log('请求超时');
        res.status(408).send('请求超时，请重试');
    });
    next();
});

// CORS配置
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// 静态文件服务
app.use(express.static(__dirname));

// 根路由处理
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 数据库连接配置
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '123456',
    database: 'shopping_system',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// 将pool转换为支持promise的版本
const promisePool = pool.promise();

// 测试数据库连接
pool.getConnection((err, connection) => {
    if (err) {
        console.error('数据库连接失败:', err);
        return;
    }
    console.log('数据库连接成功');
    connection.release();
});

// 确保数据库表存在
async function ensureTablesExist() {
    try {
        // 创建users表
        await promisePool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                user_type ENUM('user', 'merchant') NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 创建merchant_info表
        await promisePool.query(`
            CREATE TABLE IF NOT EXISTS merchant_info (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                business_name VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);

        // 删除旧的products表（如果存在）
        await promisePool.query('DROP TABLE IF EXISTS products');

        // 创建新的products表
        await promisePool.query(`
            CREATE TABLE products (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                price DECIMAL(10,2) NOT NULL,
                description TEXT,
                image_url MEDIUMTEXT,
                discount INT DEFAULT 100,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
        `);

        console.log('数据库表检查/创建完成');
    } catch (error) {
        console.error('创建数据库表失败:', error);
        throw error;
    }
}

// 启动时确保表存在
ensureTablesExist().catch(console.error);

// 用户注册
app.post('/api/register', async (req, res) => {
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
            
            console.log('用户注册成功:', userResult);
            
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
app.post('/api/login', async (req, res) => {
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
app.post('/api/products', async (req, res) => {
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
app.get('/api/products', async (req, res) => {
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`服务器运行在端口 ${PORT}`);
}); 