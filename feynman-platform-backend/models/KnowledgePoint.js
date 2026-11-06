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
    status: {
        type: String,
        default: 'not_started'
    },
    reviewList: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

module.exports = mongoose.model('KnowledgePoint', KnowledgePointSchema);
