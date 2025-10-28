// src/api/http.js
import axios from 'axios';

const http = axios.create({
  baseURL: '/api',
  timeout: 45000,
});

http.interceptors.request.use((cfg) => {
  const raw = localStorage.getItem('user');
  let token = null;
  if (raw) {
    try {
      token = JSON.parse(raw)?.token ?? null;
    } catch (e) {
      token = null; // не пустой catch
    }
  }

  cfg.headers = { Accept: 'application/json', ...(cfg.headers || {}) };

  // Если кто-то уже поставил Authorization (например, gateway/Basic) — не трогаем.
  if (token && !cfg.headers.Authorization) {
    cfg.headers.Authorization = `Bearer ${token}`;
  }
  return cfg;
});

// Авторазлогин по 401
http.interceptors.response.use(
  (r) => r,
  (err) => {
    const status = err?.response?.status;
    if (status === 401) {
      try {
        localStorage.removeItem('user');
      } catch (e) { void e } // не пустой catch
      window.dispatchEvent(new Event('auth-changed'));
      if (!location.hash.startsWith('#/login')) {
        location.hash = '#/login';
      }
    }
    return Promise.reject(err);
  }
);

export default http;
