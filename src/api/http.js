// src/api/http.js
import axios from 'axios';

const http = axios.create({
  baseURL: '/api',
  timeout: 45000
});

// Добавляем заголовок авторизации из localStorage (например, Bearer)
http.interceptors.request.use(cfg => {
  const raw = localStorage.getItem('user');
  if (raw) {
    try {
      const user = JSON.parse(raw);
      if (user && user.token) {
        cfg.headers.Authorization = `Bearer ${user.token}`;
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.debug('Invalid user JSON in localStorage, ignored');
    }
  }
  return cfg;
});

export default http;
