import express from 'express';
import http from 'http';
import mongoose from 'mongoose';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import fs from 'fs';

import authRoutes from './routes/auth.js';
import videoRoutes from './routes/videos.js';
import adminRoutes from './routes/admin.js';

import { authMiddleware } from './middleware/auth.js';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    credentials: true,
  },
});

// Attach io to app for routes to use
app.set('io', io);

// Basic middleware
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));

// Static serving of uploaded files (for debugging; main path uses streaming route)
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
app.set('UPLOAD_DIR', UPLOAD_DIR);

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/videos', authMiddleware, videoRoutes);
app.use('/api/admin', authMiddleware, adminRoutes);

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({
    message: err.message || 'Internal server error',
  });
});

const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/pulse_video_app';

mongoose
  .connect(MONGO_URI, { dbName: process.env.MONGO_DB || 'pulse_video_app' })
  .then(() => {
    console.log(`MongoDB connected on url ${MONGO_URI}`);
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error', err);
    process.exit(1);
  });

