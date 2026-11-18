const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { generateQuestion, gradeAnswer } = require('../controllers/baiduAiController');

// AI 智能测评：根据知识点 + 难度 + 题型生成题目（单选 / 简答，需登录）
router.post('/generate-question', auth, generateQuestion);

// AI 阅卷：评判简答题作答（需登录）
router.post('/grade-answer', auth, gradeAnswer);

module.exports = router;
