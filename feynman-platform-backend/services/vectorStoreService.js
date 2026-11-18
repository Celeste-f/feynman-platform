// services/vectorStoreService.js
// 第十次课：RAG 后端基础 —— 文档处理与向量化（本地嵌入模型版，原生实现，不依赖 LangChain）
//
// 流程：加载(知识点内容) -> 分割(chunk) -> 嵌入(本地 bge 模型算向量) -> 存储(本地 JSON 向量库)
// 模型用 @xenova/transformers 在 Node 本地推理，无需任何云端密钥；首次会自动从 hf-mirror 下载并缓存。

const fs = require('fs');
const path = require('path');

const MODEL_ID = 'Xenova/bge-small-zh-v1.5';
const HF_REMOTE_HOST = 'https://hf-mirror.com'; // 国内无法直连 huggingface.co，走镜像

const VECTOR_DIR = path.join(__dirname, '../vector_store');
const STORE_FILE = path.join(VECTOR_DIR, 'store.json');

// 分块参数（与课程一致：块大小 500，重叠 50）
const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;

// 模型只加载一次（惰性 + 并发安全）
let embedderPromise = null;
async function getEmbedder() {
  if (!embedderPromise) {
    embedderPromise = (async () => {
      const { pipeline, env } = await import('@xenova/transformers');
      env.allowLocalModels = false;
      env.remoteHost = HF_REMOTE_HOST;
      console.log(`[向量库] 正在加载本地嵌入模型 ${MODEL_ID} ...`);
      const t0 = Date.now();
      const model = await pipeline('feature-extraction', MODEL_ID);
      console.log(`[向量库] 模型就绪，用时 ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      return model;
    })().catch((err) => {
      embedderPromise = null; // 失败后允许下次重试
      throw err;
    });
  }
  return embedderPromise;
}

// 去掉 HTML 标签（富文本知识点入库前转纯文本）
function stripHtml(html) {
  return String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

// 递归字符分割：先按段落，再按句子，最后硬切；块之间保留 overlap
function chunkText(text, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const clean = text.replace(/\r/g, '').trim();
  if (!clean) return [];
  if (clean.length <= size) return [clean];

  const separators = ['\n\n', '。', '！', '？', '；', '\n', '，', ' ', ''];
  const chunks = [];
  let buffer = '';

  // 找到能切分当前文本的最大分隔符
  const splitIntoSentences = (str) => {
    for (const sep of separators) {
      if (sep === '') continue;
      if (str.includes(sep)) {
        const parts = str.split(sep);
        // 把分隔符补回每句末尾（句子级分隔符）
        if (['。', '！', '？', '；'].includes(sep)) {
          return parts.slice(0, -1).map((p) => p + sep).concat(parts.length > 1 && parts[parts.length - 1] ? [parts[parts.length - 1]] : []);
        }
        return parts.filter((p) => p.length);
      }
    }
    // 没有分隔符：按 size 硬切
    const hard = [];
    for (let i = 0; i < str.length; i += size) hard.push(str.slice(i, i + size));
    return hard;
  };

  const sentences = splitIntoSentences(clean);
  for (const s of sentences) {
    if ((buffer + s).length <= size) {
      buffer += s;
    } else {
      if (buffer) chunks.push(buffer.trim());
      // 新块以上一块的尾部 overlap 开头，保证语义连续
      buffer = (overlap > 0 && chunks.length ? chunks[chunks.length - 1].slice(-overlap) : '') + s;
      // 如果单句本身就超长，硬切
      while (buffer.length > size) {
        chunks.push(buffer.slice(0, size).trim());
        buffer = buffer.slice(size - overlap);
      }
    }
  }
  if (buffer.trim()) chunks.push(buffer.trim());
  return chunks.filter((c) => c.length);
}

// 计算一段文本的归一化向量数组
async function embedText(text) {
  const embedder = await getEmbedder();
  const out = await embedder(text, { pooling: 'mean', normalize: true });
  return Array.from(out.data);
}

// 读取本地向量库文件
function readStore() {
  try {
    if (!fs.existsSync(STORE_FILE)) return { chunks: [] };
    const raw = fs.readFileSync(STORE_FILE, 'utf-8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data.chunks)) data.chunks = [];
    return data;
  } catch (e) {
    console.error('[向量库] 读取失败，按空库处理:', e.message);
    return { chunks: [] };
  }
}

// 写入本地向量库文件
function writeStore(store) {
  if (!fs.existsSync(VECTOR_DIR)) fs.mkdirSync(VECTOR_DIR, { recursive: true });
  fs.writeFileSync(STORE_FILE, JSON.stringify(store));
}

/**
 * 将一个知识点的内容切块、向量化后写入本地向量库。
 * 更新场景：先删除该知识点旧的向量块，再写入新的，避免冗余。
 * @param {object} knowledgePoint - 含 _id / user / content / title 的知识点对象
 */
async function addKnowledgePointToStore(knowledgePoint) {
  try {
    const kpId = knowledgePoint._id.toString();
    const plain = stripHtml(knowledgePoint.content);
    if (!plain) {
      console.log(`[向量库] 知识点 ${kpId} 内容为空，跳过`);
      return;
    }

    const chunks = chunkText(plain);
    console.log(`[向量库] 知识点《${knowledgePoint.title || kpId}》分割成 ${chunks.length} 个文本块，开始向量化...`);

    const vectors = [];
    for (let i = 0; i < chunks.length; i++) {
      vectors.push(await embedText(chunks[i]));
    }

    const store = readStore();
    // 先移除该知识点的历史块（支持“更新即重索引”，不像 HNSWLib 只能追加）
    store.chunks = store.chunks.filter((c) => c.knowledgePointId !== kpId);
    chunks.forEach((text, i) => {
      store.chunks.push({
        knowledgePointId: kpId,
        userId: knowledgePoint.user ? knowledgePoint.user.toString() : null,
        title: knowledgePoint.title || '',
        chunkIndex: i,
        text,
        vector: vectors[i],
      });
    });
    writeStore(store);

    console.log(`[向量库] ✅ 知识点 ${kpId} 已入库，当前库中共 ${store.chunks.length} 个文本块`);
  } catch (error) {
    console.error('[向量库] 添加到向量库失败:', error.message);
  }
}

/**
 * 检索：把查询转向量，与库中（可选限定用户）的块做余弦相似度，返回 Top-K。
 * @param {string} query 查询文本
 * @param {number} topK 返回条数
 * @param {string} [userId] 只在该用户的知识块中检索
 */
async function searchRelevant(query, topK = 3, userId = null) {
  const plain = stripHtml(query);
  if (!plain) return [];
  const store = readStore();
  let pool = store.chunks;
  if (userId) pool = pool.filter((c) => c.userId === userId.toString());
  if (!pool.length) return [];

  const qv = await embedText(plain);
  const scored = pool.map((c) => {
    let dot = 0;
    for (let i = 0; i < qv.length; i++) dot += qv[i] * (c.vector[i] || 0);
    return { knowledgePointId: c.knowledgePointId, title: c.title, text: c.text, score: dot };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

// 删除某知识点的全部向量块（供删除知识点时调用）
function removeKnowledgePointFromStore(kpId) {
  try {
    const store = readStore();
    const before = store.chunks.length;
    store.chunks = store.chunks.filter((c) => c.knowledgePointId !== String(kpId));
    writeStore(store);
    console.log(`[向量库] 已移除知识点 ${kpId} 的 ${before - store.chunks.length} 个向量块`);
  } catch (e) {
    console.error('[向量库] 删除失败:', e.message);
  }
}

exports.addKnowledgePointToStore = addKnowledgePointToStore;
exports.searchRelevant = searchRelevant;
exports.removeKnowledgePointFromStore = removeKnowledgePointFromStore;
exports.STORE_FILE = STORE_FILE;
