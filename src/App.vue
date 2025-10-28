<template>
  <div class="layout">
    <!-- Сайдбар только для авторизованных -->
    <AppSidebar v-if="isAuth" />

    <div class="content-wrap">
      <!-- Прячем верхний бар на странице логина и когда не авторизованы -->
      <AppTopbar v-if="isAuth && !route.path.startsWith('/login')" />
      <main class="content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import AppTopbar from '@/components/layout/AppTopbar.vue'

function computeAuth() {
  try {
    const raw = localStorage.getItem('user')
    if (raw) {
      const u = JSON.parse(raw)
      if (u && (u.token || u.login || u.fio || u.name || u.fullName)) return true
    }
  } catch (e) { void e } // не пустой catch
  return !!(localStorage.getItem('fio') || localStorage.getItem('login') || localStorage.getItem('username'))
}

export default {
  components: { AppSidebar, AppTopbar },
  setup(){
    const route = useRoute()
    const isAuth = ref(computeAuth())

    // обработчик НЕ пустой — пересчитываем признак авторизации
    const handler = () => { isAuth.value = computeAuth() }

    onMounted(() => {
      window.addEventListener('auth-changed', handler)
      window.addEventListener('storage',       handler)
    })
    onBeforeUnmount(() => {
      window.removeEventListener('auth-changed', handler)
      window.removeEventListener('storage',       handler)
    })

    return { route, isAuth }
  }
}
</script>

<style>
/* Скроллбар без «прыжков» */
html { scrollbar-gutter: stable both-edges; }
@supports not (scrollbar-gutter: stable) { body { overflow-y: scroll; } }

html, body, #app { height: 100%; }
body { margin: 0; font-size: 17px; line-height: 1.5; }

h1 { font-size: 2rem;   margin: .6rem 0 1rem; }
h2 { font-size: 1.4rem; margin: .6rem 0 .8rem; }

.layout { display: flex; min-height: 100vh; }
.content-wrap{
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: #f3f4f6;
}
.content{
  flex: 1 1 auto;
  min-width: 0;
  background: #fff;
}
.table, table { font-size: 1rem; }
.table th, .table td { padding: .65rem .75rem; }
</style>
