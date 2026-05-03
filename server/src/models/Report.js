import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema(
  {
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reported: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, required: true },
    notes: { type: String, maxlength: 1000 },
    status: { type: String, enum: ['open', 'reviewed', 'actioned'], default: 'open' }
  },
  { timestamps: true }
);

export default mongoose.model('Report', reportSchema);
