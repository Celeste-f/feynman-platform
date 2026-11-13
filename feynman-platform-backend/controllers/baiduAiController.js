const axios = require('axios');

// 获取百度 Access Token（语音识别和千帆共用）
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
    const token = await getBaiduToken();
    const format = req.body.format || 'pcm';
    const rate = parseInt(req.body.rate) || 16000;
    const audioBase64 = req.file.buffer.toString('base64');

    const baiduUrl = `https://vop.baidu.com/server_api?dev_pid=1537&cuid=feynman_platform&token=${token}`;
    const resp = await axios.post(
      baiduUrl,
      {
        format: format,
        rate: rate,
        channel: 1,
        speech: audioBase64,
        len: req.file.buffer.length
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      }
    );

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

// ============ 第八次课：AI 文本润色与智能评价 ============

// 获取千帆 Access Token
async function getQianfanAccessToken() {
  const apiKey = process.env.BAIDU_API_KEY;
  const secretKey = process.env.BAIDU_SECRET_KEY;

  if (!apiKey || !secretKey) {
    throw new Error('请先在 .env 中配置 BAIDU_API_KEY 和 BAIDU_SECRET_KEY');
  }

  const url = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${apiKey}&client_secret=${secretKey}`;
  const response = await axios.post(url, {}, { timeout: 10000 });
  return response.data.access_token;
}

// AI 润色与评价
exports.evaluateFeynmanAttempt = async (req, res) => {
  const { originalContent, transcribedText } = req.body;

  if (!originalContent || !transcribedText) {
    return res.status(400).json({ msg: '原始内容和复述文本不能为空' });
  }

  try {
    const accessToken = await getQianfanAccessToken();

    // ERNIE-Bot-turbo 的 API 地址
    const url = `https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/eb-instant?access_token=${accessToken}`;

    const prompt = `你是一个严格而友善的计算机科学学习教练。你的任务是评估学生对一个知识点的复述，并给出反馈。

【原始知识点】:
\`\`\`
${originalContent}
\`\`\`

【学生的口头复述文本】:
\`\`\`
${transcribedText}
\`\`\`

请你完成以下三项任务:
1. **文本润色**: 将学生的复述文本润色成一段通顺、专业、书面化的文字。修正明显的语法错误和口语化表达，但保持其核心观点不变。
2. **综合评价**: 基于原始知识点，对学生的复述进行评价。指出其优点和可以改进的地方。
3. **评分**: 综合考虑准确性、完整性、逻辑性和流畅性，给出一个0到100的整数分数。

请严格按照以下JSON格式返回你的结果，不要包含任何额外的解释或文字。
{
  "polishedText": "这里是润色后的文本",
  "evaluation": "这里是你的综合评价",
  "strengths": ["优点1", "优点2"],
  "weaknesses": ["可以改进的地方1", "可以改进的地方2"],
  "score": 85
}`;

    const response = await axios.post(url, {
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    }, {
      timeout: 30000
    });

    console.log('文心大模型返回：', response.data);

    // 解析 LLM 返回的 JSON 字符串
    const llmResult = JSON.parse(response.data.result);
    res.json(llmResult);

  } catch (error) {
    console.error('调用文心大模型失败：', error.response ? error.response.data : error.message);
    res.status(500).json({ msg: 'AI 评价服务异常', error: error.message });
  }
};
