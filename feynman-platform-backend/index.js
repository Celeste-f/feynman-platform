const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const app = express();
const port = process.env.PORT || 3000;

// --- 核心中间件 ---
app.use(cors());
app.use(express.json());

// --- API 路由 ---
app.use('/api/users', require('./routes/users'));
app.use('/api/knowledge-points', require('./routes/knowledgePoints'));
app.use('/api/audio', require('./routes/audio'));

// --- 首页 ---
app.get('/', (req, res) => {
  res.send('Hello, Feynman Learner!');
});

// --- 数据库连接 ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected successfully!'))
  .catch(err => console.error('MongoDB connection error:', err));

// --- 启动服务器 ---
app.listen(port, () => {
  console.log(`Feynman Platform backend is running at http://localhost:${port}`);
});
