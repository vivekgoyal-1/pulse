import mongoose from 'mongoose';

export const VIDEO_STATUS = {
  UPLOADED: 'uploaded',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

export const SENSITIVITY_STATUS = {
  PENDING: 'pending',
  SAFE: 'safe',
  FLAGGED: 'flagged',
};

const videoSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    tenantId: { type: String, required: true },
    originalFileName: { type: String, required: true },
    storagePath: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    status: {
      type: String,
      enum: Object.values(VIDEO_STATUS),
      default: VIDEO_STATUS.UPLOADED,
    },
    sensitivityStatus: {
      type: String,
      enum: Object.values(SENSITIVITY_STATUS),
      default: SENSITIVITY_STATUS.PENDING,
    },
    processingProgress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    durationSeconds: { type: Number },
    categories: [{ type: String }],
    notes: { type: String },
  },
  { timestamps: true }
);

const Video = mongoose.model('Video', videoSchema);

export default Video;

