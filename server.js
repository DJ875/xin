const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// 创建MySQL连接池
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',     // 替换为您的MySQL用户名
    password: '123456', // 替换为您的MySQL密码
    database: 'shopping_system',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// 将连接池转换为Promise版本
const promisePool = pool.promise();

// 初始化数据库表
async function initDatabase() {
    try {
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

// 启动时初始化数据库
initDatabase().catch(console.error);

// API路由
// 用户注册
app.post('/api/register', async (req, res) => {
    try {
        const { username, password, userType } = req.body;
        
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
        res.status(500).json({ error: error.message });
    }
});

// 用户登录
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // 查找用户
        const [users] = await promisePool.query(
            'SELECT * FROM users WHERE username = ?',
            [username]
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
        res.status(500).json({ error: error.message });
    }
});

// 商品相关API
app.get('/api/products', async (req, res) => {
    try {
        const [products] = await promisePool.query('SELECT * FROM products');
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/products', async (req, res) => {
    try {
        const { name, price, description, image_url, merchant_id, stock, discount } = req.body;
        const [result] = await promisePool.query(
            'INSERT INTO products (name, price, description, image_url, merchant_id, stock, discount) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [name, price, description, image_url, merchant_id, stock, discount]
        );
        res.json({ success: true, productId: result.insertId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 启动服务器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`服务器运行在端口 ${PORT}`);
}); 