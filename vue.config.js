const { defineConfig } = require('@vue/cli-service')
module.exports = defineConfig({
  transpileDependencies: true,
  devServer: {
    proxy: {
      '/api': {
        target: 'http://136.169.171.150:8080',
        pathRewrite: { '^/api': '/RCDO/hs/rcdo' },
        changeOrigin: true
      }
    }
  }
})
