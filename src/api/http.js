// src/api/http.js
import axios from 'axios';

const http = axios.create({
  baseURL: '/api',
  timeout: 45000,
});

/** Безопасное чтение user из LS */
function safeUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null') || null;
  } catch (_e) {
    return null;
  }
}

/** Эндпоинты со «строгим» парсингом query — нельзя добавлять ничего лишнего */
function isStrictQueryEndpoint(url) {
  // Работаем по относительному пути, допускаем варианты:
  // '/Dogovor', 'Dogovor', '/api/Dogovor', а также 'URLUD_ДоговорПоНомеру'
  const s = String(url || '');
  const STRICT_RE = /^(?:\/api\/|\/)?(?:Dogovor|URLUD_ДоговорПоНомеру)(?:\/|\b)/i;
  return STRICT_RE.test(s);
}

http.interceptors.request.use((cfg) => {
  const u = safeUser();
  const token = u?.token || null;

  // Базовые заголовки
  cfg.headers = cfg.headers || {};
  if (!('Accept' in cfg.headers)) cfg.headers.Accept = 'application/json';

  // Проставляем Content-Type только для простых объектов (не FormData/Blob)
  const isPlainObject =
    cfg.data &&
    typeof cfg.data === 'object' &&
    !(cfg.data instanceof FormData) &&
    !(cfg.data instanceof Blob);

  if (isPlainObject && !('Content-Type' in cfg.headers)) {
    cfg.headers['Content-Type'] = 'application/json';
  }

  // Никогда не подмешиваем ?token=...
  if (cfg.params && Object.prototype.hasOwnProperty.call(cfg.params, 'token')) {
    delete cfg.params.token;
  }

  const strict = isStrictQueryEndpoint(cfg.url);

  if (strict) {
    // Для строгих ручек — НИКАКИХ auth-заголовков
    delete cfg.headers.Authorization;
    delete cfg.headers.Token;
    delete cfg.headers['X-Auth-Token'];

    // В query оставляем только nomer (обрезаем пробелы)
    const nomer =
      cfg?.params && cfg.params.nomer != null
        ? String(cfg.params.nomer).trim()
        : undefined;

    cfg.params = nomer !== undefined ? { nomer } : undefined;

    // На всякий случай задаём сериализацию "nomer=..."
    cfg.paramsSerializer = (params) => {
      if (!params || params.nomer == null) return '';
      return 'nomer=' + encodeURIComponent(String(params.nomer));
    };
  } else {
    // Обычные ручки — Bearer в Authorization и дубли в X-заголовки для 1С
    if (token && !cfg.headers.Authorization) {
      cfg.headers.Authorization = `Bearer ${token}`;
    }
    if (token) {
      if (!cfg.headers.Token) cfg.headers.Token = token;
      if (!cfg.headers['X-Auth-Token']) cfg.headers['X-Auth-Token'] = token;
    }
  }

  return cfg;
});

// Авто-выход по 401
http.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      try {
        localStorage.removeItem('user');
      } catch (_e) {
        // ignore
      }
      window.dispatchEvent(new Event('auth-changed'));
      if (!location.hash.startsWith('#/login')) location.hash = '#/login';
    }
    return Promise.reject(err);
  }
);

export default http;
