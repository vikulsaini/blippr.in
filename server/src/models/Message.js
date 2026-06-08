import mongoose from 'mongoose';

const mediaSchema = new mongoose.Schema(
  {
    url: String,
    type: { type: String, enum: ['image', 'video', 'audio', 'file'] },
    publicId: String,
    name: String,
    mimeType: String,
    size: Number
  },
  { _id: false }
);

const locationSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['current', 'live'], default: 'current' },
    coordinates: {
      type: [Number],
      validate: {
        validator(value) {
          return !value?.length || value.length === 2;
        },
        message: 'Location coordinates must be [longitude, latitude]'
      }
    },
    accuracy: Number,
    startedAt: Date,
    updatedAt: Date,
    expiresAt: Date,
    endedAt: Date
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    chat: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true, index: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, maxlength: 4000 },
    media: mediaSchema,
    location: locationSchema,
    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
    mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    reactions: [
      {
        emoji: { type: String, required: true },
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
      }
    ],
    status: { type: String, enum: ['sent', 'delivered', 'seen'], default: 'sent' },
    deliveryReceipts: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        status: { type: String, enum: ['sent', 'delivered', 'seen'], default: 'sent' },
        deliveredAt: Date,
        seenAt: Date
      }
    ],
    seenBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    editedAt: Date,
    deletedAt: Date
  },
  { timestamps: true }
);

messageSchema.index({ chat: 1, createdAt: -1 });

export default mongoose.model('Message', messageSchema);
