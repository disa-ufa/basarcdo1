// src/api/http.js
import axios from 'axios';

const http = axios.create({
  baseURL:
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
    process.env.VUE_APP_API_BASE_URL ||
    '/api',
  timeout: 45000,
  withCredentials: false,
});

/** Безопасно читаем токен из localStorage */
function readToken() {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.token || null;
  } catch (e) {
    return null;
  }
}

/** REQUEST: подставляем заголовки и токен */
http.interceptors.request.use(
  (cfg) => {
    const token = readToken();

    // Базовые заголовки
    cfg.headers = { Accept: 'application/json', ...(cfg.headers || {}) };

    // Для JSON-запросов (POST/PUT/PATCH) ставим Content-Type если он не задан
    const method = (cfg.method || 'get').toLowerCase();
    if (['post', 'put', 'patch'].includes(method) && cfg.data && !cfg.headers['Content-Type']) {
      cfg.headers['Content-Type'] = 'application/json';
    }

    // Авторизация: Bearer + дубли под 1С
    if (token && !cfg.headers.Authorization) {
      cfg.headers.Authorization = `Bearer ${token}`;
      cfg.headers.Token = cfg.headers.Token || token;
      cfg.headers['X-Auth-Token'] = cfg.headers['X-Auth-Token'] || token;
    }

    return cfg;
  },
  (error) => Promise.reject(error)
);

/** RESPONSE: нормализуем ошибки */
http.interceptors.response.use(
  (resp) => resp,
  (error) => {
    if (error?.response?.status === 401) {
      // при необходимости можно разлогинить:
      // localStorage.removeItem('user');
    }

    // Возвращаем полезное тело ошибки, если есть
    const payload = error?.response?.data ?? { message: error?.message || 'Network error' };
    return Promise.reject(payload);
  }
);

export default http;
