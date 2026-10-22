const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
}, { timestamps: true }); // timestamps 会自动添加 createdAt 和 updatedAt 字段

module.exports = mongoose.model('User', UserSchema);
