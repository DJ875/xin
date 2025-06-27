# 购物系统

这是一个基于Express和MySQL的购物系统，支持商家管理和用户购物功能。

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

1. 克隆仓库：
   ```bash
   git clone <repository-url>
   cd shopping-system
   ```

2. 安装依赖：
   ```bash
   npm install
   ```

3. 创建`.env`文件并设置环境变量：
   ```
   DB_HOST=your_db_host
   DB_USER=your_db_user
   DB_PASSWORD=your_db_password
   DB_NAME=your_db_name
   ```

4. 启动开发服务器：
   ```bash
   npm start
   ```

## 更新部署

1. 提交更改到Git：
   ```bash
   git add .
   git commit -m "更新说明"
   git push
   ```

2. Netlify将自动检测到更改并重新部署

## 注意事项

- 确保数据库连接信息安全，不要提交到代码仓库
- 图片上传限制为10MB
- API请求超时时间设置为120秒
- 所有API端点都以`/.netlify/functions/api`开头