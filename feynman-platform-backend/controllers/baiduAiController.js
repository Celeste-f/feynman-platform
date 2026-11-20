const axios = require('axios');
const KnowledgePoint = require('../models/KnowledgePoint');
// 第十一次课：RAG 检索（复用第十次课的本地向量库服务）
const { searchRelevant } = require('../services/vectorStoreService');

// ==================== 语音识别（百度短语音 ASR，用 AK/SK 换 access_token） ====================

async function getBaiduToken() {
  const apiKey = process.env.BAIDU_API_KEY;
  const secretKey = process.env.BAIDU_SECRET_KEY;

  if (!apiKey || !secretKey) {
    throw new Error('请先在 .env 中配置 BAIDU_API_KEY 和 BAIDU_SECRET_KEY');
  }

  const url = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${apiKey}&client_secret=${secretKey}`;
  const resp = await axios.post(url, {}, { timeout: 10000 });
  return resp.data.access_token;
}

exports.transcribeAudioLocal = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ msg: '没有收到音频文件' });
  }

  try {
    const token = await getBaiduToken();
    const format = req.body.format || 'pcm';
    const rate = parseInt(req.body.rate) || 16000;
    const audioBase64 = req.file.buffer.toString('base64');

    // 注意：token / cuid / dev_pid 必须放在 JSON 请求体里，
    // 放在 URL 查询参数上会被忽略，从而报 3311 "param rate invalid"。
    const resp = await axios.post(
      'https://vop.baidu.com/server_api',
      {
        format: format,
        rate: rate,
        channel: 1,
        cuid: 'feynman_platform',
        token: token,
        dev_pid: 1537,
        speech: audioBase64,
        len: req.file.buffer.length
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
        validateStatus: () => true
      }
    );

    if (resp.data.err_no === 0) {
      res.json({ result: resp.data.result.join('') });
    } else {
      console.error('百度语音识别错误：', resp.data);
      res.status(500).json({ msg: `语音识别失败：${resp.data.err_msg}` });
    }
  } catch (err) {
    console.error('语音识别异常：', err.message);
    res.status(500).json({ msg: err.message || '语音识别服务异常' });
  }
};

// ==================== 大模型：豆包（火山方舟 Ark） ====================
//
// 火山方舟提供 OpenAI 兼容接口：
//   POST https://ark.cn-beijing.volces.com/api/v3/chat/completions
//   Header: Authorization: Bearer <ARK_API_KEY>
// 模型可以填「模型名称」(如 doubao-seed-1-6-250615) 或控制台创建的「接入点 ID」(ep-xxxx)

const ARK_URL = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';

async function callDoubao(messages) {
  const raw = await arkChat(messages);
  return parseJsonResult(raw);
}

// 底层调用：返回模型输出的原始文本（第十一次课 RAG 问答需要纯文本回答，不做 JSON 解析）
async function arkChat(messages) {
  const apiKey = process.env.ARK_API_KEY;
  // 兼容两种写法：ARK_MODEL 或 ARK_MODEL_ID（填模型 ID 或接入点 ID 都可以）
  const model = process.env.ARK_MODEL || process.env.ARK_MODEL_ID;

  if (!apiKey || apiKey === '你的_ARK_API_KEY') {
    throw new Error('请先在 .env 中配置 ARK_API_KEY（火山方舟控制台创建）');
  }
  if (!model) {
    throw new Error('请先在 .env 中配置 ARK_MODEL（模型 ID 或接入点 ID，例如 doubao-seed-2-1-lite-260915）');
  }

  const resp = await axios.post(
    ARK_URL,
    {
      model,
      messages,
      temperature: 0.3
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 120000,
      validateStatus: () => true
    }
  );

  if (resp.status === 401 || resp.status === 403) {
    throw new Error('豆包 API Key 无效或没有权限，请检查 .env 中的 ARK_API_KEY');
  }

  if (resp.data && resp.data.error) {
    const code = resp.data.error.code || resp.status;
    const msg = resp.data.error.message || '未知错误';
    if (/model/i.test(String(code))) {
      throw new Error(
        `模型「${model}」不存在或未开通，请在火山方舟控制台开通该模型，并把模型 ID 填到 .env 的 ARK_MODEL（当前：${model}）`
      );
    }
    throw new Error(`豆包调用失败(${code})：${msg}`);
  }

  const raw = (resp.data.choices?.[0]?.message?.content || '').trim();
  console.log('豆包返回原始内容：', raw);
  return raw;
}

// 把模型返回的文本解析成 JSON（兼容被 ```json 包裹的情况）
function parseJsonResult(raw) {
  const jsonText = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try {
    return JSON.parse(jsonText);
  } catch (e) {
    const match = jsonText.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error('AI 返回内容不是合法 JSON：' + raw.slice(0, 80));
    }
    return JSON.parse(match[0]);
  }
}

// 根据 AI 分数自动更新知识点状态与复习标记（课程8挑战作业）：
//   score < 60  → status=learned_not_mastered，reviewList=true（加入复习列表）
//   score >= 60 → status=mastered，reviewList=false（移除复习标记）
async function applyStatusByScore(knowledgePointId, userId, score) {
  const num = Number(score);
  if (!knowledgePointId || !Number.isFinite(num)) return null;

  const mastered = num >= 60;
  const status = mastered ? 'mastered' : 'learned_not_mastered';
  const reviewList = !mastered;

  try {
    const kp = await KnowledgePoint.findOneAndUpdate(
      { _id: knowledgePointId, user: userId },
      { $set: { status, reviewList } },
      { new: true }
    );
    if (!kp) {
      console.warn(`状态更新失败：找不到知识点 ${knowledgePointId}（或不属于当前用户）`);
      return null;
    }
    console.log(`知识点 ${knowledgePointId} 评分 ${num}，状态→${status}，复习→${reviewList}`);
    return status;
  } catch (err) {
    console.error('状态更新失败：', err.message);
    return null;
  }
}


const RESULT_FORMAT = `请严格按照以下JSON格式返回，不要包含任何额外的解释或文字：
{
  "polishedText": "这里是润色后的文本",
  "evaluation": "这里是你的综合评价",
  "strengths": ["优点1", "优点2"],
  "weaknesses": ["可以改进的地方1", "可以改进的地方2"],
  "score": 85
}`;

// AI 润色与评价（原始知识点 vs 学生复述）
exports.evaluateFeynmanAttempt = async (req, res) => {
  const { originalContent, transcribedText, knowledgePointId } = req.body;

  if (!originalContent || !transcribedText) {
    return res.status(400).json({ msg: '原始内容和复述文本不能为空' });
  }

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

${RESULT_FORMAT}`;

  try {
    const llmResult = await callDoubao([
      { role: 'system', content: '你是严谨的计算机科学学习教练，只输出合法JSON。' },
      { role: 'user', content: prompt }
    ]);

    // 按分数把知识点状态写库（<60 未掌握，≥60 已掌握）
    const status = await applyStatusByScore(knowledgePointId, req.user.id, llmResult.score);

    res.json({ ...llmResult, status });
  } catch (error) {
    console.error('调用豆包失败：', error.message);
    res.status(502).json({ msg: error.message });
  }
};

// 去掉 HTML 标签（富文本知识点送给大模型前转成纯文本）
function stripHtml(html) {
  return String(html || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .trim();
}

const VALID_Q_TYPES = ['single-choice', 'multiple-choice', 'judge', 'short-answer'];

// AI 批量出题：单选 / 多选 / 判断 / 简答，题型可多选、可选题量（第九课：智能测评）
exports.generateQuestion = async (req, res) => {
  const { knowledgePointContent, difficulty, questionTypes, count } = req.body;
  const types = Array.isArray(questionTypes) && questionTypes.length
    ? questionTypes.filter((t) => VALID_Q_TYPES.includes(t))
    : ['single-choice'];
  const num = Math.min(Math.max(parseInt(count) || 1, 1), 6);

  if (!knowledgePointContent || !difficulty) {
    return res.status(400).json({ msg: '知识点内容和难度不能为空' });
  }
  if (!types.length) {
    return res.status(400).json({ msg: '题目类型不合法，可选：single-choice / multiple-choice / judge / short-answer' });
  }

  const plainContent = stripHtml(knowledgePointContent);
  if (!plainContent) {
    return res.status(400).json({ msg: '知识点内容为空，无法出题' });
  }

  const typeDesc = {
    'single-choice': '单选题：四个选项 A/B/C/D，只有一个正确答案，answer 为字母字符串（如 "C"）',
    'multiple-choice': '多选题：四个选项 A/B/C/D，有两个或以上正确答案，answer 为字母数组（如 ["A","C"]）',
    'judge': '判断题：answer 为布尔值 true（正确）或 false（错误），并给出 explanation 解析',
    'short-answer': '简答题：无 options，answer_key_points 为答题要点数组（2~4 条）'
  };

  const prompt = `你是一名专业的计算机科学出题专家。请根据下面的知识点内容，生成 ${num} 道题目，难度为「${difficulty}」。

【知识点内容】:
\`\`\`
${plainContent}
\`\`\`

【允许使用的题型】:
${types.map((t) => '- ' + typeDesc[t]).join('\n')}

要求：
1. 题目必须围绕上述知识点，不要超纲；${types.length > 1 ? '题型在允许范围内合理搭配，不要全部是同一种题型。' : '所有题目都必须属于上述唯一题型，不要混入其他题型。'}
2. 严格输出一个 JSON 数组，数组每个元素是一道题，不要输出任何额外解释或 Markdown 代码块；
3. 每道题结构如下（按题型保留对应字段，无关字段可省略）：
{
  "type": "题型标识",
  "difficulty": "${difficulty}",
  "question": "题干",
  "options": { "A": "选项A", "B": "选项B", "C": "选项C", "D": "选项D" },
  "answer": "单选字母 / 多选字母数组 / 判断布尔值",
  "explanation": "解析",
  "answer_key_points": ["简答要点1", "要点2"]
}`;

  try {
    const raw = await callDoubao([
      { role: 'system', content: '你是严谨的计算机科学出题专家，只输出合法JSON数组。' },
      { role: 'user', content: prompt }
    ]);

    // 兼容模型返回数组、或 { list: [...] }、或单道题对象
    let list = Array.isArray(raw) ? raw : (Array.isArray(raw.list) ? raw.list : [raw]);

    // 逐题做字段兜底归一化；题型以答案形态为准，避免模型标错类型
    list = list.filter((q) => q && q.question).map((q) => {
      let t = VALID_Q_TYPES.includes(q.type) ? q.type : '';
      if (typeof q.answer === 'boolean') t = 'judge';
      else if (Array.isArray(q.answer)) t = 'multiple-choice';
      else if (q.options) t = 'single-choice';
      else if (Array.isArray(q.answer_key_points)) t = 'short-answer';
      t = t || 'single-choice';

      const item = { ...q, type: t, difficulty: q.difficulty || difficulty };
      if (t === 'judge') {
        item.answer = q.answer === true || q.answer === 'true';
      } else if (t === 'multiple-choice') {
        const arr = Array.isArray(q.answer) ? q.answer : [q.answer].filter(Boolean);
        item.answer = arr.map(String);
      } else if (t === 'short-answer') {
        item.answer_key_points = Array.isArray(q.answer_key_points) ? q.answer_key_points : [];
      }
      return item;
    });

    if (!list.length) {
      throw new Error('AI 没有返回有效题目，请减少题量后重试');
    }
    res.json({ list });
  } catch (error) {
    console.error('AI 出题失败：', error.message);
    res.status(502).json({ msg: error.message });
  }
};

// AI 阅卷：给简答题打分，返回分数、是否及格、评语与参考答案
exports.gradeAnswer = async (req, res) => {
  const { question, answer_key_points, studentAnswer } = req.body;

  if (!question || !answer_key_points || !studentAnswer) {
    return res.status(400).json({ msg: '缺少阅卷参数（题目、答案要点、学生作答）' });
  }

  const prompt = `你是一名客观、严谨的计算机科学阅卷老师。请根据题目和答案要点，给学生的作答打分并给出参考答案。

【题目】:
${question}

【答案要点】:
${JSON.stringify(answer_key_points, null, 2)}

【学生作答】:
\`\`\`
${studentAnswer}
\`\`\`

任务：
1. 根据学生作答覆盖答案要点的情况，给出一个 0~100 的整数分数；
2. explanation：点评学生作答，说明答到了哪些要点、缺了什么；
3. referenceAnswer：给出这道题完整、规范的参考答案；
4. 及格线为 60 分，isCorrect 由后端按分数判定，你只需给出 score。

严格按下面 JSON 格式返回，不要输出任何额外解释或 Markdown 代码块：
{
  "score": 80,
  "explanation": "评判理由，说明学生答到了哪些要点、缺了什么",
  "referenceAnswer": "完整参考答案"
}`;

  try {
    const grade = await callDoubao([
      { role: 'system', content: '你是严谨的阅卷老师，只输出合法JSON。' },
      { role: 'user', content: prompt }
    ]);

    const score = Number(grade.score);
    if (!Number.isFinite(score) || !grade.referenceAnswer) {
      throw new Error('AI 阅卷结果格式异常，请重试');
    }
    // 及格线 60 分：>=60 判为正确（清除复习标记），<60 判为错误（加入复习列表）
    const isCorrect = score >= 60;
    res.json({ score, isCorrect, explanation: grade.explanation || '', referenceAnswer: grade.referenceAnswer });
  } catch (error) {
    console.error('AI 阅卷失败：', error.message);
    res.status(502).json({ msg: error.message });
  }
};

// 新建知识点时的语音输入评分：只评价这段口述内容本身
exports.evaluateSpeech = async (req, res) => {
  const { content, title = '', type = '笔记', knowledgePointId } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ msg: '内容不能为空' });
  }

  const prompt = `你是一个严格而友善的学习教练。学生用语音口述了一段「${type}」类知识点，下面是语音识别得到的文本。
请你评价这段口述内容本身，不需要和其他材料对比。

【知识点标题】: ${title || '（未填写）'}
【口述转录文本】:
\`\`\`
${content}
\`\`\`

请你完成以下三项任务:
1. **文本润色**: 把口语化、有语病的转录文本整理成通顺、专业、书面化的一段话，保持原意不变。
2. **综合评价**: 指出这段内容在准确性、完整性、条理性、表达清晰度方面的优点与不足。
3. **评分**: 综合以上维度给出一个0到100的整数分数。

${RESULT_FORMAT}`;

  try {
    const llmResult = await callDoubao([
      { role: 'system', content: '你是严谨的学习教练，只输出合法JSON。' },
      { role: 'user', content: prompt }
    ]);

    const status = await applyStatusByScore(knowledgePointId, req.user.id, llmResult.score);

    res.json({ ...llmResult, status });
  } catch (error) {
    console.error('语音内容评价失败：', error.message);
    res.status(502).json({ msg: error.message });
  }
};

// ==================== 第十一次课：RAG 检索问答（检索 -> Prompt 构建 -> 生成 完整链路） ====================
//
// 原生实现课程教案的 RAG Chain（等价于 LangChain 的 retriever | prompt | llm | parser 管道）：
//   1. 检索器：searchRelevant(question, k=4, userId) —— 问题向量化 + 余弦相似度 Top-K
//   2. Prompt 构建：MCP 风格结构化模板（<role>/<instruction>/<context>/<question>）
//   3. LLM 生成：arkChat 输出纯文本回答
//   4. 返回答案 + 引用来源（选做作业：显示引用来源）
exports.answerWithRAG = async (req, res) => {
  const { question } = req.body;
  if (!question || !question.trim()) {
    return res.status(400).json({ msg: 'Question is required.' });
  }

  try {
    // 1. [检索] 只在当前用户的知识块中找最相关的 4 个片段
    const docs = await searchRelevant(question.trim(), 4, req.user.id);
    console.log(`为问题 "${question}" 检索到 ${docs.length} 个相关文档片段。`);

    // 2. [格式化] 把检索到的片段拼成背景资料
    const context = docs.length
      ? docs.map((d, i) => `--- 资料 ${i + 1}（出自知识点《${d.title || '未命名'}》）---\n${d.text}`).join('\n\n')
      : '（知识库中没有检索到任何相关资料）';

    // 3. [Prompt 模板] 遵循 MCP 结构化原则：用标签明确各部分内容的角色，减少歧义、抑制幻觉
    const prompt =
      `<role>你是一个知识库问答机器人。</role>\n` +
      `<instruction>请只根据下面 <context> 中提供的信息来回答用户的 <question>。` +
      `如果上下文中没有相关信息，就明确回答"我的知识库中没有这方面的内容"，绝对不要编造答案。` +
      `请让回答简洁明了，可以用要点列表组织。</instruction>\n\n` +
      `<context>\n${context}\n</context>\n\n` +
      `<question>\n${question}\n</question>\n\n` +
      `<answer>你的回答是：</answer>`;

    // 4. [生成] 调用豆包，直接取纯文本回答（清理模型可能复读的 <answer> 标签）
    const rawAnswer = await arkChat([
      { role: 'system', content: '你是严谨的知识库问答助手，只依据提供的资料作答。' },
      { role: 'user', content: prompt }
    ]);
    const answer = rawAnswer.replace(/^<\/?answer>/i, '').replace(/<\/answer>$/i, '').trim();

    // 5. [返回] 答案 + 引用来源（前端展示"根据哪些片段回答"）
    res.json({
      answer,
      sources: docs.map((d) => ({
        knowledgePointId: d.knowledgePointId,
        title: d.title || '未命名知识点',
        excerpt: d.text.length > 150 ? d.text.slice(0, 150) + '…' : d.text,
        score: Number(d.score.toFixed(3))
      }))
    });
  } catch (error) {
    console.error('RAG Chain execution error:', error.message);
    res.status(502).json({ msg: error.message || 'RAG 问答失败' });
  }
};
