const express = require('express');
const serverless = require('serverless-http');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const crypto = require('crypto');
const WebSocket = require('ws');

const app = express();

// 设置请求体大小限制为10MB
app.use(bodyParser.json({limit: '10mb'}));
app.use(bodyParser.urlencoded({limit: '10mb', extended: true}));

// CORS配置
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'netlify-token']
}));

// 数据库连接池
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

const SPARK_APP_ID = '885c0f82';
const SPARK_API_KEY = 'eHWPqahWJSRJIKhkAgTz';
const SPARK_API_SECRET = 'WLWIxlNqEWjJqvipjNgC';
const SPARK_WS_HOST = 'spark-api.xf-yun.com';
const SPARK_API_URL = 'wss://spark-api.xf-yun.com/v1/x1';

function buildSparkUrl(){
  const path='/v1/x1';
  const date=new Date().toUTCString();
  const signatureOrigin=`host: ${SPARK_WS_HOST}\n`+`date: ${date}\n`+`GET ${path} HTTP/1.1`;
  const signature=crypto.createHmac('sha256',SPARK_API_SECRET).update(signatureOrigin).digest('base64');
  const rawAuth=`api_key=\"${SPARK_API_KEY}\", algorithm=\"hmac-sha256\", headers=\"host date request-line\", signature=\"${signature}\"`;
  const authorization=Buffer.from(rawAuth).toString('base64');
  return `${SPARK_API_URL}?authorization=${encodeURIComponent(authorization)}&date=${encodeURIComponent(date)}&host=${encodeURIComponent(SPARK_WS_HOST)}`;
}

function askSpark(question){
  return new Promise((resolve,reject)=>{
    const ws=new WebSocket(buildSparkUrl());
    let answer='';
    ws.on('open',()=>{
      ws.send(JSON.stringify({header:{app_id:SPARK_APP_ID,uid:crypto.randomUUID().replace(/-/g,'').slice(0,32)},parameter:{chat:{domain:'x1',temperature:0.7,max_tokens:2048}},payload:{message:{text:[{role:'user',content:question}]}}}));
    });
    ws.on('message',data=>{
      try{
        const resp=JSON.parse(data.toString());
        if(resp?.payload?.choices){
          const status=resp.payload.choices.status;
          const arr=resp.payload.choices.text;
          if(Array.isArray(arr)&&arr.length){const c=arr[0].content;if(c) answer=c;}
          if(status==='2'){ws.close();resolve(answer);} }
      }catch(e){console.warn('解析星火失败',e);}
    });
    ws.on('error',reject);
    ws.on('close',(c,r)=>{if(!answer) reject(new Error(`关闭:${c} ${r}`));});
  });
}

// 验证Netlify Identity Token
async function verifyNetlifyToken(token) {
    try {
        const response = await fetch('https://api.netlify.com/api/v1/user', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Invalid token');
        }
        
        return await response.json();
    } catch (error) {
        console.error('Netlify token验证错误:', error);
        return null;
    }
}

// Netlify Identity 验证中间件
async function authenticateNetlifyUser(req, res, next) {
    const netlifyToken = req.headers['netlify-token'];
    
    if (!netlifyToken) {
        return res.status(401).json({ message: '未提供认证令牌' });
    }

    try {
        const response = await fetch('https://api.netlify.com/api/v1/user', {
            headers: { 'Authorization': `Bearer ${netlifyToken}` }
        });

        if (!response.ok) {
            throw new Error('无效的认证令牌');
        }

        const userData = await response.json();
        req.netlifyUser = userData;
        next();
    } catch (error) {
        console.error('Netlify认证错误:', error);
        res.status(401).json({ message: '认证失败' });
    }
}

// 验证 Netlify Identity 用户
async function verifyNetlifyUser(user, userType) {
    const connection = await pool.getConnection();
    try {
        // 检查用户是否已存在
        const [rows] = await connection.execute(
            'SELECT * FROM users WHERE netlify_id = ?',
            [user.id]
        );

        if (rows.length === 0) {
            // 创建新用户
            const [result] = await connection.execute(
                'INSERT INTO users (netlify_id, email, user_type, created_at) VALUES (?, ?, ?, NOW())',
                [user.id, user.email, userType]
            );
            return { success: true, userId: result.insertId };
        }

        // 验证用户类型
        if (rows[0].user_type !== userType) {
            return { success: false, message: '用户类型不匹配' };
        }

        return { success: true, userId: rows[0].id };
    } catch (error) {
        console.error('数据库错误:', error);
        return { success: false, message: '服务器错误' };
    } finally {
        connection.release();
    }
}

// 本地登录验证
async function localLogin(username, password, userType) {
    const connection = await pool.getConnection();
    try {
        // 查询用户
        const [rows] = await connection.execute(
            'SELECT * FROM users WHERE username = ? AND user_type = ?',
            [username, userType]
        );

        if (rows.length === 0) {
            return { success: false, message: '用户名或密码错误' };
        }

        // 验证密码
        const isValid = await bcrypt.compare(password, rows[0].password);
        if (!isValid) {
            return { success: false, message: '用户名或密码错误' };
        }

        return { success: true, userId: rows[0].id };
    } catch (error) {
        console.error('数据库错误:', error);
        return { success: false, message: '服务器错误' };
    } finally {
        connection.release();
    }
}

// 商家注册处理
async function registerMerchant(username, password, businessName, businessTypes) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 检查用户名是否已存在
        const [existingUsers] = await connection.execute(
            'SELECT id FROM users WHERE username = ?',
            [username]
        );

        if (existingUsers.length > 0) {
            return { success: false, message: '用户名已存在' };
        }

        // 检查商家名称是否已存在
        const [existingMerchants] = await connection.execute(
            'SELECT id FROM merchants WHERE business_name = ?',
            [businessName]
        );

        if (existingMerchants.length > 0) {
            return { success: false, message: '商家名称已存在' };
        }

        // 创建用户账号
        const hashedPassword = await bcrypt.hash(password, 10);
        const [userResult] = await connection.execute(
            'INSERT INTO users (username, password, user_type, created_at) VALUES (?, ?, "merchant", NOW())',
            [username, hashedPassword]
        );

        // 创建商家信息
        await connection.execute(
            'INSERT INTO merchants (user_id, business_name, business_type, created_at) VALUES (?, ?, ?, NOW())',
            [userResult.insertId, businessName, businessTypes.join(',')]
        );

        await connection.commit();
        return { success: true };
    } catch (error) {
        await connection.rollback();
        console.error('注册错误:', error);
        return { success: false, message: '注册失败，请稍后重试' };
    } finally {
        connection.release();
    }
}

// 用户注册处理
async function registerUser(username, password) {
    const connection = await pool.getConnection();
    try {
        // 检查用户名是否已存在
        const [existing] = await connection.execute(
            'SELECT id FROM users WHERE username = ?',
            [username]
        );

        if (existing.length > 0) {
            return { success: false, message: '用户名已存在' };
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await connection.execute(
            'INSERT INTO users (username, password, user_type, created_at) VALUES (?, ?, "user", NOW())',
            [username, hashedPassword]
        );

        return { success: true };
    } catch (error) {
        console.error('注册用户错误:', error);
        return { success: false, message: '注册失败，请稍后重试' };
    } finally {
        connection.release();
    }
}

// 用户注册
router.post('/register', async (req, res) => {
    try {
        console.log('收到注册请求:', req.body);
        const { username, password, userType, businessName, netlifyToken } = req.body;
        
        if (!username || (!password && !netlifyToken) || !userType) {
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
            let hashedPassword = null;
            
            // 如果是Netlify登录，验证token
            if (netlifyToken) {
                const netlifyUser = await verifyNetlifyToken(netlifyToken);
                if (!netlifyUser) {
                    throw new Error('Invalid Netlify token');
                }
            } else {
                // 本地登录，加密密码
                hashedPassword = await bcrypt.hash(password, 10);
            }
            
            // 插入用户数据
            const [userResult] = await promisePool.query(
                'INSERT INTO users (username, password, user_type, is_netlify_user) VALUES (?, ?, ?, ?)',
                [username, hashedPassword, userType, netlifyToken ? 1 : 0]
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
        const { username, password, userType, netlifyToken } = req.body;
        
        // 获取用户信息
        const [users] = await promisePool.query(
            'SELECT id, username, password, user_type, is_netlify_user FROM users WHERE username = ?',
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
        
        // 根据登录方式验证
        if (netlifyToken) {
            // Netlify登录
            const netlifyUser = await verifyNetlifyToken(netlifyToken);
            if (!netlifyUser) {
                return res.status(401).json({ message: 'Netlify验证失败' });
            }
        } else {
            // 本地登录
            if (!user.password) {
                return res.status(401).json({ message: '此账号使用Netlify登录，请选择Netlify登录方式' });
            }
            
            const passwordMatch = await bcrypt.compare(password, user.password);
            if (!passwordMatch) {
                return res.status(401).json({ message: '密码错误' });
            }
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
                isNetlifyUser: user.is_netlify_user === 1,
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
        const { category, merchant_id, search, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        let query = 'SELECT p.*, m.business_name FROM products p LEFT JOIN merchants m ON p.merchant_id = m.id WHERE 1=1';
        const params = [];

        if (category) {
            query += ' AND p.category = ?';
            params.push(category);
        }

        if (merchant_id) {
            query += ' AND p.merchant_id = ?';
            params.push(merchant_id);
        }

        if (search) {
            query += ' AND (p.name LIKE ? OR p.description LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        query += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
        params.push(Number(limit), Number(offset));

        const [products] = await promisePool.query(query, params);
        const [total] = await promisePool.query('SELECT COUNT(*) as total FROM products');

        res.json({
            products,
            pagination: {
                total: total[0].total,
                page: Number(page),
                limit: Number(limit),
                pages: Math.ceil(total[0].total / limit)
            }
        });
    } catch (error) {
        console.error('获取商品列表错误:', error);
        res.status(500).json({ message: '服务器错误' });
    }
});

// 商家管理商品
router.post('/merchant/products', authenticateNetlifyUser, async (req, res) => {
    try {
        const { name, price, description, category, image_url, stock } = req.body;
        
        // 获取商家信息
        const [merchants] = await promisePool.query(
            'SELECT m.* FROM merchants m JOIN users u ON m.user_id = u.id WHERE u.netlify_id = ?',
            [req.netlifyUser.id]
        );

        if (merchants.length === 0) {
            return res.status(403).json({ message: '未找到商家信息' });
        }

        const [result] = await promisePool.query(
            'INSERT INTO products (merchant_id, name, price, description, category, image_url, stock) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [merchants[0].id, name, price, description, category, image_url, stock]
        );

        res.status(201).json({
            success: true,
            product: {
                id: result.insertId,
                merchant_id: merchants[0].id,
                name,
                price,
                description,
                category,
                image_url,
                stock
            }
        });
    } catch (error) {
        console.error('添加商品错误:', error);
        res.status(500).json({ message: '服务器错误' });
    }
});

// 购物车管理
router.post('/cart', authenticateNetlifyUser, async (req, res) => {
    try {
        const { product_id, quantity } = req.body;

        // 获取用户ID
        const [users] = await promisePool.query(
            'SELECT id FROM users WHERE netlify_id = ?',
            [req.netlifyUser.id]
        );

        if (users.length === 0) {
            return res.status(404).json({ message: '用户不存在' });
        }

        // 获取或创建购物车
        let [carts] = await promisePool.query(
            'SELECT id FROM carts WHERE user_id = ?',
            [users[0].id]
        );

        let cartId;
        if (carts.length === 0) {
            const [result] = await promisePool.query(
                'INSERT INTO carts (user_id) VALUES (?)',
                [users[0].id]
            );
            cartId = result.insertId;
        } else {
            cartId = carts[0].id;
        }

        // 更新购物车商品
        await promisePool.query(
            'INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)',
            [cartId, product_id, quantity]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('购物车操作错误:', error);
        res.status(500).json({ message: '服务器错误' });
    }
});

// 获取购物车内容
router.get('/cart', authenticateNetlifyUser, async (req, res) => {
    try {
        const [users] = await promisePool.query(
            'SELECT id FROM users WHERE netlify_id = ?',
            [req.netlifyUser.id]
        );

        if (users.length === 0) {
            return res.status(404).json({ message: '用户不存在' });
        }

        const [cartItems] = await promisePool.query(
            `SELECT ci.*, p.name, p.price, p.image_url, m.business_name 
             FROM carts c 
             JOIN cart_items ci ON c.id = ci.cart_id 
             JOIN products p ON ci.product_id = p.id 
             JOIN merchants m ON p.merchant_id = m.id 
             WHERE c.user_id = ?`,
            [users[0].id]
        );

        res.json({ items: cartItems });
    } catch (error) {
        console.error('获取购物车错误:', error);
        res.status(500).json({ message: '服务器错误' });
    }
});

// 创建订单
router.post('/orders', authenticateNetlifyUser, async (req, res) => {
    try {
        const { shipping_address, contact_phone } = req.body;

        // 获取用户信息和购物车
        const [users] = await promisePool.query(
            'SELECT id FROM users WHERE netlify_id = ?',
            [req.netlifyUser.id]
        );

        if (users.length === 0) {
            return res.status(404).json({ message: '用户不存在' });
        }

        const userId = users[0].id;

        // 开始事务
        const connection = await promisePool.getConnection();
        await connection.beginTransaction();

        try {
            // 获取购物车商品
            const [cartItems] = await connection.query(
                `SELECT ci.*, p.price 
                 FROM carts c 
                 JOIN cart_items ci ON c.id = ci.cart_id 
                 JOIN products p ON ci.product_id = p.id 
                 WHERE c.user_id = ?`,
                [userId]
            );

            if (cartItems.length === 0) {
                throw new Error('购物车为空');
            }

            // 计算总金额
            const total_amount = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

            // 创建订单
            const [orderResult] = await connection.query(
                'INSERT INTO orders (user_id, total_amount, shipping_address, contact_phone) VALUES (?, ?, ?, ?)',
                [userId, total_amount, shipping_address, contact_phone]
            );

            // 添加订单商品
            for (const item of cartItems) {
                await connection.query(
                    'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
                    [orderResult.insertId, item.product_id, item.quantity, item.price]
                );

                // 更新商品库存
                await connection.query(
                    'UPDATE products SET stock = stock - ? WHERE id = ?',
                    [item.quantity, item.product_id]
                );
            }

            // 清空购物车
            await connection.query(
                'DELETE ci FROM cart_items ci JOIN carts c ON ci.cart_id = c.id WHERE c.user_id = ?',
                [userId]
            );

            await connection.commit();

            res.json({
                success: true,
                order: {
                    id: orderResult.insertId,
                    total_amount,
                    items: cartItems
                }
            });
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('创建订单错误:', error);
        res.status(500).json({ message: error.message || '服务器错误' });
    }
});

// 用户注册/登录后同步到数据库
router.post('/auth/sync', authenticateNetlifyUser, async (req, res) => {
    try {
        const { email, full_name, user_metadata } = req.netlifyUser;
        const userType = req.body.userType || 'user';

        // 检查用户是否已存在
        const [users] = await promisePool.query(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );

        let userId;
        if (users.length === 0) {
            // 创建新用户
            const [result] = await promisePool.query(
                'INSERT INTO users (email, username, user_type, netlify_id) VALUES (?, ?, ?, ?)',
                [email, full_name || email, userType, req.netlifyUser.id]
            );
            userId = result.insertId;
        } else {
            userId = users[0].id;
        }

        // 如果是商家，处理商家信息
        if (userType === 'merchant' && req.body.businessName) {
            const [merchants] = await promisePool.query(
                'SELECT * FROM merchants WHERE user_id = ?',
                [userId]
            );

            if (merchants.length === 0) {
                // 创建商家记录
                const [result] = await promisePool.query(
                    'INSERT INTO merchants (user_id, business_name) VALUES (?, ?)',
                    [userId, req.body.businessName]
                );

                // 添加经营类型
                if (req.body.businessTypes && Array.isArray(req.body.businessTypes)) {
                    for (const type of req.body.businessTypes) {
                        await promisePool.query(
                            'INSERT INTO merchant_business_types (merchant_id, business_type) VALUES (?, ?)',
                            [result.insertId, type]
                        );
                    }
                }
            }
        }

        res.json({
            success: true,
            user: {
                id: userId,
                email,
                userType,
                netlifyId: req.netlifyUser.id
            }
        });
    } catch (error) {
        console.error('用户同步错误:', error);
        res.status(500).json({ message: '服务器错误' });
    }
});

// 将商品列表和二维码转发给 ESP32
router.post('/display', async (req, res) => {
    // 硬件功能已移除，直接返回成功
    res.json({ success: true });
});

router.post('/chat', async (req,res)=>{
  try{
    const {question=''}=req.body||{};
    if(!question.trim()) return res.status(400).json({message:'问题不能为空'});
    const answer=await askSpark(question);
    res.json({answer});
  }catch(err){console.error('星火失败',err);res.status(500).json({message:'星火失败',error:err.message});}
});

router.get('/chat-stream', async (req,res)=>{
  const question = (req.query.question||'').trim();
  if(!question){ return res.status(400).json({message:'问题不能为空'}); }

  res.setHeader('Content-Type','text/event-stream');
  res.setHeader('Cache-Control','no-cache');
  res.setHeader('Connection','keep-alive');
  res.flushHeaders();

  try{
    await streamSpark(question, res);
  }catch(err){ console.error('SSE失败',err); res.write(`data: 出错 - ${err.message}\n\n`); res.end(); }
});

function streamSpark(question, res){
  const ws = new WebSocket(buildSparkUrl());
  ws.on('open',()=>{
      ws.send(JSON.stringify({header:{app_id:SPARK_APP_ID,uid:crypto.randomUUID().replace(/-/g,'').slice(0,32)},parameter:{chat:{domain:'x1',temperature:0.7,max_tokens:2048}},payload:{message:{text:[{role:'user',content:question}]}}}));
  });
  ws.on('message',data=>{
    try{
      const resp = JSON.parse(data.toString());
      const choices = resp?.payload?.choices;
      if(!choices) return;
      const status = choices.status;
      const arr = choices.text;
      if(Array.isArray(arr)&&arr.length){ const c = arr[0].content; if(c) res.write(`data: ${c}\n\n`); }
      if(status==='2'){ ws.close(); res.write('event: done\n'); res.write('data: [DONE]\n\n'); res.end(); }
    }catch(e){ console.warn('SSE parse error',e); }
  });
  ws.on('error',err=>{ res.write(`data: 出错 - ${err.message}\n\n`); res.end(); });
  return;
}

app.use('/.netlify/functions/api', router);

// 导出serverless handler
module.exports.handler = serverless(app); 