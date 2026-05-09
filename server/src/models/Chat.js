import mongoose from 'mongoose';

const chatSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['direct', 'stranger'], required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
    temporary: { type: Boolean, default: false },
    interests: [String],
    lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
    lastCall: { type: mongoose.Schema.Types.ObjectId, ref: 'Call' },
    unreadCounts: { type: Map, of: Number, default: {} },
    nicknames: { type: Map, of: String, default: {} },
    hiddenFor: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    archivedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    pinnedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    starredFor: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    mutedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    disappearingMessages: {
      type: Map,
      of: Number,
      default: {}
    },
    wallpapers: {
      type: Map,
      of: String,
      default: {}
    },
    expiresAt: Date
  },
  { timestamps: true }
);

chatSchema.index({ members: 1, updatedAt: -1 });
chatSchema.index({ hiddenFor: 1, updatedAt: -1 });
chatSchema.index({ archivedFor: 1, updatedAt: -1 });
chatSchema.index({ pinnedFor: 1, updatedAt: -1 });
chatSchema.index({ mutedFor: 1, updatedAt: -1 });
chatSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('Chat', chatSchema);
