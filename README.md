# Feynman 平台

**第四次实验**：React 前端 + Node.js 后端的登录注册平台。

## 项目结构

```
feynman-platform/
├── frontend/   # 前端（Vite + React + React Router + Axios）
└── backend/    # 后端（Node.js + Express + MongoDB + JWT）
```

## 功能说明

- 用户注册：填写用户名、邮箱、密码，加密后存入数据库
- 用户登录：校验账号密码，返回 JWT Token
- 路由守卫：未登录不能访问受保护页面
- 登录成功后跳转首页，支持退出登录

## 启动方式

### 后端

```bash
cd backend
npm install
node index.js
```

后端默认地址：http://localhost:3000

### 前端

```bash
cd frontend
npm install
npm run dev
```

前端默认地址：http://localhost:5173

## 技术栈

- 前端：Vite、React、React Router、Axios
- 后端：Node.js、Express、MongoDB、Mongoose、JWT、bcryptjs
