// src/main.js
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

// Используем алиас @ — путь стабильнее, чем относительный
import '@/components/modal-styles.css'

createApp(App).use(router).mount('#app')
