const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors'); // 解决跨域问题
require('dotenv').config();
const User = require('./models/User'); // 用户模型
const bcrypt = require('bcryptjs');     // 密码加密工具
const jwt = require('jsonwebtoken');   // JWT 生成 token

const app = express();
const port = process.env.PORT || 3000;

// --- 核心中间件 ---
app.use(cors());         // 允许前端跨域请求
app.use(express.json()); // 解析 JSON 请求体

app.use('/api/users', require('./routes/users'));
app.use('/api/knowledge-points', require('./routes/knowledgePoints'));

// --- 首页路由（保留上节课内容）---
app.get('/', (req, res) => {
  res.send('Hello, Feynman Learner!');
});

// --- API 路由：POST /api/register - 用户注册 ---
app.post('/api/register', async (req, res) => {
  try {
    // 1. 从请求体中获取用户名、邮箱、密码
    const { username, email, password } = req.body;

    // 2. 检查邮箱或用户名是否已存在
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ msg: 'Email already exists' });
    }
    user = await User.findOne({ username });
    if (user) {
      return res.status(400).json({ msg: 'Username already exists' });
    }

    // 3. 创建新用户实例
    user = new User({ username, email, password });

    // 4. 对密码进行哈希加密（安全第一，绝不存明文）
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    // 5. 保存到数据库
    await user.save();

    // 6. 返回成功信息
    res.status(201).json({ msg: 'User registered successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// --- API 路由：POST /api/login - 用户登录 ---
app.post('/api/login', async (req, res) => {
  try {
    // 1. 从请求体中获取邮箱和密码
    const { email, password } = req.body;

    // 2. 根据邮箱查找用户
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: 'User not found' });
    }

    // 3. 用 bcrypt 比对用户输入的明文密码与数据库中的哈希密码
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid password' });
    }

    // 4. 登录成功，生成 JWT token（有效期 1 小时）
    const token = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.status(200).json({
      msg: 'Login successfully',
      token: token,
      user: { id: user._id, username: user.username, email: user.email }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// --- API 路由：GET /api/users - 获取所有用户（验证数据已入库，不返回密码）---
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find().select('-password'); // -password 表示排除密码字段
    res.status(200).json(users);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// --- 数据库连接 ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected successfully!'))
  .catch(err => console.error('MongoDB connection error:', err));

// --- 启动服务器 ---
app.listen(port, () => {
  console.log(`Feynman Platform backend is running at http://localhost:${port}`);
});
