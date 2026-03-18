// src/api/http.js
import axios from 'axios';

const http = axios.create({
  baseURL: '/api',
  timeout: 45000,
});

function readUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
}

function readToken() {
  return readUser()?.token || null;
}

http.interceptors.request.use((cfg) => {
  const token = readToken();

  // Базовые заголовки
  cfg.headers = {
    Accept: 'application/json',
    ...(cfg.headers || {}),
  };

  // Если уже есть Authorization (например, Basic) — не трогаем
  if (token && !cfg.headers.Authorization) {
    cfg.headers.Authorization = `Bearer ${token}`;
  }

  // Доп. каналы передачи токена для 1С
  if (token) {
    cfg.headers.Token = cfg.headers.Token || token;
    cfg.headers['X-Auth-Token'] = cfg.headers['X-Auth-Token'] || token;
  }

  const user = readUser();
  const login = user?.login || user?.Логин || '';
  const url = String(cfg.url || '');

  // Для RightsMe: и заголовок, и тело (на случай если прокси режет заголовки)
  if (/rightsme/i.test(url) || /rights-me/i.test(url)) {
    if (login) {
      cfg.headers['X-User'] = login;
      cfg.data = { ...(cfg.data || {}), login }; // <-- ключевая строка
    }
    // гарантируем метод POST
    if (!cfg.method) cfg.method = 'post';
  }

  return cfg;
});

export default http;
