# Feynman 平台 - 后端

技术栈：**Node.js + Express + MongoDB + JWT**

## 接口功能

- `POST /api/users/register`：用户注册（密码 bcrypt 加密后存入数据库）
- `POST /api/users/login`：用户登录（校验账号密码，返回 JWT Token）
- 中间件 `middleware/auth.js`：JWT 鉴权，无有效 Token 返回 401
- `GET/POST /api/knowledgePoints`：知识点查询与新增（需登录）

## 启动方式

```bash
npm install
node index.js
```

后端服务地址：http://localhost:3000

## 环境变量

根目录 `.env` 文件：

```
MONGO_URI=你的MongoDB连接串
JWT_SECRET=你的签名密钥
PORT=3000
```

## 目录结构

```
backend/
├── index.js            # 入口，启动服务并连接数据库
├── models/             # Mongoose 数据模型（User、KnowledgePoint）
├── routes/             # 路由（users、knowledgePoints）
└── middleware/         # 中间件（auth 鉴权）
```
