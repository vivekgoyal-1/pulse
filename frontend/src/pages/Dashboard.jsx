import { useEffect, useMemo, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../hooks/useAuth';
import { api, API_BASE_URL } from '../services/api';
import { uploadVideo } from '../services/upload';

export function Dashboard() {
  const { user, token, logout } = useAuth();
  const [videos, setVideos] = useState([]);
  const [filter, setFilter] = useState({
    sensitivityStatus: '',
    search: '',
    status: '',
    dateFrom: '',
    dateTo: '',
  });
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [file, setFile] = useState(null);
  const [processingMap, setProcessingMap] = useState({});
  const [socketConnected, setSocketConnected] = useState(false);
  const fileInputRef = useRef(null);
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminError, setAdminError] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);

  const socket = useMemo(
    () =>
      io(API_BASE_URL, {
        autoConnect: false,
        transports: ['websocket'],
      }),
    []
  );

  useEffect(() => {
    socket.connect();
    socket.on('connect', () => {
      console.log('Socket connected', socket.id);
      setSocketConnected(true);
    });
    socket.on('disconnect', () => {
      setSocketConnected(false);
    });
    socket.on('processingProgress', (payload) => {
      setProcessingMap((prev) => ({
        ...prev,
        [payload.videoId]: payload,
      }));
      // Also update the video in the list
      setVideos((prev) =>
        prev.map((v) =>
          v._id === payload.videoId
            ? {
                ...v,
                processingProgress: payload.progress,
                status: payload.done ? 'completed' : v.status,
                sensitivityStatus: payload.sensitivityStatus || v.sensitivityStatus,
              }
            : v
        )
      );
    });
    return () => {
      socket.disconnect();
    };
  }, [socket]);

  const loadVideos = async () => {
    try {
      const params = {};
      if (filter.sensitivityStatus) params.sensitivityStatus = filter.sensitivityStatus;
      if (filter.status) params.status = filter.status;
      if (filter.search) params.search = filter.search;
      if (filter.dateFrom) params.dateFrom = filter.dateFrom;
      if (filter.dateTo) params.dateTo = filter.dateTo;
      
      const data = await api.listVideos(params);
      setVideos(data.videos || []);
    } catch (err) {
      console.error('Failed to load videos:', err);
    }
  };

  useEffect(() => {
    loadVideos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter.sensitivityStatus, filter.status, filter.search, filter.dateFrom, filter.dateTo]);

  // Load admin users on mount for admin users
  useEffect(() => {
    if (user && user.role === 'admin') {
      loadUsersForAdmin();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setUploadError('Please select a video file first.');
      return;
    }
    
    // Check file size (200MB limit)
    if (file.size > 200 * 1024 * 1024) {
      setUploadError('File size exceeds 200MB limit.');
      return;
    }
    
    setUploading(true);
    setUploadError('');
    setUploadProgress(10);
    
    try {
      // Wait for socket connection if not connected
      if (!socketConnected || !socket.id) {
        setUploadProgress(5);
        let attempts = 0;
        while ((!socketConnected || !socket.id) && attempts < 10) {
          await new Promise((resolve) => setTimeout(resolve, 200));
          attempts++;
        }
        if (!socketConnected || !socket.id) {
          throw new Error('Unable to establish connection. Please refresh the page.');
        }
      }
      
      setUploadProgress(20);
      
      // Upload the video
      const data = await uploadVideo(token, file, {});
      setUploadProgress(80);
      
      const video = data.video;
      
      // Subscribe socket to video room for real-time updates
      if (socket.id) {
        try {
          await fetch(`${API_BASE_URL}/api/videos/${video._id}/subscribe`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ socketId: socket.id }),
          });
        } catch (subErr) {
          console.warn('Failed to subscribe to video room:', subErr);
          // Don't fail the upload if subscription fails
        }
      }
      
      setUploadProgress(100);
      
      // Refresh video list
      await loadVideos();
      
      // Reset form
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Clear progress after a moment
      setTimeout(() => setUploadProgress(0), 1000);
    } catch (err) {
      console.error('Upload error:', err);
      setUploadError(err.message || 'Upload failed. Please check your connection and try again.');
      setUploadProgress(0);
    } finally {
      setUploading(false);
    }
  };

  const streamUrlFor = (videoId) => {
    return `${API_BASE_URL}/api/videos/${videoId}/stream?token=${token}`;
  };

  const handleDeleteVideo = async (videoId) => {
    if (!window.confirm('Are you sure you want to delete this video?')) return;
    try {
      await api.deleteVideo(videoId);
      await loadVideos();
    } catch (err) {
      console.error('Failed to delete video', err);
      alert(err.message || 'Failed to delete video');
    }
  };

  const loadUsersForAdmin = async () => {
    if (user.role !== 'admin') return;
    setAdminLoading(true);
    setAdminError('');
    try {
      const data = await api.listUsers();
      setAdminUsers(data.users || []);
    } catch (err) {
      console.error('Failed to load users', err);
      setAdminError(err.message || 'Failed to load users');
    } finally {
      setAdminLoading(false);
    }
  };

  const handleChangeUserRole = async (userId, role) => {
    try {
      await api.updateUserRole(userId, role);
      await loadUsersForAdmin();
    } catch (err) {
      console.error('Failed to update user role', err);
      alert(err.message || 'Failed to update user role');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      await api.deleteUser(userId);
      await loadUsersForAdmin();
    } catch (err) {
      console.error('Failed to delete user', err);
      alert(err.message || 'Failed to delete user');
    }
  };

  return (
    <div className="min-h-screen w-full bg-gray-900 text-gray-100 p-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-green-400">
            Video Sensitivity Console
          </h1>
          <p className="text-gray-400 mt-1 text-sm">
            Tenant: <strong className="text-gray-300">{user.tenantId}</strong> · Role:{' '}
            <strong className="text-gray-300 capitalize">{user.role}</strong>
            {socketConnected && (
              <span className="ml-2 text-green-400 text-xs">● Connected</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-gray-300">{user.name}</span>
          <button
            type="button"
            className="rounded-full border border-gray-600 bg-gray-950 px-4 py-2 text-gray-200 hover:border-gray-400 transition-colors"
            onClick={logout}
          >
            Logout
          </button>
        </div>
      </header>

      <main className="space-y-5">
        {user.role !== 'viewer' && (
          <section className="bg-slate-900/95 rounded-xl p-6 shadow-xl border border-slate-700">
            <h2 className="text-xl font-semibold mb-4">Upload new video</h2>
            <form onSubmit={handleUpload} className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[200px]">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  onChange={(e) => {
                    const selectedFile = e.target.files?.[0] || null;
                    setFile(selectedFile);
                    setUploadError('');
                  }}
                  className="w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-500 file:text-white hover:file:bg-blue-600 cursor-pointer"
                  disabled={uploading}
                />
              </div>
              <button
                type="submit"
                className="rounded-full border-none py-2.5 px-6 bg-green-500 text-white font-semibold cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed hover:bg-green-600 transition-all"
                disabled={!file || uploading || !socketConnected}
              >
                {uploading ? 'Uploading…' : 'Upload'}
              </button>
            </form>
            {uploadProgress > 0 && uploading && (
              <div className="mt-3">
                <div className="w-full bg-gray-800 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">{uploadProgress}% uploaded</p>
              </div>
            )}
            {uploadError && (
              <div className="mt-3 text-sm text-red-300 bg-red-500/10 border border-red-500/50 p-3 rounded-lg">
                {uploadError}
              </div>
            )}
            {!socketConnected && (
              <div className="mt-3 text-sm text-yellow-300 bg-yellow-500/10 border border-yellow-500/50 p-3 rounded-lg">
                Connecting to server... Please wait.
              </div>
            )}
          </section>
        )}

        <section className="bg-slate-900/95 rounded-xl p-6 shadow-xl border border-slate-700">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-4">
            <h2 className="text-xl font-semibold">Video library</h2>
            <div className="flex gap-2 flex-wrap items-center">
              <select
                value={filter.status}
                onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}
                className="rounded-full border border-gray-600 bg-gray-950 px-4 py-2 text-gray-200 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
              >
                <option value="">All Status</option>
                <option value="uploaded">Uploaded</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
              <select
                value={filter.sensitivityStatus}
                onChange={(e) => setFilter((f) => ({ ...f, sensitivityStatus: e.target.value }))}
                className="rounded-full border border-gray-600 bg-gray-950 px-4 py-2 text-gray-200 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
              >
                <option value="">All Sensitivity</option>
                <option value="safe">Safe</option>
                <option value="flagged">Flagged</option>
                <option value="pending">Pending</option>
              </select>
              <input
                type="date"
                placeholder="From date"
                value={filter.dateFrom}
                onChange={(e) => setFilter((f) => ({ ...f, dateFrom: e.target.value }))}
                className="rounded-full border border-gray-600 bg-gray-950 px-4 py-2 text-gray-200 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
              />
              <input
                type="date"
                placeholder="To date"
                value={filter.dateTo}
                onChange={(e) => setFilter((f) => ({ ...f, dateTo: e.target.value }))}
                className="rounded-full border border-gray-600 bg-gray-950 px-4 py-2 text-gray-200 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
              />
              <input
                placeholder="Search by filename"
                value={filter.search}
                onChange={(e) => setFilter((f) => ({ ...f, search: e.target.value }))}
                className="rounded-full border border-gray-600 bg-gray-950 px-4 py-2 text-gray-200 text-sm min-w-[180px] outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
              />
              <button
                type="button"
                onClick={loadVideos}
                className="rounded-full border border-gray-600 bg-gray-950 px-4 py-2 text-gray-200 text-sm hover:border-blue-400 hover:text-blue-400 transition-colors"
                title="Refresh"
              >
                ↻
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 px-2 text-gray-400 font-medium">Name</th>
                  <th className="text-left py-3 px-2 text-gray-400 font-medium">Size</th>
                  <th className="text-left py-3 px-2 text-gray-400 font-medium">Duration</th>
                  <th className="text-left py-3 px-2 text-gray-400 font-medium">Uploaded</th>
                  <th className="text-left py-3 px-2 text-gray-400 font-medium">Status</th>
                  <th className="text-left py-3 px-2 text-gray-400 font-medium">Sensitivity</th>
                  <th className="text-left py-3 px-2 text-gray-400 font-medium">Progress</th>
                  <th className="text-left py-3 px-2 text-gray-400 font-medium">Player</th>
                  {(user.role === 'editor' || user.role === 'admin') && (
                    <th className="text-left py-3 px-2 text-gray-400 font-medium">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {videos.map((v) => {
                  const processing = processingMap[v._id];
                  const progress = processing?.progress ?? v.processingProgress ?? 0;
                  const formatSize = (bytes) => {
                    if (bytes < 1024) return bytes + ' B';
                    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
                    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
                  };
                  const formatDate = (date) => {
                    return new Date(date).toLocaleDateString() + ' ' + new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  };
                  const formatDuration = (seconds) => {
                    if (!seconds) return '-';
                    const hrs = Math.floor(seconds / 3600);
                    const mins = Math.floor((seconds % 3600) / 60);
                    const secs = seconds % 60;
                    if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
                    if (mins > 0) return `${mins}m ${secs}s`;
                    return `${secs}s`;
                  };
                  return (
                    <tr key={v._id} className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors">
                      <td className="py-3 px-2 text-gray-200 max-w-xs truncate" title={v.originalFileName}>
                        {v.originalFileName}
                      </td>
                      <td className="py-3 px-2 text-gray-300 text-sm">{formatSize(v.sizeBytes)}</td>
                      <td className="py-3 px-2 text-gray-400 text-sm">{formatDuration(v.durationSeconds)}</td>
                      <td className="py-3 px-2 text-gray-400 text-xs">{formatDate(v.createdAt)}</td>
                      <td className="py-3 px-2">
                        <span className="capitalize text-gray-300 text-sm">{v.status}</span>
                      </td>
                      <td className="py-3 px-2">
                        <span
                          className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${
                            v.sensitivityStatus === 'safe'
                              ? 'bg-green-500/10 text-green-300'
                              : v.sensitivityStatus === 'flagged'
                              ? 'bg-red-500/10 text-red-300'
                              : 'bg-yellow-500/10 text-yellow-300'
                          }`}
                        >
                          {v.sensitivityStatus}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          <div className="w-32 bg-gray-800 rounded-full h-1.5">
                            <div
                              className="bg-green-500 h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-400 min-w-[35px]">{progress}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        {v.status === 'completed' && (
                          <video
                            className="w-48 rounded-lg border border-gray-700"
                            src={streamUrlFor(v._id)}
                            controls
                            preload="metadata"
                          />
                        )}
                      </td>
                      {(user.role === 'editor' || user.role === 'admin') && (
                        <td className="py-3 px-2">
                          <button
                            type="button"
                            onClick={() => handleDeleteVideo(v._id)}
                            className="text-xs rounded-full border border-red-500/70 text-red-300 px-3 py-1 hover:bg-red-500/10 transition-colors"
                          >
                            Remove
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {videos.length === 0 && (
                  <tr>
                    <td
                      colSpan={user.role === 'editor' || user.role === 'admin' ? 9 : 8}
                      className="text-center py-8 text-gray-400"
                    >
                      No videos yet. {user.role !== 'viewer' && 'Upload your first video to get started!'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {user.role === 'admin' && (
          <section className="bg-slate-900/95 rounded-xl p-6 shadow-xl border border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">User management (admin)</h2>
              <button
                type="button"
                onClick={loadUsersForAdmin}
                className="rounded-full border border-gray-600 bg-gray-950 px-4 py-2 text-gray-200 text-sm hover:border-blue-400 hover:text-blue-400 transition-colors"
              >
                Refresh users
              </button>
            </div>
            {adminError && (
              <div className="mb-3 text-sm text-red-300 bg-red-500/10 border border-red-500/50 p-3 rounded-lg">
                {adminError}
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-2 text-gray-400 font-medium">Name</th>
                    <th className="text-left py-3 px-2 text-gray-400 font-medium">Email</th>
                    <th className="text-left py-3 px-2 text-gray-400 font-medium">Role</th>
                    <th className="text-left py-3 px-2 text-gray-400 font-medium">Created</th>
                    <th className="text-left py-3 px-2 text-gray-400 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {adminLoading && (
                    <tr>
                      <td colSpan={5} className="text-center py-6 text-gray-400">
                        Loading users...
                      </td>
                    </tr>
                  )}
                  {!adminLoading &&
                    adminUsers.map((u) => {
                      const created = new Date(u.createdAt).toLocaleDateString();
                      return (
                        <tr
                          key={u._id}
                          className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors"
                        >
                          <td className="py-3 px-2 text-gray-200">{u.name}</td>
                          <td className="py-3 px-2 text-gray-300 text-xs">{u.email}</td>
                          <td className="py-3 px-2">
                            <select
                              value={u.role}
                              onChange={(e) => handleChangeUserRole(u._id, e.target.value)}
                              className="rounded-full border border-gray-600 bg-gray-950 px-3 py-1 text-gray-200 text-xs outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                            >
                              <option value="viewer">Viewer</option>
                              <option value="editor">Editor</option>
                              <option value="admin">Admin</option>
                            </select>
                          </td>
                          <td className="py-3 px-2 text-gray-400 text-xs">{created}</td>
                          <td className="py-3 px-2">
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u._id)}
                              className="text-xs rounded-full border border-red-500/70 text-red-300 px-3 py-1 hover:bg-red-500/10 transition-colors"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  {!adminLoading && adminUsers.length === 0 && !adminError && (
                    <tr>
                      <td colSpan={5} className="text-center py-6 text-gray-400">
                        No users found in this tenant.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

