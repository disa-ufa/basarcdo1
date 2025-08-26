<template>
  <div class="login-form">
    <h2>Вход</h2>
    <form @submit.prevent="loginFn">
      <input v-model="login" placeholder="Логин" autocomplete="username" required>
      <input v-model="password" type="password" placeholder="Пароль" autocomplete="current-password" required>
      <button type="submit">Войти</button>
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
const router = useRouter()

async function loginFn() {
  error.value = ''
  try {
    const { data } = await http.post('/RCDO/hs/rcdo/Login', { Логин: login.value, Пароль: password.value })
    if (!data?.success) {
      error.value = data?.message || 'Ошибка входа'
    } else {
      localStorage.setItem('user', JSON.stringify(data.user))
      window.dispatchEvent(new Event('storage'))
      router.push('/students')
    }
  } catch (e) {
    error.value = 'Ошибка сети'
  }
}
</script>

<style scoped>
.login-form{max-width:320px;margin:40px auto;padding:24px;background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.08)}
input{width:100%;padding:8px;margin-bottom:10px;border-radius:4px;border:1px solid #ccc}
button{width:100%;padding:10px;border:none;background:#42b983;color:#fff;font-weight:700;border-radius:4px;cursor:pointer}
button:hover{background:#369c72}
.error{color:#b53c3c;margin-top:10px;font-size:14px}
</style>
