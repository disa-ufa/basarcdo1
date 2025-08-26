// vue.config.js
module.exports = {
  devServer: {
    port: 8081,
    proxy: {
      '^/api': {
        target: 'http://136.169.171.150:8080',  // наш Node-гейтвей
        changeOrigin: true,
        logLevel: 'debug',

        // НИЧЕГО НЕ ВЫРЕЗАЕМ! Префикс /api должен дойти до гейтвея,
        // чтобы он добавил Basic к запросу в 1С.
        // pathRewrite: { '^/api': '' },

        proxyTimeout: 30000,
        preserveHeaderKeyCase: true,

        // ВАЖНО: вычищаем заголовок, чтобы браузер не показывал базовый промпт
        onProxyRes(proxyRes /*, req, res */) {
          if (proxyRes.headers && proxyRes.headers['www-authenticate']) {
            delete proxyRes.headers['www-authenticate'];
          }
        },

        onError(err, req, res) {
          console.error('Proxy error:', err && err.message);
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Ошибка соединения с гейтвеем: ' + (err && err.message));
        }
      }
    }
  }
};
