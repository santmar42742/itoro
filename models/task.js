const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: {
    type: Number,
    required: true,
  },
  level: {
    type: Number,
    required: true,
  },
  claimedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  user: {
    type: mongoose.Schema.Types.ObjectId, // Reference to another user
    ref: 'user', // This should match the model name
  },
  claimedAt: Date,
  expiresAt: Date,
});

module.exports = new mongoose.model('Task', taskSchema);
var Task=mongoose.model("Task",taskSchema);
module.exports.Task=Task;