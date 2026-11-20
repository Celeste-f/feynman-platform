const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { generateQuestion, gradeAnswer, answerWithRAG } = require('../controllers/baiduAiController');

// AI 智能测评：根据知识点 + 难度 + 题型生成题目（单选 / 简答，需登录）
router.post('/generate-question', auth, generateQuestion);

// AI 阅卷：评判简答题作答（需登录）
router.post('/grade-answer', auth, gradeAnswer);

// 第十一次课：RAG 检索问答——基于用户私有知识库回答问题（需登录）
router.post('/rag-qa', auth, answerWithRAG);

module.exports = router;
