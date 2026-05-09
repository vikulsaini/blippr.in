import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema(
  {
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reported: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, required: true },
    notes: { type: String, maxlength: 1000 },
    category: { type: String, enum: ['spam', 'harassment', 'nudity', 'hate', 'scam', 'violence', 'underage', 'other'], default: 'other' },
    messageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
    chatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat' },
    screenshots: [String],
    status: { type: String, enum: ['open', 'reviewed', 'actioned'], default: 'open' }
  },
  { timestamps: true }
);

export default mongoose.model('Report', reportSchema);
