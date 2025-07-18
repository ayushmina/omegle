const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    room: String,
    senderId: String,
    message: mongoose.Schema.Types.Mixed, // <-- allows storing any type

    timestamp: { type: Date, default: Date.now }
}, { timestamps: true }); // This adds createdAt & updatedAt automatically

module.exports = mongoose.model('message', messageSchema);


