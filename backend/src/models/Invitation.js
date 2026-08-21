const mongoose = require('mongoose');

const invitationSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Invitation project is required'],
      index: true
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Invitation sender is required']
    },
    name: {
      type: String,
      required: [true, 'Invitee name is required'],
      trim: true,
      minlength: [2, 'Invitee name must be at least 2 characters'],
      maxlength: [80, 'Invitee name cannot exceed 80 characters']
    },
    email: {
      type: String,
      required: [true, 'Invitee email is required'],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid invitee email']
    },
    role: {
      type: String,
      enum: ['admin', 'member', 'viewer'],
      default: 'member'
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'expired'],
      default: 'pending',
      index: true
    },
    message: {
      type: String,
      trim: true,
      maxlength: [1000, 'Invitation message cannot exceed 1000 characters'],
      default: ''
    },
    emailMode: {
      type: String,
      enum: ['smtp', 'preview', 'failed'],
      default: 'preview'
    },
    emailError: {
      type: String,
      trim: true,
      maxlength: [500, 'Email error cannot exceed 500 characters'],
      default: ''
    },
    emailMessageId: {
      type: String,
      trim: true,
      default: ''
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    },
    respondedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

invitationSchema.index({ project: 1, email: 1, status: 1 });
invitationSchema.index({ email: 1, createdAt: -1 });

invitationSchema.methods.markAccepted = function markAccepted() {
  this.status = 'accepted';
  this.respondedAt = new Date();
  return this.save();
};

invitationSchema.methods.markDeclined = function markDeclined() {
  this.status = 'declined';
  this.respondedAt = new Date();
  return this.save();
};

invitationSchema.set('toJSON', {
  versionKey: false,
  transform(_doc, ret) {
    delete ret.id;
    return ret;
  }
});

module.exports = mongoose.model('Invitation', invitationSchema);
