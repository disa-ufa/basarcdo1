<template>
  <div class="login-form">
    <h2>Вход</h2>
    <form @submit.prevent="loginFn">
      <input v-model="login" placeholder="Логин" autocomplete="username" required>
      <input v-model="password" type="password" placeholder="Пароль" autocomplete="current-password" required>
      <button type="submit" :disabled="loading">{{ loading ? 'Входим…' : 'Войти' }}</button>
      <div v-if="error" class="error">{{ error }}</div>
    </form>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import http from '@/api/http'

const login = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const router = useRouter()

function normalizeUser(payload, fallbackLogin) {
  // сервер отдаёт: { success, message, user:{ФИО,Логин,Права,token}, role, rights }
  const src = payload?.user && typeof payload.user === 'object' ? payload.user : payload
  return {
    token:   src?.token  ?? src?.Token  ?? payload?.token  ?? null,
    fio:     src?.fio    ?? src?.ФИО    ?? src?.fullName ?? src?.name ?? fallbackLogin ?? null,
    login:   src?.login  ?? src?.Логин  ?? fallbackLogin ?? null,
    role:    payload?.role ?? src?.role ?? null,
    rights:  payload?.rights ?? src?.rights ?? {},
    roles:   payload?.roles ?? src?.Роли ?? [],
    ts:      Date.now(),
  }
}

function firstRouteByRights(rights = {}) {
  if (rights['Пользователи']) return '/students'
  if (rights['Договора'])     return '/contracts'
  if (rights['Оборудование']) return '/equipment/os'
  if (rights['Анализ'])       return '/analysis/os'
  // если прав нет — ведём на домашнюю (без ограничений)
  return '/'
}

async function loginFn() {
  error.value = ''
  loading.value = true
  try {
    const { data } = await http.post('/RCDO/hs/rcdo/Login', { Логин: login.value, Пароль: password.value })
    if (!data?.success) {
      error.value = data?.message || 'Ошибка входа'
      return
    }
    const user = normalizeUser(data, login.value)

    localStorage.setItem('user', JSON.stringify(user))
    if (user.fio) localStorage.setItem('fio', user.fio)

    window.dispatchEvent(new Event('auth-changed'))

    router.push(firstRouteByRights(user.rights))
  } catch (e) {
    error.value = 'Ошибка сети'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-form{max-width:320px;margin:40px auto;padding:24px;background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.08)}
input{width:100%;padding:8px;margin-bottom:10px;border-radius:4px;border:1px solid #ccc}
button{width:100%;padding:10px;border:none;background:#42b983;color:#fff;font-weight:700;border-radius:4px;cursor:pointer}
button[disabled]{opacity:.7;cursor:default}
button:not([disabled]):hover{background:#369c72}
.error{color:#b53c3c;margin-top:10px;font-size:14px}
</style>
