// routes/graph.js
// 第十二次课：知识图谱数据接口
// 关系发现（简化版）：知识点 A 的内容里出现了知识点 B 的标题 → 建立一条 A→B 的"引用"边
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const KnowledgePoint = require('../models/KnowledgePoint');

// 去掉 HTML 标签，富文本内容也能做标题包含匹配
function stripHtml(html) {
  return String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

// @route   GET /api/graph/knowledge-map
// @desc    生成 ECharts 力导向图数据：nodes + links
// @access  Private
router.get('/knowledge-map', auth, async (req, res) => {
  try {
    const kps = await KnowledgePoint.find({ user: req.user.id }).sort({ createdAt: -1 });

    if (kps.length === 0) {
      return res.json({ nodes: [], links: [] });
    }

    // 节点：内容越长圆越大；带上 status / reviewList 供前端按掌握状态着色（第12课挑战作业）
    const nodes = kps.map((kp) => {
      const plain = stripHtml(kp.content);
      return {
        id: kp._id.toString(),
        name: kp.title,
        value: plain.substring(0, 100), // tooltip 提示用的内容摘要
        type: kp.type || '笔记',
        status: kp.status || 'not_started',
        reviewList: !!kp.reviewList,
        createdAt: kp.createdAt,
        symbolSize: 20 + Math.min(plain.length / 50, 30)
      };
    });

    // 边：A 的内容里提到了 B 的标题
    const links = [];
    const kpTitleMap = new Map(kps.map((kp) => [kp.title, kp._id.toString()]));

    for (const sourceKp of kps) {
      const plainContent = stripHtml(sourceKp.content);
      for (const [targetTitle, targetId] of kpTitleMap.entries()) {
        if (sourceKp.title === targetTitle) continue;
        if (targetTitle && plainContent.includes(targetTitle)) {
          links.push({
            source: sourceKp._id.toString(),
            target: targetId,
            label: { show: true, formatter: '引用' }
          });
        }
      }
    }

    res.json({ nodes, links });
  } catch (error) {
    console.error('Error generating knowledge graph:', error);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
