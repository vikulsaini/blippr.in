import mongoose from 'mongoose';

const analyticsBucketSchema = new mongoose.Schema({
  timestamp: { type: Date, required: true, index: true }, // rounded to minute or hour
  interval: { type: String, enum: ['minute', 'hour'], required: true },
  requestCount: { type: Number, default: 0 },
  errorCount: { type: Number, default: 0 }, // 5xx status codes
  responseTimeSum: { type: Number, default: 0 },
  status2xx: { type: Number, default: 0 },
  status3xx: { type: Number, default: 0 },
  status4xx: { type: Number, default: 0 },
  status5xx: { type: Number, default: 0 },
  endpoints: { type: Map, of: Number, default: {} }
});

// Compound index for querying recent buckets quickly
analyticsBucketSchema.index({ interval: 1, timestamp: -1 });

export default mongoose.model('AnalyticsBucket', analyticsBucketSchema);
