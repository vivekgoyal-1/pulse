import { API_BASE_URL } from './api';

export async function uploadVideo(token, file, extra = {}) {
  const formData = new FormData();
  formData.append('video', file);
  if (extra.categories) formData.append('categories', extra.categories);
  if (extra.notes) formData.append('notes', extra.notes);

  const res = await fetch(`${API_BASE_URL}/api/videos`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    const message = errorBody.message || `Upload failed with status ${res.status}`;
    throw new Error(message);
  }

  return res.json();
}

