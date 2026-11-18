const express = require('express');
const router = express.Router();
const multer = require('multer');
const auth = require('../middleware/auth');
const baiduCtrl = require('../controllers/baiduAiController');

const upload = multer();

// 语音转文字
router.post("/transcribe-local", upload.single("audio"), baiduCtrl.transcribeAudioLocal);

// AI 润色与评价（原始知识点 vs 学生复述）
router.post("/evaluate", auth, baiduCtrl.evaluateFeynmanAttempt);

// 新建知识点：语音口述内容自动评分
router.post("/evaluate-speech", auth, baiduCtrl.evaluateSpeech);

module.exports = router;
