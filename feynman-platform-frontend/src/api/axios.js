// src/api/axios.js
import axios from 'axios';

// 注意：这里不要全局写死 'Content-Type': 'application/json'。
// axios 1.x 检测到请求体是 FormData 且带 json 头时，会把 FormData 序列化成 JSON 字符串，
// 后端 multer 就收不到文件（表现为“没有收到音频文件”）。
// 不写这个头时：普通对象自动用 application/json，FormData 自动用 multipart 并带 boundary。
// 第十六次课：API 地址按运行环境自适应（三种场景）
//   1. 开发模式（vite dev）：直连本机后端 http://localhost:3000/api
//   2. Electron 生产版（file:// 协议）：同样直连本机后端（桌面版=本地前后端配套）
//   3. 线上部署（https://域名）：用相对路径 /api，由 Nginx 反向代理到后端容器
//   也可用环境变量 VITE_API_BASE 强制指定（构建时注入）
const isElectronFile = typeof window !== 'undefined' && window.location.protocol === 'file:';
const baseURL =
  import.meta.env.VITE_API_BASE ||
  (import.meta.env.DEV || isElectronFile ? 'http://localhost:3000/api' : '/api');

const apiClient = axios.create({
    baseURL,
});

// 请求拦截器：每次请求自动带上token
apiClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers['x-auth-token'] = token;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export default apiClient;