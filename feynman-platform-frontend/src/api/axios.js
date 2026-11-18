// src/api/axios.js
import axios from 'axios';

// 注意：这里不要全局写死 'Content-Type': 'application/json'。
// axios 1.x 检测到请求体是 FormData 且带 json 头时，会把 FormData 序列化成 JSON 字符串，
// 后端 multer 就收不到文件（表现为“没有收到音频文件”）。
// 不写这个头时：普通对象自动用 application/json，FormData 自动用 multipart 并带 boundary。
const apiClient = axios.create({
    baseURL: 'http://localhost:3000/api',
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