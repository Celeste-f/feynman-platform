# 第十六次课：前端容器化 —— 多阶段构建
# 阶段1（builder）：Node 环境编译 React -> dist 静态文件
FROM node:24-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# 阶段2（生产）：只要 nginx + dist，镜像从几百MB瘦身到几十MB
FROM nginx:stable-alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
