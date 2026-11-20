// scripts/reindexAll.js
// 全量重建向量索引：把 MongoDB 里所有存量知识点重新切块、向量化写入本地向量库。
// 适用场景：向量库功能上线前创建的知识点没有索引；或 store.json 丢失/损坏后恢复。
// 用法：npm run reindex
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const KnowledgePoint = require('../models/KnowledgePoint');
const { addKnowledgePointToStore } = require('../services/vectorStoreService');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const kps = await KnowledgePoint.find({});
  console.log(`共找到 ${kps.length} 个知识点，开始重建向量索引（首次会先下载嵌入模型）...`);

  let ok = 0;
  for (const kp of kps) {
    await addKnowledgePointToStore(kp); // 内部：先删旧块再写新块，可安全重复执行
    ok += 1;
  }

  console.log(`✅ 重建完成：${ok}/${kps.length} 个知识点已入库`);
  process.exit(0);
})().catch((err) => {
  console.error('重建失败：', err.message);
  process.exit(1);
});
