const axios = require('axios');

// 获取百度 Access Token
async function getBaiduToken() {
  const apiKey = process.env.BAIDU_API_KEY;
  const secretKey = process.env.BAIDU_SECRET_KEY;

  if (!apiKey || !secretKey || apiKey === '你的_API_KEY') {
    throw new Error('请先在 .env 中配置 BAIDU_API_KEY 和 BAIDU_SECRET_KEY');
  }

  const url = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${apiKey}&client_secret=${secretKey}`;
  const resp = await axios.post(url, {}, { timeout: 10000 });
  return resp.data.access_token;
}

// 百度语音识别（短语音识别）
exports.transcribeAudioLocal = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ msg: "没有收到音频文件" });
  }

  try {
    // 1. 获取 Access Token
    const token = await getBaiduToken();

    // 2. 获取音频格式和采样率（从前端传来的参数）
    const format = req.body.format || 'pcm';
    const rate = parseInt(req.body.rate) || 16000;

    // 3. 将音频转为 base64
    const audioBase64 = req.file.buffer.toString('base64');

    // 4. 调用百度语音识别 API
    const baiduUrl = `https://vop.baidu.com/server_api?dev_pid=1537&cuid=feynman_platform&token=${token}`;
    const resp = await axios.post(
      baiduUrl,
      {
        format: format,      // pcm 格式
        rate: rate,          // 16000 Hz
        channel: 1,          // 单声道
        speech: audioBase64,
        len: req.file.buffer.length
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      }
    );

    // 4. 处理返回结果
    if (resp.data.err_no === 0) {
      const text = resp.data.result.join('');
      res.json({ result: text });
    } else {
      console.error('百度语音识别错误：', resp.data);
      res.status(500).json({ msg: `语音识别失败：${resp.data.err_msg}` });
    }
  } catch (err) {
    console.error('语音识别异常：', err.message);
    res.status(500).json({ msg: err.message || '语音识别服务异常' });
  }
};
