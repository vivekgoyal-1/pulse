# Pulse Video Sensitivity Application

Full-stack application for video upload, sensitivity analysis, and streaming with multi-tenant support.

## Stack

- **Backend**: Node.js, Express, MongoDB, Socket.io, JWT, Multer, FFmpeg
- **Frontend**: React + Vite, Tailwind CSS, Socket.io client

## Project Structure

- `backend/src/` – API server, models (User, Video), routes, auth middleware
- `frontend/src/` – React components, authentication context, dashboard, upload service

## Quick Start

### Backend

```bash
cd backend
npm install
npm run dev
```

Backend runs on `http://localhost:4000`. Requires `.env` with MongoDB URI, JWT secret, and upload directory.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`. Requires `.env.local` with `VITE_API_BASE_URL` pointing to backend.

## Features

- **User Authentication**: Register/login with JWT tokens
- **Video Upload**: Upload videos with progress tracking (Editor/Admin roles only)
- **Real-time Progress**: Socket.io updates during video processing
- **Multi-tenant**: Users isolated by tenant ID
- **Role-based Access**: Viewer, Editor, and Admin roles
- **Video Streaming**: HTTP range-based streaming with authentication
- **Sensitivity Analysis**: Process videos and mark as safe/flagged

## API Endpoints

- `POST /api/auth/register` – Create account
- `POST /api/auth/login` – Login user
- `GET /api/videos` – List videos with filters
- `POST /api/videos` – Upload video
- `GET /api/videos/:id/stream` – Stream video file
- `POST /api/videos/:id/subscribe` – Subscribe to processing updates

## Running the full flow locally

1. Start MongoDB.
2. Start backend:
   - `cd backend && cp .env.example .env && npm run dev`
3. Start frontend:
   - `cd frontend && cp .env.example .env.local && npm run dev`
4. Open `http://localhost:5173`:
   - Register an **Editor** user (e.g. `tenantId = acme`).
   - Upload a small video file.
   - Watch the progress bar update in real time.
   - Once completed, play the video inline via the streaming endpoint.

## Testing (lightweight)

- Backend includes a `/api/health` endpoint for basic availability checks.
- You can easily add Jest or supertest based on this structure; tests are not wired by default to keep the assignment focused on core workflow.

## Documentation Package

### Installation and Setup Guide
Follow the Quick Start section above to get both backend and frontend running locally. Ensure you have Node.js installed and a MongoDB instance available (local or cloud). Environment files (`.env` and `.env.local`) control connection strings and configuration.

### API Documentation
All endpoints are listed in the API Endpoints section. Authentication uses JWT tokens returned after login. Include the token in requests via `Authorization: Bearer <token>` header. Videos are scoped by tenant; users only see videos from their tenant.

### User Manual
**For Editors/Admins**: Use the upload panel on the Dashboard to select and upload video files. Progress updates in real-time. Once processing completes, sensitivity status is shown (safe or flagged).

**For Viewers**: Browse uploaded videos in the library, apply filters by status, sensitivity, or date range, and watch completed videos inline using the player.

### Architecture Overview
The application follows a standard client-server architecture. Frontend (React/Vite) communicates with backend (Express) via REST and WebSocket. MongoDB stores users and video metadata. Uploaded files are stored on disk. Real-time progress is delivered via Socket.io room subscriptions keyed by video ID.

### Assumptions and Design Decisions
- **Multi-tenancy**: All data queries filter by tenant ID for complete isolation between organizations.
- **Role-based access**: Three roles (Viewer, Editor, Admin) control upload and admin permissions.
- **Async processing**: Video processing is simulated with deterministic progress events; replace with actual FFmpeg pipeline in production.
- **Streaming**: Videos are served via HTTP range requests for efficient playback without re-encoding.
- **JWT expiration**: Tokens have configurable TTL; refresh logic can be added as needed.
