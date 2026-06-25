import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (email: string, name: string, password: string) =>
    api.post('/auth/register', { email, name, password }),
  me: () => api.get('/auth/me'),
};

// Sessions
export const sessionsApi = {
  list: () => api.get('/sessions'),
  create: (title?: string) => api.post('/sessions', { title }),
  get: (id: string) => api.get(`/sessions/${id}`),
  rename: (id: string, title: string) => api.patch(`/sessions/${id}`, { title }),
  delete: (id: string) => api.delete(`/sessions/${id}`),
};

// Search
export const searchApi = {
  search: (q: string, type: 'all' | 'sessions' | 'messages' = 'all') =>
    api.get('/search', { params: { q, type } }),
  exportSession: (sessionId: string): string =>
    `${BASE_URL}/search/export/${sessionId}`,
};

// Profile
export const profileApi = {
  update: (name: string, avatar?: string) =>
    api.put('/profile', { name, avatar }),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.put('/profile/password', { currentPassword, newPassword }),
};

// Stats
export const statsApi = {
  summary: () => api.get('/stats/summary'),
};

// Documents
export const documentsApi = {
  list: () => api.get('/documents'),
  upload: (formData: FormData) =>
    api.post('/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  create: (title: string, content: string) =>
    api.post('/documents', { title, content }),
  get: (id: string) => api.get(`/documents/${id}`),
  delete: (id: string) => api.delete(`/documents/${id}`),
};
