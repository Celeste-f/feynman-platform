# 第十六次课：后端容器化（Node.js API）
# 教案示例用的是 node:18，本项目 mongoose 9 / @xenova 需要 Node 20.13+，故用 24-alpine
FROM node:24-alpine

WORKDIR /app

# 先只拷贝依赖清单：代码改动不会让 npm install 层缓存失效（构建加速的关键技巧）
COPY package*.json ./
RUN npm ci --omit=dev

# 再拷贝源码（.dockerignore 已排除 node_modules/.env/vector_store）
COPY . .

# 向量库是运行时写入的数据文件，用卷挂载持久化，不打进镜像
ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "index.js"]
