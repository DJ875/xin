const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const path = require('path');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const { authenticateToken } = require('./middleware/auth');
const fs = require('fs');
const fetch = require('node-fetch');
const crypto = require('crypto');
const WebSocket = require('ws');

dotenv.config();

const app = express();

// 中间件
app.use(cors());
app.use(bodyParser.json({limit: '10mb'}));
app.use(express.static(path.join(__dirname)));

// 数据库连接配置
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '123456',
    database: process.env.DB_NAME || 'shopping_system',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
}).promise();

// JWT密钥
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// 测试数据库连接
async function testConnection() {
    try {
        const [rows] = await pool.query('SELECT 1');
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
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                user_type ENUM('user', 'merchant') NOT NULL,
                avatar_url TEXT,
                email VARCHAR(255) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 创建商家表（若不存在）
        await pool.query(`
            CREATE TABLE IF NOT EXISTS merchants (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL UNIQUE,
                business_name VARCHAR(255) NOT NULL,
                description TEXT,
                avatar_url TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);

        // 创建商品表
        await pool.query(`
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
        await pool.query(`
            CREATE TABLE IF NOT EXISTS orders (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                total_amount DECIMAL(10,2) NOT NULL,
                status VARCHAR(50) DEFAULT 'pending',
                shipping_address VARCHAR(255) NULL,
                contact_phone VARCHAR(30) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);

        // 创建订单详情表
        await pool.query(`
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

        // 创建商家经营类型表（多对多简化存储为一行一类型）
        await pool.query(`
            CREATE TABLE IF NOT EXISTS merchant_business_types (
                id INT AUTO_INCREMENT PRIMARY KEY,
                merchant_id INT NOT NULL,
                business_type VARCHAR(100) NOT NULL,
                FOREIGN KEY (merchant_id) REFERENCES merchants(id)
            )
        `);

        // 兼容旧表：补充缺失列
        const alterIfMissing = async (table, column, definition) => {
            try {
                await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
                console.log(`已在 ${table} 表添加列 ${column}`);
            } catch (err) {
                if (err.code === 'ER_DUP_FIELDNAME' || err.code === 'ER_DUP_COLUMN_NAME') {
                    // 列已存在，忽略
                } else {
                    console.error(`为 ${table} 表添加列 ${column} 失败:`, err.sqlMessage);
                }
            }
        };

        await alterIfMissing('users', 'avatar_url', 'TEXT NULL');
        await alterIfMissing('merchants', 'avatar_url', 'TEXT NULL');
        await alterIfMissing('merchants', 'business_type', 'TEXT NULL');
        await alterIfMissing('products', 'merchant_id', 'INT NULL');
        await alterIfMissing('users', 'email', 'VARCHAR(255) NULL');
        await alterIfMissing('products', 'discount', 'INT DEFAULT 100');
        await alterIfMissing('products', 'category', 'VARCHAR(255) NULL');
        await alterIfMissing('orders', 'merchant_id', 'INT NULL');
        await alterIfMissing('orders', 'shipping_address', 'VARCHAR(255) NULL');
        await alterIfMissing('orders', 'contact_phone', 'VARCHAR(30) NULL');

        // 确保 email 列允许 NULL
        try {
            await pool.query('ALTER TABLE users MODIFY COLUMN email VARCHAR(255) NULL');
        } catch(err) {}

        // 确保 category 列允许 NULL
        try {
            await pool.query('ALTER TABLE products MODIFY COLUMN category VARCHAR(255) NULL');
        } catch(err) {}

        // 若新加 merchant_id，需要补充外键
        try {
            await pool.query('ALTER TABLE products ADD CONSTRAINT fk_products_merchant FOREIGN KEY (merchant_id) REFERENCES users(id)');
        } catch (err) {
            // 外键已存在或创建失败可忽略
        }

        // 更新 orders 表的 shipping_address 列允许 NULL
        try {
            await pool.query('ALTER TABLE orders MODIFY COLUMN shipping_address VARCHAR(255) NULL');
        } catch (err) {
            // 更新失败可忽略
        }

        console.log('数据库表初始化完成');
    } catch (error) {
        console.error('数据库初始化错误:', error);
        throw error;
    }
}

// 检查认证状态
app.get('/api/auth/check', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const userType = req.user.userType;

        // 查询用户信息
        const [users] = await pool.query(
            'SELECT u.*, m.business_name, m.id as merchant_id FROM users u LEFT JOIN merchants m ON u.id = m.user_id WHERE u.id = ?',
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ message: '用户不存在' });
        }

        const user = users[0];

        // 如果是商家，获取经营类型
        let businessTypes = [];
        if (userType === 'merchant' && user.merchant_id) {
            const [types] = await pool.query(
                'SELECT business_type FROM merchant_business_types WHERE merchant_id = ?',
                [user.merchant_id]
            );
            businessTypes = types.map(t => t.business_type);
        }

        // 构建响应数据
        const userData = {
            id: user.id,
            username: user.username,
            userType: user.user_type,
            email: user.email
        };

        if (userType === 'merchant') {
            userData.businessName = user.business_name;
            userData.businessTypes = businessTypes;
            userData.merchantId = user.merchant_id;
        }

        res.json({
            success: true,
            user: userData
        });
    } catch (error) {
        console.error('认证检查错误:', error);
        res.status(500).json({ message: '服务器错误，请稍后重试' });
    }
});

// 工具：保存base64头像，返回相对路径
function saveBase64Image(base64String, folder = 'uploads') {
    try {
        if (!base64String || !base64String.startsWith('data:image')) return null;
        const matches = base64String.match(/^data:image\/(\w+);base64,(.+)$/);
        if (!matches) return null;
        const ext = matches[1];
        const data = matches[2];
        const buffer = Buffer.from(data, 'base64');
        const fileName = `avatar_${Date.now()}.${ext}`;
        const uploadDir = path.join(__dirname, 'images', folder);
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        const filePath = path.join(uploadDir, fileName);
        fs.writeFileSync(filePath, buffer);
        // 返回供前端使用的相对路径
        return `images/${folder}/${fileName}`;
    } catch (e) {
        console.error('保存头像失败:', e);
        return null;
    }
}

// API路由
// 用户注册
app.post('/api/register', async (req, res) => {
    try {
        const { username, password, userType, avatar, businessName, businessTypes, email } = req.body;
        
        if (!username || !password || !userType) {
            return res.status(400).json({ error: '请提供所有必需的信息' });
        }
        
        // 检查用户名是否已存在
        const [existingUsers] = await pool.query(
            'SELECT id FROM users WHERE username = ?',
            [username]
        );
        
        if (existingUsers.length > 0) {
            return res.status(400).json({ error: '用户名已存在' });
        }
        
        // 加密密码
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const avatarPath = saveBase64Image(avatar);
        // 动态拼接字段，避免 email 为空时报错
        const columns = ['username', 'password', 'user_type', 'avatar_url'];
        const placeholders = ['?', '?', '?', '?'];
        const values = [username, hashedPassword, userType, avatarPath];
        if (email) {
            columns.push('email');
            placeholders.push('?');
            values.push(email);
        }

        const [result] = await pool.query(
            `INSERT INTO users (${columns.join(',')}) VALUES (${placeholders.join(',')})`,
            values
        );
        
        // 如果是商家，写入 merchants 表
            if (userType === 'merchant' && businessName) {
            await pool.query(
                'INSERT INTO merchants (user_id, business_name, business_type, avatar_url) VALUES (?, ?, ?, ?)',
                [result.insertId, businessName, (businessTypes || []).join(','), avatarPath]
            );
        }
            
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
        
        // 验证必要字段
        if (!username || !password || !userType) {
            return res.status(400).json({ message: '所有字段都是必填的' });
        }

        // 查询用户
        const [users] = await pool.query(
            'SELECT u.*, m.business_name, m.id as merchant_id FROM users u LEFT JOIN merchants m ON u.id = m.user_id WHERE u.username = ? AND u.user_type = ?',
            [username, userType]
        );
        
        if (users.length === 0) {
            return res.status(401).json({ message: '用户名或密码错误' });
        }
        
        const user = users[0];
        
        // 验证密码
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ message: '用户名或密码错误' });
        }

        // 如果是商家，获取经营类型
        let businessTypes = [];
        if (userType === 'merchant' && user.merchant_id) {
            const [types] = await pool.query(
                'SELECT business_type FROM merchant_business_types WHERE merchant_id = ?',
                [user.merchant_id]
            );
            businessTypes = types.map(t => t.business_type);
        }

        // 生成JWT令牌
        const token = jwt.sign(
            { 
                userId: user.id,
                userType: user.user_type,
                merchantId: user.merchant_id
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // 构建响应数据
        const userData = {
            id: user.id,
            username: user.username,
            userType: user.user_type,
            email: user.email,
            token: token
        };

        if (userType === 'merchant') {
            userData.businessName = user.business_name;
            userData.businessTypes = businessTypes;
            userData.merchantId = user.merchant_id;
        }
        
        res.json({
            success: true,
            user: userData
        });
    } catch (error) {
        console.error('登录错误:', error);
        res.status(500).json({ message: '服务器错误，请稍后重试' });
    }
});

// 商品相关API
app.get('/api/products', async (req, res) => {
    try {
        const { category = '', kw = '' } = req.query;
        let sql = 'SELECT * FROM products WHERE 1=1';
        const params = [];
        if (category){ sql += ' AND category = ?'; params.push(category); }
        if (kw){ sql += ' AND name LIKE ?'; params.push(`%${kw}%`); }
        const [products] = await pool.query(sql, params);
        res.json(products);
    } catch (error) {
        console.error('获取商品列表错误:', error);
        res.status(500).json({ error: '获取商品列表失败，请稍后重试' });
    }
});

app.post('/api/products', async (req, res) => {
    try {
        let { name, price, description, image_url, merchant_id, stock, discount, category } = req.body;
        
        if (!name || !price) {
            return res.status(400).json({ error: '缺少必要参数' });
        }
        // 若前端传的是用户ID而非商家ID，则转换
        if (merchant_id) {
            const [merRows] = await pool.query('SELECT id FROM merchants WHERE user_id = ? OR id = ?', [merchant_id, merchant_id]);
            if (merRows.length) {
                merchant_id = merRows[0].id; // 统一使用 merchants.id
            } else {
                merchant_id = null; // 无匹配则归为平台自营
            }
        }
        // 无商家ID时，使用平台自营商家
        if (!merchant_id) {
            // 确保平台商家存在
            const platformMerchantId = await ensurePlatformMerchant();
            merchant_id = platformMerchantId;
        }
        // 若 image_url 为 base64，则保存到 images/uploads 并替换为路径
        if (image_url && image_url.startsWith('data:image')) {
            const savedPath = saveBase64Image(image_url, 'products');
            if (savedPath) image_url = savedPath;
        }
        
        const [result] = await pool.query(
            'INSERT INTO products (name, price, description, image_url, merchant_id, stock, discount, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [name, price, description, image_url, merchant_id, stock || 0, discount || 100, category || null]
        );
        
        res.json({ success: true, productId: result.insertId });
    } catch (error) {
        console.error('添加商品错误:', error);
        res.status(500).json({ error: '添加商品失败，请稍后重试' });
    }
});

// 删除商品
app.delete('/api/products/:id', async (req,res)=>{
  try{
      const { id } = req.params;
      await pool.query('DELETE FROM products WHERE id = ?', [id]);
      res.json({success:true});
  }catch(err){ console.error('删除商品失败',err); res.status(500).json({message:'服务器错误'}); }
});

// Netlify用户登录
app.post('/api/login/netlify', async (req, res) => {
    try {
        const { email, netlifyToken, userType } = req.body;

        if (!email || !netlifyToken || !userType) {
            return res.status(400).json({ message: '所有字段都是必填的' });
        }

        // 查询用户
        const [users] = await pool.query(
            'SELECT u.*, m.business_name, m.id as merchant_id FROM users u LEFT JOIN merchants m ON u.id = m.user_id WHERE u.email = ? AND u.user_type = ?',
            [email, userType]
        );

        if (users.length === 0) {
            return res.status(401).json({ message: '用户不存在' });
        }

        const user = users[0];

        // 如果是商家，获取经营类型
        let businessTypes = [];
        if (userType === 'merchant' && user.merchant_id) {
            const [types] = await pool.query(
                'SELECT business_type FROM merchant_business_types WHERE merchant_id = ?',
                [user.merchant_id]
            );
            businessTypes = types.map(t => t.business_type);
        }

        // 生成JWT令牌
        const token = jwt.sign(
            { 
                userId: user.id,
                userType: user.user_type,
                merchantId: user.merchant_id
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // 构建响应数据
        const userData = {
            id: user.id,
            email: user.email,
            userType: user.user_type,
            token: token
        };

        if (userType === 'merchant') {
            userData.businessName = user.business_name;
            userData.businessTypes = businessTypes;
            userData.merchantId = user.merchant_id;
        }

        res.json({
            success: true,
            user: userData
        });
    } catch (error) {
        console.error('Netlify登录错误:', error);
        res.status(500).json({ message: '服务器错误，请稍后重试' });
    }
});

// 商家本地注册
app.post('/api/merchant/register', async (req, res) => {
    try {
        const { username, password, businessName, businessTypes, userType } = req.body;

        // 验证必要字段
        if (!username || !password || !businessName || !businessTypes || businessTypes.length === 0) {
            return res.status(400).json({ message: '所有字段都是必填的' });
        }

        // 检查用户名是否已存在
        const [existingUsers] = await pool.query(
            'SELECT id FROM users WHERE username = ?',
            [username]
        );

        if (existingUsers.length > 0) {
            return res.status(400).json({ message: '用户名已存在' });
        }

        // 开始事务
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // 加密密码
            const hashedPassword = await bcrypt.hash(password, 10);

            // 插入用户记录
            const [userResult] = await connection.query(
                'INSERT INTO users (username, password, user_type) VALUES (?, ?, ?)',
                [username, hashedPassword, userType]
            );

            // 插入商家信息
            const [merchantResult] = await connection.query(
                'INSERT INTO merchants (user_id, business_name) VALUES (?, ?)',
                [userResult.insertId, businessName]
            );

            // 插入商家经营类型
            for (const type of businessTypes) {
                await connection.query(
                    'INSERT INTO merchant_business_types (merchant_id, business_type) VALUES (?, ?)',
                    [merchantResult.insertId, type]
                );
            }

            // 提交事务
            await connection.commit();
            res.status(201).json({ message: '注册成功' });
        } catch (error) {
            // 回滚事务
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('注册错误:', error);
        res.status(500).json({ message: '服务器错误，请稍后重试' });
    }
});

// Netlify商家注册
app.post('/api/merchant/register-netlify', async (req, res) => {
    try {
        const { netlifyId, email, businessName, businessTypes, userType } = req.body;

        // 验证必要字段
        if (!netlifyId || !email || !businessName || !businessTypes || businessTypes.length === 0) {
            return res.status(400).json({ message: '所有字段都是必填的' });
        }

        // 开始事务
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // 插入用户记录
            const [userResult] = await connection.query(
                'INSERT INTO users (netlify_id, email, user_type) VALUES (?, ?, ?)',
                [netlifyId, email, userType]
            );

            // 插入商家信息
            const [merchantResult] = await connection.query(
                'INSERT INTO merchants (user_id, business_name) VALUES (?, ?)',
                [userResult.insertId, businessName]
            );

            // 插入商家经营类型
            for (const type of businessTypes) {
                await connection.query(
                    'INSERT INTO merchant_business_types (merchant_id, business_type) VALUES (?, ?)',
                    [merchantResult.insertId, type]
                );
            }

            // 提交事务
            await connection.commit();
            res.status(201).json({ message: '注册成功' });
        } catch (error) {
            // 回滚事务
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('注册错误:', error);
        res.status(500).json({ message: '服务器错误，请稍后重试' });
    }
});

// 新增统一商家接口(action)
app.post('/api', async (req, res) => {
    const { action, userId, kw = '', status = 'all', date = '' } = req.body || {};
    try {
        switch (action) {
            case 'get_merchant_info': {
                const [rows] = await pool.query('SELECT * FROM merchants WHERE user_id = ?', [userId]);
                if (rows.length === 0) return res.json({ success: false, message: '商家不存在' });
                return res.json({ success: true, merchant: rows[0] });
            }
            case 'get_merchant_products': {
                // 将 userId 转 merchantId
                const [m] = await pool.query('SELECT id FROM merchants WHERE user_id = ? LIMIT 1', [userId]);
                const merchantId = m[0]?.id || 0;
                let sql = 'SELECT * FROM products WHERE merchant_id = ?';
                const params = [merchantId];
                if (kw) { sql += ' AND name LIKE ?'; params.push(`%${kw}%`); }
                const [rows] = await pool.query(sql, params);
                return res.json({ success: true, products: rows });
            }
            case 'get_discount_products': {
                const [rows] = await pool.query('SELECT * FROM products WHERE merchant_id = ? AND discount < 100', [userId]);
                return res.json({ success: true, products: rows });
            }
            case 'get_sales_stats': {
                // 查询销量统计（销量、销售额）
                const [rows] = await pool.query(`
                    SELECT p.id, p.name, p.image_url, SUM(oi.quantity) AS totalSold, SUM(oi.quantity * oi.price) AS totalRevenue
                    FROM order_items oi
                    JOIN products p ON oi.product_id = p.id
                    WHERE p.merchant_id = ?
                    GROUP BY p.id
                    ORDER BY totalSold DESC
                `, [userId]);
                return res.json({ success: true, stats: rows });
            }
            case 'get_merchant_overview': {
                // 今日订单数 & 销售额
                const [todayOrders] = await pool.query(
                    `SELECT COUNT(DISTINCT o.id) AS count, IFNULL(SUM(oi.quantity * oi.price),0) AS sales
                     FROM orders o
                     JOIN order_items oi ON o.id = oi.order_id
                     JOIN products p ON oi.product_id = p.id
                     WHERE p.merchant_id = ? AND DATE(o.created_at) = CURDATE()`
                , [userId]);
                const [productCount] = await pool.query('SELECT COUNT(*) AS total FROM products WHERE merchant_id = ?', [userId]);
                const [pendingOrders] = await pool.query(`SELECT COUNT(DISTINCT o.id) AS total FROM orders o JOIN order_items oi ON o.id = oi.order_id JOIN products p ON oi.product_id = p.id WHERE p.merchant_id = ? AND o.status = 'pending'`, [userId]);
                const overview = {
                    todayOrders: todayOrders[0]?.count || 0,
                    todaySales: parseFloat(todayOrders[0]?.sales || 0),
                    totalProducts: productCount[0]?.total || 0,
                    pendingOrders: pendingOrders[0]?.total || 0,
                    recentOrders: []
                };
                // 最近订单
                const [recent] = await pool.query(`
                    SELECT o.id, o.total_amount, o.status, o.created_at
                    FROM orders o
                    JOIN order_items oi ON o.id = oi.order_id
                    JOIN products p ON oi.product_id = p.id
                    WHERE p.merchant_id = ?
                    GROUP BY o.id
                    ORDER BY o.created_at DESC
                    LIMIT 5
                `, [userId]);
                overview.recentOrders = recent;
                return res.json({ success: true, ...overview });
            }
            case 'get_merchant_orders': {
                // 可按状态或日期过滤
                let sql = `SELECT DISTINCT o.* FROM orders o JOIN order_items oi ON o.id = oi.order_id JOIN products p ON oi.product_id = p.id WHERE p.merchant_id = ?`;
                const params = [userId];
                if (status && status !== 'all') { sql += ' AND o.status = ?'; params.push(status); }
                if (date) { sql += ' AND DATE(o.created_at) = ?'; params.push(date); }
                sql += ' ORDER BY o.created_at DESC';
                const [rows] = await pool.query(sql, params);
                return res.json({ success: true, orders: rows });
            }
            default:
                return res.status(400).json({ success: false, message: 'Unknown action' });
        }
    } catch (err) {
        console.error('/api 动态路由错误', err);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// 显示购物车商品及二维码到ESP32
app.post('/api/display', async (req, res) => {
    try {
        const { text = '', imgRaw = '', width = 0, height = 0 } = req.body;
        console.log('[Display] 将文本发送到 ESP32:', text.replace(/\n/g,' | ').slice(0,60));

        // 已移除发送到 ESP32 的功能

        res.json({ success: true });
    } catch (error) {
        console.warn('ESP32 不可达, 已忽略');
        res.json({ success: true, message: 'ESP32 不可达, 已忽略' });
    }
});

// 购物车同步到ESP32
app.post('/api/cart', async (req, res) => {
    try {
        // 这里只做演示：简单返回成功，可在此处将数据转发给 ESP32
        // const { items, total, itemCount } = req.body;
        return res.json({ success: true, message: '已接收购物车数据' });
    } catch (err) {
        console.error('/api/cart 处理失败', err);
        res.status(500).json({ message: '服务器错误' });
    }
});

// 订单相关API
app.post('/api/orders', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { user_id, items = [], address } = req.body;
        if (!user_id || items.length === 0) {
            return res.status(400).json({ message: '缺少必要参数' });
        }
        const addrVal = address && address.trim() ? address.trim() : 'N/A';
        await connection.beginTransaction();
        let totalAmount = 0;
        let orderMerchantId = null;
        const status = req.body.status || 'paid';
        for (const it of items) {
            const [prows] = await connection.query('SELECT price, discount, stock, merchant_id FROM products WHERE id = ?', [it.id]);
            if(!prows.length) continue;
            const product = prows[0];
            const discountVal = (product.discount !== undefined && product.discount !== null) ? product.discount : 100;
            const finalPrice = product.price * discountVal / 100;
            totalAmount += finalPrice * (it.quantity||1);
            orderMerchantId = orderMerchantId || product.merchant_id;
        }
        // 若未能获取到商品归属商家，则归为平台自营商家
        if (!orderMerchantId) {
            try {
                orderMerchantId = await ensurePlatformMerchant();
            } catch (e) {
                console.error('获取平台商家 ID 失败:', e);
            }
        }
        const [orderRes] = await connection.query('INSERT INTO orders (user_id, total_amount, status, merchant_id, shipping_address) VALUES (?,?,?,?,?)', [user_id, totalAmount, status, orderMerchantId, addrVal]);
        const orderId = orderRes.insertId;
        // 再次循环插入明细并减库存
        for (const it of items) {
            const [prows] = await connection.query('SELECT price, discount, stock FROM products WHERE id = ?', [it.id]);
            if(!prows.length) continue;
            const product = prows[0];
            const discountVal2 = (product.discount !== undefined && product.discount !== null) ? product.discount : 100;
            const finalPrice = product.price * discountVal2 / 100;
            await connection.query('INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?,?,?,?)', [orderId, it.id, it.quantity || 1, finalPrice]);
            await connection.query('UPDATE products SET stock = stock - ? WHERE id = ?', [it.quantity || 1, it.id]);
        }
        await connection.commit();
        res.json({ success: true, orderId });
    } catch (err) {
        await connection.rollback();
        console.error('创建订单失败', err);
        res.status(500).json({ message: '服务器错误' });
    } finally {
        connection.release();
    }
});

// 查询订单，支持 userId 或 merchantId 查询
app.get('/api/orders', async (req, res) => {
    try {
        const { userId, merchantId, status = 'all' } = req.query;
        if (!userId && !merchantId) {
            return res.status(400).json({ message: '缺少查询参数' });
        }
        let sql = 'SELECT DISTINCT o.* FROM orders o';
        const params = [];
        if (merchantId) {
            sql += ' JOIN order_items oi ON o.id = oi.order_id JOIN products p ON oi.product_id = p.id WHERE p.merchant_id = ?';
            params.push(merchantId);
        } else {
            sql += ' WHERE o.user_id = ?';
            params.push(userId);
        }
        if (status !== 'all') { sql += ' AND o.status = ?'; params.push(status); }
        sql += ' ORDER BY o.created_at DESC';
        const [rows] = await pool.query(sql, params);
        res.json({ success: true, orders: rows });
    } catch (err) {
        console.error('查询订单失败', err);
        res.status(500).json({ message: '服务器错误' });
    }
});

// 更新订单状态
app.put('/api/orders/:id', async (req,res)=>{
    try{
        const { id } = req.params;
        const { status } = req.body;
        if(!['pending','paid','shipped','delivered','cancelled'].includes(status)){
            return res.status(400).json({ message:'非法状态' });
        }
        await pool.query('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
        res.json({ success:true });
    }catch(err){ console.error('更新订单状态失败', err); res.status(500).json({ message:'服务器错误' }); }
});

// ------------------- 平台自营商家确保存在 -------------------
async function ensurePlatformMerchant(){
    try{
        // 先查是否已存在标识为 platform 的用户/商家
        const [uRows] = await pool.query('SELECT id FROM users WHERE username = ? LIMIT 1', ['platform']);
        let userId;
        if(uRows.length){
            userId = uRows[0].id;
        }else{
            const hashed = await bcrypt.hash('123456',10);
            const [uRes] = await pool.query('INSERT INTO users (username,password,user_type) VALUES (?,?,"merchant")', ['platform', hashed]);
            userId = uRes.insertId;
        }
        // 查商家表
        const [mRows] = await pool.query('SELECT id FROM merchants WHERE user_id = ? LIMIT 1', [userId]);
        if(mRows.length){
            return mRows[0].id;
        }
        const [mRes] = await pool.query('INSERT INTO merchants (user_id,business_name) VALUES (?,?)', [userId, '平台自营']);
        return mRes.insertId;
    }catch(err){
        console.error('确保平台商家存在失败', err);
        throw err;
    }
}

// -------------- 星火大模型 Chat ----------------
const SPARK_APP_ID = '885c0f82';
const SPARK_API_KEY = 'eHWPqahWJSRJIKhkAgTz';
const SPARK_API_SECRET = 'WLWIxlNqEWjJqvipjNgC';
const SPARK_WS_HOST = 'spark-api.xf-yun.com';
const SPARK_API_URL = 'wss://spark-api.xf-yun.com/v1/x1';

function buildSparkUrl() {
    const path = '/v1/x1';
    const date = new Date().toUTCString(); // GMT format
    const signatureOrigin = `host: ${SPARK_WS_HOST}\n` +
        `date: ${date}\n` +
        `GET ${path} HTTP/1.1`;
    const signature = crypto
        .createHmac('sha256', SPARK_API_SECRET)
        .update(signatureOrigin)
        .digest('base64');

    const rawAuthorization = `api_key=\"${SPARK_API_KEY}\", algorithm=\"hmac-sha256\", headers=\"host date request-line\", signature=\"${signature}\"`;
    const authorization = Buffer.from(rawAuthorization).toString('base64');

    const url = `${SPARK_API_URL}?authorization=${encodeURIComponent(authorization)}&date=${encodeURIComponent(date)}&host=${encodeURIComponent(SPARK_WS_HOST)}`;
    return url;
}

function askSpark(question) {
    return new Promise((resolve, reject) => {
        const wsUrl = buildSparkUrl();
        const ws = new WebSocket(wsUrl);
        let answer = '';

        ws.on('open', () => {
            const req = {
                header: {
                    app_id: SPARK_APP_ID,
                    uid: crypto.randomUUID().replace(/-/g, '').slice(0, 32)
                },
                parameter: {
                    chat: {
                        domain: 'x1',
                        temperature: 0.7,
                        max_tokens: 2048
                    }
                },
                payload: {
                    message: {
                        text: [
                            { role: 'user', content: question }
                        ]
                    }
                }
            };
            ws.send(JSON.stringify(req));
        });

        ws.on('message', (data) => {
            try {
                const resp = JSON.parse(data.toString());
                if (resp?.payload?.choices) {
                    const status = resp.payload.choices.status;
                    const textArr = resp.payload.choices.text;
                    if (Array.isArray(textArr) && textArr.length) {
                        const content = textArr[0].content;
                        if (content) answer += content; // 追加片段
                    }
                    if (status === '2') {
                        ws.close();
                        resolve(answer || '（未获得回答）');
                    }
                }
            } catch (err) {
                console.warn('解析星火响应失败', err);
            }
        });

        ws.on('error', (err) => {
            reject(err);
        });

        ws.on('close', (code, reason) => {
            if (!answer) reject(new Error(`连接关闭: ${code} ${reason}`));
        });
    });
}

app.post('/api/chat', express.json(), async (req, res) => {
    try {
        const { question = '' } = req.body;
        if (!question.trim()) {
            return res.status(400).json({ message: '问题不能为空' });
        }
        const answer = await askSpark(question);
        res.json({ answer });
    } catch (err) {
        console.error('星火 API 调用失败', err);
        res.status(500).json({ message: '星火 API 调用失败', error: err.message });
    }
});

// SSE 实时流式回答
app.get('/api/chat-stream', async (req, res)=>{
    const question = (req.query.question||'').trim();
    if(!question){ res.status(400).end(); return; }

    res.setHeader('Content-Type','text/event-stream');
    res.setHeader('Cache-Control','no-cache');
    res.setHeader('Connection','keep-alive');
    res.flushHeaders();

    const wsUrl = buildSparkUrl();
    const ws = new WebSocket(wsUrl);

    ws.on('open', ()=>{
        const reqJson = {
            header:{app_id:SPARK_APP_ID,uid:crypto.randomUUID().replace(/-/g,'').slice(0,32)},
            parameter:{chat:{domain:'x1',temperature:0.7,max_tokens:2048}},
            payload:{message:{text:[{role:'user',content:question}]}}
        };
        ws.send(JSON.stringify(reqJson));
    });

    ws.on('message', data=>{
        try{
            const resp = JSON.parse(data.toString());
            const choices = resp?.payload?.choices;
            if(!choices) return;
            const textArr = choices.text;
            const status = choices.status;
            if(Array.isArray(textArr) && textArr.length){
                const content = textArr[0].content;
                if(content){ res.write(`data: ${content}\n\n`); }
            }
            if(status==='2'){ ws.close(); res.write('event: done\n'); res.write('data: [DONE]\n\n'); res.end(); }
        }catch(e){ console.error('SSE parse error',e); }
    });

    const cleanup = ()=>{ try{ws.close();}catch(e){} };
    req.on('close', cleanup);
});
// -------------- 星火大模型 Chat end --------------

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