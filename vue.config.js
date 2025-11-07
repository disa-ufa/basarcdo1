// vue.config.js
const { Buffer } = require('buffer');

const basic = 'Basic ' + Buffer
  .from(`${process.env.VUE_APP_1C_USER}:${process.env.VUE_APP_1C_PASS}`, 'utf8')
  .toString('base64');

module.exports = {
  devServer: {
    port: 8081,
    proxy: {
      '^/api': {
        target: 'http://192.168.88.102',
        changeOrigin: true,
        logLevel: 'debug',
        proxyTimeout: 30000,
        preserveHeaderKeyCase: true,
        xfwd: true,
        onProxyReq(proxyReq) {
          // 1С примет только Basic — ставим безусловно
          proxyReq.setHeader('Authorization', basic);
          proxyReq.setHeader('Proxy-Authorization', basic);
          // ничего с фронта не тянем
          proxyReq.removeHeader('Cookie');
          proxyReq.removeHeader('Origin');
        },
        onProxyRes(proxyRes) {
          // чтобы браузер не выкидывал Basic-попап
          if (proxyRes.headers && proxyRes.headers['www-authenticate']) {
            delete proxyRes.headers['www-authenticate'];
          }
        }
      }
    }
  }
};
