# 购物系统

## 项目说明
这是一个基于 Express + MySQL 的动态购物网站系统，支持用户和商家两种角色，具备完整的购物车和订单管理功能。

## 功能特点

- 用户功能
  - 用户注册和登录
  - 商品浏览和搜索
  - 购物车管理
  - 商品分类浏览
  - 促销商品查看

- 商家功能
  - 商家注册和登录
  - 商品管理（添加、编辑、删除）
  - 销量统计
  - 折扣商品管理

## 技术栈

- 前端：HTML5, CSS3, JavaScript
- 后端：LeanCloud
- 数据存储：LeanCloud 云数据库
- 实时数据同步：LeanCloud LiveQuery

## 在线访问

访问地址：https://tby123.github.io/shop-system/

## 本地开发

1. 克隆项目
```bash
git clone <your-repo-url>
cd your-project
```

2. 安装依赖
```bash
npm install
```

3. 配置环境变量
复制 `.env.example` 到 `.env`：
```bash
cp .env.example .env
```

然后修改 `.env` 文件：
```properties
# 数据库配置
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=123456
DB_NAME=shopping_system

# 服务器配置
PORT=3000
NODE_ENV=development

# JWT配置（使用 node -e "console.log(require('crypto').randomBytes(64).toString('hex'))" 生成）
JWT_SECRET=your-secret-key-please-change

# Netlify配置
NETLIFY_SITE_URL=http://localhost:3000
```

4. 初始化数据库
```bash
mysql -u root -p < database.sql
```

5. 启动开发服务器
```bash
npm run dev
```

## Netlify 部署

1. 连接 GitHub 仓库
- 在 Netlify 控制台创建新站点
- 选择 "Import an existing project"
- 选择你的 GitHub 仓库

2. 配置构建设置
- Build command: `npm run build`
- Publish directory: `dist`

3. 设置环境变量
在 Netlify 控制台：
- Site settings > Environment variables
- 添加所有必需的环境变量：
  - `DB_HOST`
  - `DB_USER`
  - `DB_PASSWORD`
  - `DB_NAME`
  - `JWT_SECRET`（使用新生成的随机值）
  - `NODE_ENV=production`

4. 配置域名（可选）
- 在 "Domain settings" 中添加自定义域名
- 设置 SSL 证书

## 安全注意事项

1. JWT 密钥
- 不要在代码中硬编码 JWT_SECRET
- 在生产环境使用足够长的随机密钥
- 定期轮换密钥

2. 数据库
- 使用强密码
- 限制数据库访问IP
- 定期备份

3. API 安全
- 所有敏感操作都需要验证 token
- 实施速率限制
- 使用 HTTPS
- 设置适当的 CORS 策略

## 许可证
MIT