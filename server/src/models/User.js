import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    phone: { type: String, sparse: true, index: true },
    email: { type: String, lowercase: true, trim: true, sparse: true, index: true },
    passwordHash: { type: String, select: false },
    googleId: { type: String, sparse: true, index: true },
    isGuest: { type: Boolean, default: false },
    name: { type: String, default: 'Varta User', trim: true },
    username: { type: String, lowercase: true, trim: true, sparse: true, unique: true, index: true },
    age: { type: Number, min: 18, max: 120 },
    dob: Date,
    contact: { type: String, trim: true, maxlength: 40 },
    gender: { type: String, enum: ['male', 'female'] },
    avatar: String,
    bio: { type: String, maxlength: 160 },
    location: {
      type: { type: String, enum: ['Point'] },
      coordinates: { type: [Number] },
      updatedAt: Date
    },
    interests: [{ type: String, trim: true, lowercase: true }],
    privacy: {
      showLastSeen: { type: Boolean, default: true },
      readReceipts: { type: Boolean, default: true }
    },
    safety: {
      blockedWords: [{ type: String, trim: true, lowercase: true }]
    },
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    pushTokens: [String],
    lastSeenAt: Date,
    isOnline: { type: Boolean, default: false },
    guestExpiresAt: Date,
    lastIp: { type: String, select: false },
    ipHistory: {
      type: [
        {
          ip: String,
          at: Date
        }
      ],
      select: false,
      default: []
    }
  },
  { timestamps: true }
);

function hidePrivateFields(_doc, ret) {
  delete ret.passwordHash;
  return ret;
}

userSchema.set('toJSON', { transform: hidePrivateFields });
userSchema.set('toObject', { transform: hidePrivateFields });
userSchema.index({ location: '2dsphere' });
userSchema.index({ isOnline: 1, age: 1, lastSeenAt: -1 });
userSchema.index({ isGuest: 1, lastIp: 1, updatedAt: -1 });
userSchema.index({ name: 'text', username: 'text', phone: 'text', email: 'text' });

export default mongoose.model('User', userSchema);
