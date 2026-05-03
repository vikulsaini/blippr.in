import mongoose from 'mongoose';

const callSchema = new mongoose.Schema(
  {
    caller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    chat: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat' },
    type: { type: String, enum: ['audio', 'video'], required: true },
    status: { type: String, enum: ['ringing', 'accepted', 'rejected', 'missed', 'ended'], default: 'ringing' },
    startedAt: { type: Date, default: Date.now },
    answeredAt: Date,
    endedAt: Date,
    durationSeconds: { type: Number, default: 0 }
  },
  { timestamps: true }
);

callSchema.index({ caller: 1, createdAt: -1 });
callSchema.index({ receiver: 1, createdAt: -1 });
callSchema.index({ chat: 1, createdAt: -1 });

export default mongoose.model('Call', callSchema);
