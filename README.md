# Pulse Video Sensitivity Application

Full-stack demo application implementing video upload, mock sensitivity analysis with real-time progress, and secure streaming with multi-tenant RBAC.

## Stack

- **Backend**: Node.js, Express, MongoDB (Mongoose), Socket.io, JWT, Multer
- **Frontend**: React + Vite, Tailwind CSS, Socket.io client, native Fetch API

## Project structure

- `backend/` – REST API, WebSocket server, Mongo models
- `frontend/` – React SPA (authentication, upload, dashboard, player)

## Prerequisites

- Node.js LTS
- MongoDB instance (local or Atlas)

## Backend setup

```bash
cd backend
cp .env.example .env   # adjust values if needed
npm install            # already run if using this repo directly
npm run dev
```

Backend runs on `http://localhost:4000` by default.

### Key endpoints

- `POST /api/auth/register` – register user `{ email, password, name, tenantId, role? }`
- `POST /api/auth/login` – login user `{ email, password }`
- `GET  /api/videos` – list videos for current tenant (filters: `sensitivityStatus`, `status`, `search`, `dateFrom`, `dateTo`, `minSize`, `maxSize`)
- `POST /api/videos` – upload video (Multer `video` field); **Editor/Admin only**
- `GET  /api/videos/:id` – get single video metadata
- `GET  /api/videos/:id/stream` – stream video via HTTP range (expects `?token=<JWT>` or `Authorization: Bearer <JWT>`)
- `POST /api/videos/:id/subscribe` – attach a Socket.io client id to a specific video room to receive progress

### Real-time processing

Uploading a video:

1. Stores the file on disk under `UPLOAD_DIR` with a unique filename.
2. Creates a `Video` document with status `processing` and progress `0`.
3. Kicks off a simulated sensitivity pipeline:
   - Periodically updates progress (10 → 30 → 60 → 80 → 100%).
   - Emits `processingProgress` Socket.io events to the room `videoId`.
   - Marks sensitivity as `safe` or `flagged` using a simple deterministic rule.

In a real system you would replace this simulation with an FFmpeg-based pipeline and an ML classifier.

### Multi-tenant & RBAC

- Each `User` has `tenantId` and `role` (`viewer`, `editor`, `admin`).
- Each `Video` stores `tenantId` and `owner`.
- All video queries filter by `tenantId` for isolation.
- Upload endpoint is protected with `requireRole('editor','admin')`.

## Frontend setup

```bash
cd frontend
cp .env.example .env.local   # or .env
npm install                  # already run if using this repo directly
npm run dev
```

Frontend runs on `http://localhost:5173` by default.

### Frontend flow

1. **Auth screen** (`LoginPage`)
   - Toggle between register/login.
   - On success, stores `{ user, token }` in `localStorage` via `AuthContext`.
2. **Dashboard**
   - Upload panel (hidden for `viewer` role):
     - File selection with validation (200MB limit).
     - Upload progress indicator.
     - Connection status indicator.
   - Video library table with:
     - **Advanced filtering**:
       - Status filter (`uploaded`, `processing`, `completed`, `failed`).
       - Sensitivity filter (`safe`, `flagged`, `pending`).
       - Date range filtering (from/to dates).
       - Text search by filename.
     - **Metadata display**: File size, upload date, status, sensitivity badge.
     - Per-row progress bar with real-time updates.
     - Inline `<video>` player for completed videos (HTTP range streaming).
     - Refresh button to reload video list.
   - Real-time progress:
     - Socket.io client connects to backend on mount.
     - After upload, frontend calls `/api/videos/:id/subscribe` with the socket id.
     - Listens for `processingProgress` events and updates UI in real-time.
   - **Full-screen responsive design** using Tailwind CSS.

### Configuration

- `VITE_API_BASE_URL` – base URL for backend (default `http://localhost:4000`).

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

## Deployment notes

For deployment, you can:

- Host the backend on Render/Heroku/Fly.io or similar.
- Use MongoDB Atlas for the database.
- Deploy the React frontend on Netlify/Vercel and set `VITE_API_BASE_URL` to the public backend URL.

Make sure to:

- Use strong `JWT_SECRET`.
- Store uploads in S3 or another object store instead of the local filesystem.
- Put your backend behind HTTPS and configure CORS appropriately.

