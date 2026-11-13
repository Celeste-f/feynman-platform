const express = require('express');
const router = express.Router();
const multer = require('multer');
const auth = require('../middleware/auth');
const baiduCtrl = require('../controllers/baiduAiController');

const upload = multer();

// 语音转文字
router.post("/transcribe-local", upload.single("audio"), baiduCtrl.transcribeAudioLocal);

// AI 润色与评价
router.post("/evaluate", auth, baiduCtrl.evaluateFeynmanAttempt);

module.exports = router;
