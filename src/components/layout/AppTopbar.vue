<template>
  <header class="topbar">
    <div class="left"></div>

    <div class="right">
      <div v-if="userName" class="user">
        <span class="avatar">{{ initials }}</span>
        <span class="name">
          {{ userName }}
          <span v-if="filial" class="sep"> · </span>
          <span v-if="filial" class="filial">{{ filial }}</span>
        </span>
      </div>

      <button class="btn-logout" @click="logout" title="Выйти">
        Выйти
      </button>
    </div>
  </header>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const userName = ref('')
const filialStore = ref('')

function readFromStorage () {
  const rawUser = localStorage.getItem('user') || localStorage.getItem('profile')
  let parsed
  try { parsed = rawUser ? JSON.parse(rawUser) : null } catch { parsed = null }

  userName.value =
    (parsed && (parsed.fio || parsed.fullName || parsed.name || parsed.login)) ||
    localStorage.getItem('fio') ||
    localStorage.getItem('username') ||
    localStorage.getItem('login') ||
    'Пользователь'

  // филиал: из user (filial/Филиал) либо отдельный ключ
  filialStore.value =
    (parsed && (parsed.filial || parsed['Филиал'])) ||
    localStorage.getItem('filial') ||
    ''
}

function onAuthChanged() { readFromStorage() }

onMounted(() => {
  readFromStorage()
  window.addEventListener('auth-changed', onAuthChanged)
  window.addEventListener('storage', onAuthChanged)
})
onBeforeUnmount(() => {
  window.removeEventListener('auth-changed', onAuthChanged)
  window.removeEventListener('storage', onAuthChanged)
})

const initials = computed(() => {
  const v = (userName.value || '').trim()
  if (!v) return ''
  const parts = v.split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase()
  return (parts[0].slice(0,1) + parts[1].slice(0,1)).toUpperCase()
})

const filial = computed(() => (filialStore.value || '').trim())

function logout () {
  const keys = [
    'token','access_token','refresh_token','user','profile',
    'username','login','fio','filial'
  ]
  keys.forEach(k => localStorage.removeItem(k))
  window.dispatchEvent(new Event('auth-changed'))
  router.push('/login')
}
</script>

<style scoped>
.topbar{
  position: sticky;
  top: 0;
  z-index: 10;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #ffffff;
  border-bottom: 1px solid #e5e7eb;
  padding: 0 16px;
  box-shadow: 0 1px 0 rgba(0,0,0,.04);
  font-size: 16px;
}
.left{ min-width: 0; }
.right{ display: flex; align-items: center; gap: 12px; }

.user{ display:inline-flex; align-items:center; gap:8px; color:#111827; }
.avatar{
  width: 28px; height: 28px; border-radius: 50%;
  background:#2563eb; color:#fff; display:inline-flex;
  align-items:center; justify-content:center; font-weight:700;
  letter-spacing:.3px;
}
.name{ font-weight:600; display:flex; align-items:center; gap:4px; }
.sep{ opacity:.5; }
.filial{ color:#4b5563; font-weight:500; }

.btn-logout{
  appearance:none; border:1px solid #d1d5db; background:#f3f4f6;
  color:#111827; border-radius:6px; padding:6px 10px; font-weight:600;
  cursor:pointer; transition:background .15s ease, border-color .15s ease;
}
.btn-logout:hover{ background:#e5e7eb; border-color:#cbd5e1; }
</style>
