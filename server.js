const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config();

const app = express();

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

// 数据库配置
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '123456',
    database: process.env.DB_NAME || 'shopping_system',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// 创建MySQL连接池
const pool = mysql.createPool(dbConfig);

// 将连接池转换为Promise版本
const promisePool = pool.promise();

// 测试数据库连接
async function testConnection() {
    try {
        const [rows] = await promisePool.query('SELECT 1');
        console.log('数据库连接成功');
        return true;
    } catch (error) {
        console.error('数据库连接失败:', error);
        return false;
    }
}

// 初始化数据库表
async function initDatabase() {
    try {
        // 首先测试连接
        const isConnected = await testConnection();
        if (!isConnected) {
            throw new Error('无法连接到数据库');
        }

        // 创建用户表
        await promisePool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                user_type ENUM('user', 'merchant') NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 创建商品表
        await promisePool.query(`
            CREATE TABLE IF NOT EXISTS products (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                price DECIMAL(10,2) NOT NULL,
                description TEXT,
                image_url TEXT,
                merchant_id INT,
                stock INT DEFAULT 0,
                discount INT DEFAULT 100,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (merchant_id) REFERENCES users(id)
            )
        `);

        // 创建订单表
        await promisePool.query(`
            CREATE TABLE IF NOT EXISTS orders (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                total_amount DECIMAL(10,2) NOT NULL,
                status VARCHAR(50) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);

        // 创建订单详情表
        await promisePool.query(`
            CREATE TABLE IF NOT EXISTS order_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_id INT NOT NULL,
                product_id INT NOT NULL,
                quantity INT NOT NULL,
                price DECIMAL(10,2) NOT NULL,
                FOREIGN KEY (order_id) REFERENCES orders(id),
                FOREIGN KEY (product_id) REFERENCES products(id)
            )
        `);

        console.log('数据库表初始化完成');
    } catch (error) {
        console.error('数据库初始化错误:', error);
        throw error;
    }
}

// API路由
// 用户注册
app.post('/api/register', async (req, res) => {
    try {
        const { username, password, userType } = req.body;
        
        if (!username || !password || !userType) {
            return res.status(400).json({ error: '请提供所有必需的信息' });
        }
        
        // 检查用户名是否已存在
        const [existingUsers] = await promisePool.query(
            'SELECT id FROM users WHERE username = ?',
            [username]
        );
        
        if (existingUsers.length > 0) {
            return res.status(400).json({ error: '用户名已存在' });
        }
        
        // 加密密码
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // 插入新用户
        const [result] = await promisePool.query(
            'INSERT INTO users (username, password, user_type) VALUES (?, ?, ?)',
            [username, hashedPassword, userType]
        );
        
        res.json({ 
            success: true, 
            user: { id: result.insertId, username, userType } 
        });
    } catch (error) {
        console.error('注册错误:', error);
        res.status(500).json({ error: '注册失败，请稍后重试' });
    }
});

// 用户登录
app.post('/api/login', async (req, res) => {
    try {
        const { username, password, userType } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: '请提供用户名和密码' });
        }
        
        // 查找用户
        const [users] = await promisePool.query(
            'SELECT * FROM users WHERE username = ? AND user_type = ?',
            [username, userType]
        );
        
        if (users.length === 0) {
            return res.status(401).json({ error: '用户名不存在' });
        }
        
        const user = users[0];
        
        // 验证密码
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: '密码错误' });
        }
        
        res.json({ 
            success: true, 
            user: {
                id: user.id,
                username: user.username,
                userType: user.user_type
            }
        });
    } catch (error) {
        console.error('登录错误:', error);
        res.status(500).json({ error: '登录失败，请稍后重试' });
    }
});

// 商品相关API
app.get('/api/products', async (req, res) => {
    try {
        const [products] = await promisePool.query('SELECT * FROM products');
        res.json(products);
    } catch (error) {
        console.error('获取商品列表错误:', error);
        res.status(500).json({ error: '获取商品列表失败，请稍后重试' });
    }
});

app.post('/api/products', async (req, res) => {
    try {
        const { name, price, description, image_url, merchant_id, stock, discount } = req.body;
        
        if (!name || !price || !merchant_id) {
            return res.status(400).json({ error: '请提供商品的必要信息' });
        }
        
        const [result] = await promisePool.query(
            'INSERT INTO products (name, price, description, image_url, merchant_id, stock, discount) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [name, price, description, image_url, merchant_id, stock || 0, discount || 100]
        );
        
        res.json({ success: true, productId: result.insertId });
    } catch (error) {
        console.error('添加商品错误:', error);
        res.status(500).json({ error: '添加商品失败，请稍后重试' });
    }
});

// 启动服务器
const PORT = process.env.PORT || 3000;

// 启动服务器并初始化数据库
async function startServer() {
    try {
        await initDatabase();
        app.listen(PORT, () => {
            console.log(`服务器运行在端口 ${PORT}`);
            console.log(`请访问 http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('服务器启动失败:', error);
        process.exit(1);
    }
}

startServer(); 