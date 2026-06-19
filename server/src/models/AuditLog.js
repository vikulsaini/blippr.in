import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  action: { type: String, required: true }, // e.g., 'upload_file', 'delete_file', 'ban_user', 'revoke_sessions'
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  target: { type: String }, // ID or filename target
  details: { type: mongoose.Schema.Types.Mixed },
  ip: { type: String },
  timestamp: { type: Date, default: Date.now }
});

// Index to list logs sorted by time
auditLogSchema.index({ timestamp: -1 });

export default mongoose.model('AuditLog', auditLogSchema);
