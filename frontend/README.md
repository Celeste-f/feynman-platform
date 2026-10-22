# Feynman 平台 - 前端

技术栈：**Vite + React + React Router + Axios**

## 功能说明

1. 注册页面：填写用户名、邮箱、密码，提交注册，成功跳转登录页
2. 登录页面：邮箱密码登录，请求后端接口，成功保存 Token 并跳转首页
3. 路由守卫：未登录不能访问受保护页面
4. 退出登录：清除 Token 并返回登录页

## 启动方式

```bash
npm install
npm run dev
```

前端默认地址：http://localhost:5173
配套后端地址：http://localhost:3000

## 目录结构

```
frontend/
├── src/
│   ├── components/    # 布局、路由守卫等组件
│   ├── context/       # Auth 全局状态（Token 管理）
│   ├── pages/         # 登录、注册、首页页面
│   └── api/           # Axios 接口封装
├── public/            # 静态资源
└── index.html
```
