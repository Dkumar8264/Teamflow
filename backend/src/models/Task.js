const mongoose = require('mongoose');

const taskCommentSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    authorName: {
      type: String,
      required: [true, 'Comment author name is required'],
      trim: true,
      maxlength: [80, 'Comment author name cannot exceed 80 characters']
    },
    body: {
      type: String,
      required: [true, 'Comment body is required'],
      trim: true,
      maxlength: [1000, 'Comment cannot exceed 1000 characters']
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    _id: true
  }
);

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
      minlength: [2, 'Task title must be at least 2 characters'],
      maxlength: [160, 'Task title cannot exceed 160 characters']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Task description cannot exceed 2000 characters'],
      default: ''
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Task project is required'],
      index: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Task creator is required']
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    status: {
      type: String,
      enum: ['todo', 'in_progress', 'review', 'done'],
      default: 'todo',
      index: true
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium'
    },
    dueDate: {
      type: Date,
      default: null
    },
    comments: {
      type: [taskCommentSchema],
      default: []
    },
    completedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

taskSchema.index({ project: 1, status: 1, createdAt: -1 });
taskSchema.index({ assignedTo: 1, status: 1 });
taskSchema.index({ title: 'text', description: 'text' });

taskSchema.pre('save', function setCompletionTimestamp(next) {
  if (this.isModified('status')) {
    this.completedAt = this.status === 'done' ? this.completedAt || new Date() : null;
  }

  next();
});

taskSchema.set('toJSON', {
  versionKey: false,
  transform(_doc, ret) {
    delete ret.id;
    return ret;
  }
});

module.exports = mongoose.model('Task', taskSchema);
