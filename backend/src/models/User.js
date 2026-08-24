const bcrypt = require('bcrypt');
const mongoose = require('mongoose');

// Cost 12 is ~250ms on current hardware — deliberately slow to resist offline cracking.
const BCRYPT_COST = 12;

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [80, 'Name cannot exceed 80 characters']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
    },
    password: {
      type: String,
      required: [
        function requirePassword() {
          return this.provider === 'local';
        },
        'Password is required'
      ],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false
    },
    provider: {
      type: String,
      enum: ['local', 'google'],
      default: 'local'
    },
    firebaseUid: {
      type: String,
      trim: true,
      default: ''
    },
    avatarUrl: {
      type: String,
      trim: true,
      default: ''
    },
    emailVerified: {
      type: Boolean,
      default: false
    },
    // Only the SHA-256 hash of each single-use token is stored, and both are
    // select:false so they can never leak through a normal user read or toJSON.
    verificationTokenHash: {
      type: String,
      default: null,
      select: false
    },
    verificationTokenExpiresAt: {
      type: Date,
      default: null,
      select: false
    },
    passwordResetTokenHash: {
      type: String,
      default: null,
      select: false
    },
    passwordResetTokenExpiresAt: {
      type: Date,
      default: null,
      select: false
    },
    // Access tokens issued before this instant are rejected by `protect`, so a
    // password reset invalidates outstanding sessions immediately.
    passwordChangedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password') || !this.password) {
    return next();
  }

  this.password = await bcrypt.hash(this.password, BCRYPT_COST);

  // Stamp password changes on existing accounts so previously-issued access tokens
  // are rejected. Backdated one second because JWT `iat` has whole-second precision
  // and would otherwise race with a token minted in the same millisecond.
  if (!this.isNew) {
    this.passwordChangedAt = new Date(Date.now() - 1000);
  }

  return next();
});

userSchema.methods.comparePassword = async function comparePassword(candidatePassword) {
  // Provider accounts have no password hash, so there is nothing to compare against.
  if (!this.password) {
    return false;
  }

  return bcrypt.compare(candidatePassword, this.password);
};

/**
 * True when the access token was issued before the password last changed.
 * `issuedAtSeconds` is the JWT `iat` claim.
 */
userSchema.methods.isTokenStale = function isTokenStale(issuedAtSeconds) {
  if (!this.passwordChangedAt || !issuedAtSeconds) {
    return false;
  }

  return issuedAtSeconds * 1000 < this.passwordChangedAt.getTime();
};

userSchema.methods.toJSON = function toJSON() {
  const user = this.toObject();
  delete user.password;
  delete user.__v;
  // Defence in depth: these are select:false, but never serialize them even if a
  // caller explicitly re-selected them.
  delete user.verificationTokenHash;
  delete user.verificationTokenExpiresAt;
  delete user.passwordResetTokenHash;
  delete user.passwordResetTokenExpiresAt;
  delete user.firebaseUid;
  return user;
};

module.exports = mongoose.model('User', userSchema);
