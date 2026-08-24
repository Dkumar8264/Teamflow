const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Notification recipient is required'],
      index: true
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    type: {
      type: String,
      enum: ['task_assigned'],
      required: [true, 'Notification type is required']
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true,
      maxlength: [240, 'Notification message cannot exceed 240 characters']
    },
    entity: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'Notification entity is required']
    },
    entityType: {
      type: String,
      enum: ['task'],
      required: [true, 'Notification entity type is required']
    },
    readAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

notificationSchema.index({ recipient: 1, createdAt: -1 });

notificationSchema.set('toJSON', {
  versionKey: false,
  transform(_doc, ret) {
    delete ret.id;
    return ret;
  }
});

module.exports = mongoose.model('Notification', notificationSchema);
