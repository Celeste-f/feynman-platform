const mongoose = require('mongoose');
const KnowledgePointSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    title: {
        type: String,
        required: true
    },
    content: {
        type: String,
        required: true
    },
    type: {
        type: String,
        default: '笔记'
    },
    // 知识点掌握状态（三态）：
    // not_started          → 未学习（初始状态）
    // learned_not_mastered → 已学习但未掌握（AI 评分 < 60）
    // mastered             → 已学习且已掌握（AI 评分 ≥ 60）
    status: {
        type: String,
        enum: ['not_started', 'learned_not_mastered', 'mastered'],
        default: 'not_started'
    },
    // 复习列表标记：新建知识点默认需要复习（true）；测评全部答对后置为 false
    reviewList: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

module.exports = mongoose.model('KnowledgePoint', KnowledgePointSchema);
