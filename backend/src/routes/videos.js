import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import Video, { VIDEO_STATUS, SENSITIVITY_STATUS } from '../models/Video.js';
import { requireRole } from '../middleware/auth.js';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const router = express.Router();

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = req.app.get('UPLOAD_DIR');
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 200 }, // 200MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('video/')) {
      return cb(new Error('Only video files are allowed'));
    }
    cb(null, true);
  },
});

// Helper: emit progress via socket.io
const emitProgress = (io, videoId, progress, payload = {}) => {
  io.to(String(videoId)).emit('processingProgress', {
    videoId,
    progress,
    ...payload,
  });
};

// Run video processing / sensitivity analysis using ffmpeg
const processVideoWithFfmpeg = (uploadDir, video) => {
  const filePath = path.join(uploadDir, video.storagePath);

  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        console.error('ffprobe error', err);
        return resolve({ durationSeconds: null });
      }

      const durationSeconds = metadata?.format?.duration
        ? Math.round(metadata.format.duration)
        : null;

      resolve({ durationSeconds });
    });
  });
};

// Simulate sensitivity analysis + ffmpeg metadata extraction
const simulateSensitivityAnalysis = async (io, video, uploadDir) => {
  try {
    // Use ffmpeg to extract basic metadata (e.g. duration)
    const { durationSeconds } = await processVideoWithFfmpeg(uploadDir, video);
    if (durationSeconds != null) {
      await Video.findByIdAndUpdate(video._id, { durationSeconds });
    }

    const steps = [10, 30, 60, 80, 100];
    for (const p of steps) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 800));
      // update db
      // eslint-disable-next-line no-await-in-loop
      await Video.findByIdAndUpdate(video._id, { processingProgress: p });
      emitProgress(io, video._id, p);
    }

    // Simple mock classification: odd-size videos are flagged
    const sensitivityStatus =
      video.sizeBytes % 2 === 0 ? SENSITIVITY_STATUS.SAFE : SENSITIVITY_STATUS.FLAGGED;

    await Video.findByIdAndUpdate(video._id, {
      status: VIDEO_STATUS.COMPLETED,
      sensitivityStatus,
      processingProgress: 100,
    });

    emitProgress(io, video._id, 100, { done: true, sensitivityStatus });
  } catch (err) {
    console.error('Processing error', err);
    await Video.findByIdAndUpdate(video._id, {
      status: VIDEO_STATUS.FAILED,
      sensitivityStatus: SENSITIVITY_STATUS.PENDING,
    });
    emitProgress(io, video._id, 0, { error: 'Processing failed' });
  }
};

// Subscribe to video room for real-time updates
router.post('/:id/subscribe', (req, res) => {
  const { id } = req.params;
  const io = req.app.get('io');
  const socketId = req.body.socketId;
  if (!socketId) {
    return res.status(400).json({ message: 'socketId required' });
  }
  const socket = io.sockets.sockets.get(socketId);
  if (socket) {
    socket.join(String(id));
  }
  return res.json({ ok: true });
});

// Upload video (Editor/Admin)
router.post(
  '/',
  requireRole('editor', 'admin'),
  upload.single('video'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'Video file is required' });
      }

      const { categories, notes } = req.body;
      const video = await Video.create({
        owner: req.user._id,
        tenantId: req.user.tenantId,
        originalFileName: req.file.originalname,
        storagePath: req.file.filename,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        status: VIDEO_STATUS.PROCESSING,
        sensitivityStatus: SENSITIVITY_STATUS.PENDING,
        processingProgress: 0,
        categories: categories ? categories.split(',').map((c) => c.trim()) : [],
        notes,
      });

      const io = req.app.get('io');
      const uploadDir = req.app.get('UPLOAD_DIR');
      // Kick off async processing (no await)
      simulateSensitivityAnalysis(io, video, uploadDir);

      res.status(201).json({ video });
    } catch (err) {
      next(err);
    }
  }
);

// List videos for tenant with optional filters
router.get('/', async (req, res, next) => {
  try {
    const { sensitivityStatus, status, search, minSize, maxSize, dateFrom, dateTo } = req.query;
    const query = {
      tenantId: req.user.tenantId,
    };
    if (sensitivityStatus) {
      query.sensitivityStatus = sensitivityStatus;
    }
    if (status) {
      query.status = status;
    }
    if (search) {
      query.originalFileName = { $regex: search, $options: 'i' };
    }
    if (minSize || maxSize) {
      query.sizeBytes = {};
      if (minSize) query.sizeBytes.$gte = parseInt(minSize, 10);
      if (maxSize) query.sizeBytes.$lte = parseInt(maxSize, 10);
    }
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) {
        // Include entire day by adding 1 day and using less than (not less than or equal)
        const endDate = new Date(dateTo);
        endDate.setDate(endDate.getDate() + 1);
        query.createdAt.$lt = endDate;
      }
    }

    const videos = await Video.find(query)
      .sort({ createdAt: -1 })
      .select('-storagePath')
      .populate('owner', 'name email');

    res.json({ videos });
  } catch (err) {
    next(err);
  }
});

// Get single video metadata (ensure tenant isolation)
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const video = await Video.findOne({
      _id: id,
      tenantId: req.user.tenantId,
    }).select('-storagePath');

    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }
    res.json({ video });
  } catch (err) {
    next(err);
  }
});

// Stream video via range requests
router.get('/:id/stream', async (req, res, next) => {
  try {
    const { id } = req.params;
    const video = await Video.findOne({
      _id: id,
      tenantId: req.user.tenantId,
    });

    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }

    const filePath = path.join(req.app.get('UPLOAD_DIR'), video.storagePath);
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (!range) {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': video.mimeType,
      });
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    const file = fs.createReadStream(filePath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': video.mimeType,
    };

    res.writeHead(206, head);
    file.pipe(res);
  } catch (err) {
    next(err);
  }
});

// Delete video (Editor/Admin) - same tenant and either owner or admin
router.delete('/:id', requireRole('editor', 'admin'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const video = await Video.findOne({
      _id: id,
      tenantId: req.user.tenantId,
    });

    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }

    // Editors can only delete their own videos; admins can delete any in tenant
    const isAdmin = req.user.role === 'admin';
    const isOwner = String(video.owner) === String(req.user._id);
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: 'You are not allowed to delete this video' });
    }

    const filePath = path.join(req.app.get('UPLOAD_DIR'), video.storagePath);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (fsErr) {
      console.warn('Failed to delete video file from disk', fsErr);
    }

    await video.deleteOne();
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;

