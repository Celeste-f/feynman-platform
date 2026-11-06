const express = require('express');
const router = express.Router();
const multer = require('multer');
const whisperCtrl = require('../controllers/whisperController');

const upload = multer();

router.post("/transcribe-local", upload.single("audio"), whisperCtrl.transcribeAudioLocal);

module.exports = router;
