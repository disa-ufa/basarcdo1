// src/api/http.js
import axios from 'axios';

const http = axios.create({
  baseURL: '/api',
  timeout: 45000,
});

function safeUser() {
  try { return JSON.parse(localStorage.getItem('user') || 'null') || null; }
  catch (_e) { return null; } // не пустой catch
}

// добавить token в query, не перетирая уже заданные params
function ensureTokenParam(cfg, token) {
  if (!token) return;
  if (!cfg.params) cfg.params = {};
  if (cfg.params.token == null) cfg.params.token = token;
}

http.interceptors.request.use((cfg) => {
  const u = safeUser();
  const token = u?.token || null;

  // базовые заголовки
  cfg.headers = { Accept: 'application/json', ...(cfg.headers || {}) };

  // gateway: только Bearer (никаких Basic)
  if (token && !cfg.headers.Authorization) {
    cfg.headers.Authorization = `Bearer ${token}`;
  }

  // для 1С: дублируем токен в заголовках и как параметр
  if (token) {
    if (!cfg.headers['Token'])        cfg.headers['Token'] = token;
    if (!cfg.headers['X-Auth-Token']) cfg.headers['X-Auth-Token'] = token;
    ensureTokenParam(cfg, token);
  }

  return cfg;
});

// авто-выход по 401 (событие нужно, чтобы скрыть кнопки/меню на UI)
http.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      try { localStorage.removeItem('user'); }
      catch (_e) { /* noop */ } // не пустой catch
      window.dispatchEvent(new Event('auth-changed'));
      if (!location.hash.startsWith('#/login')) location.hash = '#/login';
    }
    return Promise.reject(err);
  }
);

export default http;
