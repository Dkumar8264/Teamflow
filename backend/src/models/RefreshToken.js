const mongoose = require('mongoose');

/**
 * One document per issued refresh token.
 *
 * Rotation model: every use of a refresh token revokes it and issues a replacement in
 * the same `family`. If a token that is already revoked is presented again, that means
 * either an attacker stole it or the legitimate client replayed a stale value — either
 * way the whole family is revoked, which forces a fresh login. This is the standard
 * reuse-detection scheme for rotating refresh tokens.
 *
 * Only the SHA-256 hash of the token is stored, so a database leak does not hand an
 * attacker usable session credentials.
 */
const refreshTokenSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true
    },
    family: {
      type: String,
      required: true,
      index: true
    },
    expiresAt: {
      type: Date,
      required: true
    },
    revokedAt: {
      type: Date,
      default: null
    },
    revokedReason: {
      type: String,
      enum: ['rotated', 'logout', 'reuse_detected', 'password_changed', null],
      default: null
    },
    userAgent: {
      type: String,
      default: ''
    },
    ip: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

// Let MongoDB reap expired documents so the collection does not grow without bound.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

refreshTokenSchema.virtual('isActive').get(function isActive() {
  return !this.revokedAt && this.expiresAt.getTime() > Date.now();
});

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
