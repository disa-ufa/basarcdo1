// vue.config.js
const { Buffer } = require('buffer')

function makeBasic(user, pass) {
  return 'Basic ' + Buffer.from(`${user}:${pass}`, 'utf8').toString('base64')
}

const rcdoBasic = makeBasic(
  process.env.VUE_APP_1C_RCDO_USER,
  process.env.VUE_APP_1C_RCDO_PASS
)

const zguBasic = makeBasic(
  process.env.VUE_APP_1C_ZGU_USER,
  process.env.VUE_APP_1C_ZGU_PASS
)

module.exports = {
  devServer: {
    port: 8081,
    proxy: {
      '^/api/RCDO': {
        target: 'http://192.168.88.102',
        changeOrigin: true,
        logLevel: 'debug',
        proxyTimeout: 30000,
        preserveHeaderKeyCase: true,
        xfwd: true,
        pathRewrite: {
          '^/api/RCDO': '/RCDO'
        },
        onProxyReq(proxyReq) {
          proxyReq.setHeader('Authorization', rcdoBasic)
          proxyReq.setHeader('Proxy-Authorization', rcdoBasic)
          proxyReq.removeHeader('Cookie')
          proxyReq.removeHeader('Origin')
        },
        onProxyRes(proxyRes) {
          if (proxyRes.headers && proxyRes.headers['www-authenticate']) {
            delete proxyRes.headers['www-authenticate']
          }
        }
      },

      '^/api/ZGU': {
        target: 'http://192.168.88.102',
        changeOrigin: true,
        logLevel: 'debug',
        proxyTimeout: 30000,
        preserveHeaderKeyCase: true,
        xfwd: true,
        pathRewrite: {
          '^/api/ZGU': '/ZGU'
        },
        onProxyReq(proxyReq) {
          proxyReq.setHeader('Authorization', zguBasic)
          proxyReq.setHeader('Proxy-Authorization', zguBasic)
          proxyReq.removeHeader('Cookie')
          proxyReq.removeHeader('Origin')
        },
        onProxyRes(proxyRes) {
          if (proxyRes.headers && proxyRes.headers['www-authenticate']) {
            delete proxyRes.headers['www-authenticate']
          }
        }
      }
    }
  }
}