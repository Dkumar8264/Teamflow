const mongoose = require('mongoose');

const projectMemberSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    name: {
      type: String,
      required: [true, 'Member name is required'],
      trim: true,
      minlength: [2, 'Member name must be at least 2 characters'],
      maxlength: [80, 'Member name cannot exceed 80 characters']
    },
    email: {
      type: String,
      required: [true, 'Member email is required'],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid member email']
    },
    role: {
      type: String,
      enum: ['owner', 'admin', 'member', 'viewer'],
      default: 'member'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    _id: true
  }
);

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true,
      minlength: [2, 'Project name must be at least 2 characters'],
      maxlength: [120, 'Project name cannot exceed 120 characters']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Project description cannot exceed 1000 characters'],
      default: ''
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Project owner is required']
    },
    members: {
      type: [projectMemberSchema],
      default: []
    },
    status: {
      type: String,
      enum: ['active', 'archived'],
      default: 'active'
    },
    color: {
      type: String,
      trim: true,
      default: '#0038ff'
    }
  },
  {
    timestamps: true
  }
);

projectSchema.index({ owner: 1, createdAt: -1 });
projectSchema.index({ 'members.email': 1 });
projectSchema.index({ name: 'text', description: 'text' });

projectSchema.virtual('memberCount').get(function memberCount() {
  return Array.isArray(this.members) ? this.members.length : 0;
});

projectSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform(_doc, ret) {
    delete ret.id;
    return ret;
  }
});

module.exports = mongoose.model('Project', projectSchema);
