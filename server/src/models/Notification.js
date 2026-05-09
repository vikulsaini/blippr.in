import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: ['friend-request', 'friend-request-accepted', 'login', 'message', 'call', 'system'],
      default: 'system',
      index: true
    },
    title: { type: String, required: true, trim: true },
    body: { type: String, trim: true, default: '' },
    url: String,
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'FriendRequest' },
    chatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat' },
    messageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
    callId: { type: mongoose.Schema.Types.ObjectId, ref: 'Call' },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    readAt: Date
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, readAt: 1, createdAt: -1 });

export default mongoose.model('Notification', notificationSchema);
