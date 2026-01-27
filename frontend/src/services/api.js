const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

class ApiClient {
  constructor() {
    this.token = null;
  }

  setToken(token) {
    this.token = token;
  }

  async request(path, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set('Content-Type', 'application/json');
    if (this.token) {
      headers.set('Authorization', `Bearer ${this.token}`);
    }

    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      const message = errorBody.message || `Request failed with status ${res.status}`;
      throw new Error(message);
    }

    if (res.status === 204) return null;
    return res.json();
  }

  async login(email, password) {
    return this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async register(payload) {
    return this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async listVideos(params = {}) {
    const searchParams = new URLSearchParams(params);
    const qs = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return this.request(`/api/videos${qs}`);
  }

  async getVideo(id) {
    return this.request(`/api/videos/${id}`);
  }

  async deleteVideo(id) {
    return this.request(`/api/videos/${id}`, {
      method: 'DELETE',
    });
  }

  async listUsers() {
    return this.request('/api/admin/users');
  }

  async updateUserRole(id, role) {
    return this.request(`/api/admin/users/${id}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  }

  async deleteUser(id) {
    return this.request(`/api/admin/users/${id}`, {
      method: 'DELETE',
    });
  }
}

export const api = new ApiClient();

export { API_BASE_URL };

