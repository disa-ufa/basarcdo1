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
  // сервер отдаёт: { success, message, user:{ФИО,Логин,Права,token, Филиал, Филиал_Код}, role, rights }
  const src = payload?.user && typeof payload.user === 'object' ? payload.user : payload
  return {
    token:   src?.token  ?? src?.Token  ?? payload?.token  ?? null,
    fio:     src?.fio    ?? src?.ФИО    ?? src?.fullName ?? src?.name ?? fallbackLogin ?? null,
    login:   src?.login  ?? src?.Логин  ?? fallbackLogin ?? null,
    role:    payload?.role ?? src?.role ?? null,
    rights:  payload?.rights ?? src?.rights ?? {},
    roles:   payload?.roles ?? src?.Роли ?? [],
    // НОВОЕ: филиал
    filial:      src?.filial      ?? src?.Филиал      ?? '',
    filialCode:  src?.filialCode  ?? src?.Филиал_Код  ?? '',
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

// Дотягиваем недостающие поля (в т.ч. Филиал) из RightsMe
async function augmentFromRightsMe(userNow) {
  try {
    const { data } = await http.post('/RCDO/hs/rcdo/RightsMe', {})
    const meUser = data?.user || {}
    const withMe = {
      ...userNow,
      fio:   userNow.fio   || meUser.ФИО   || meUser.fio   || meUser.name || userNow.login || '',
      login: userNow.login || meUser.Логин || meUser.login || userNow.login || '',
      role:  userNow.role ?? data?.role ?? null,
      rights: (userNow.rights && Object.keys(userNow.rights).length) ? userNow.rights : (data?.rights || {}),
      filial:     userNow.filial     || meUser.Филиал     || meUser.filial     || '',
      filialCode: userNow.filialCode || meUser.Филиал_Код || meUser.filialCode || '',
    }
    return withMe
  } catch {
    return userNow
  }
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

    // 1) База от Login
    let user = normalizeUser(data, login.value)
    localStorage.setItem('user', JSON.stringify(user))
    if (user.fio)    localStorage.setItem('fio', user.fio)
    if (user.filial) localStorage.setItem('filial', user.filial)

    // 2) Дотягиваем user из RightsMe (даст Филиал/код и, если надо, права)
    user = await augmentFromRightsMe(user)
    localStorage.setItem('user', JSON.stringify(user))
    if (user.fio)    localStorage.setItem('fio', user.fio)
    if (user.filial) localStorage.setItem('filial', user.filial)

    // уведомим слушателей (топбар и пр.)
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
