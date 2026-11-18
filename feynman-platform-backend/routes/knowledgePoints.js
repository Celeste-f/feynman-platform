const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const KnowledgePoint = require('../models/KnowledgePoint');
// 第十次课：RAG 向量库（创建/更新知识点时自动索引其内容）
const { addKnowledgePointToStore, removeKnowledgePointFromStore } = require('../services/vectorStoreService');

// 创建知识点
router.post('/', auth, async (req, res) => {
    try {
        const { title, content, type } = req.body;
        const newKp = new KnowledgePoint({
            title,
            content,
            type: type || '笔记',
            user: req.user.id
        });
        const kp = await newKp.save();
        // 异步索引到向量库，不阻塞返回（提升响应体验）
        addKnowledgePointToStore(kp);
        res.json(kp);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// 获取当前用户全部知识点
router.get('/', auth, async (req, res) => {
    try {
        const kps = await KnowledgePoint.find({ user: req.user.id }).sort({ createdAt: -1 });
        res.json(kps);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// 获取单个知识点（作业要求的接口）
router.get('/:id', auth, async(req,res)=>{
    try{
        let kp = await KnowledgePoint.findById(req.params.id);
        if(!kp){
            return res.status(404).json({msg:"Knowledge point not found"})
        }
        if(kp.user.toString() !== req.user.id){
            return res.status(401).json({msg:"Not authorized"})
        }
        res.json(kp);
    }catch(err){
        console.error(err.message);
        res.status(500).send("Server Error")
    }
})

// 更新知识点
router.put('/:id', auth, async (req, res) => {
    try {
        let kp = await KnowledgePoint.findById(req.params.id);
        if (!kp) return res.status(404).json({ msg: 'Knowledge point not found' });
        if (kp.user.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Not authorized' });
        }
        const { title, content, type, status, reviewList } = req.body;
        // 只更新前端显式传入的字段，避免部分字段被清空
        const $set = {};
        if (title !== undefined) $set.title = title;
        if (content !== undefined) $set.content = content;
        if (type !== undefined) $set.type = type;
        if (status !== undefined) $set.status = status;
        if (reviewList !== undefined) $set.reviewList = reviewList;
        kp = await KnowledgePoint.findByIdAndUpdate(
            req.params.id,
            { $set },
            { new: true }
        );
        // 内容发生变化时，重新索引到向量库（addKnowledgePointToStore 内部会先删旧块再写新块）
        if (content !== undefined) {
            addKnowledgePointToStore(kp);
        }
        res.json(kp);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// 删除知识点
router.delete('/:id', auth, async (req, res) => {
  try {
    const kp = await KnowledgePoint.findOneAndDelete({
      _id: req.params.id,
      user: req.user.id
    });
    if (!kp) {
      return res.status(404).json({ msg: '找不到这条数据' });
    }
    // 同步从向量库移除该知识点的向量块
    removeKnowledgePointFromStore(kp._id);
    res.json({ msg: '删除成功' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: '服务器错误' });
  }
});


module.exports = router;
