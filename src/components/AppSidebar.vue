<template>
  <div class="sidebar">
    <!-- User block -->
    <div class="user-block">
      <!-- Если авторизован, показываем профиль и "Выйти" -->
      <template v-if="user">
        <div>👤 {{ user.ФИО || user.Логин }}</div>
        <div style="font-size: 12px; color: gray">Права: {{ user.Права }}</div>
        <button @click="logout" style="margin-top: 10px;">Выйти</button>
        <hr style="margin: 16px 0;">
      </template>
      <!-- Если не авторизован и НЕ на /login, показываем "Войти" -->
      <template v-else-if="showSidebarLoginButton">
        <router-link to="/login"><button>Войти</button></router-link>
        <hr style="margin: 16px 0;">
      </template>
    </div>

    <div class="sidebar-header">
      <h3>РЦДО</h3>
    </div>
    <!-- Основное меню только для авторизованных -->
    <div class="sidebar-menu" v-if="user">
      <!-- Пользователи -->
      <div class="menu-category">
        <div class="menu-category-header" @click="toggleCategory('users')">
          <span>Пользователи</span>
          <span class="arrow" :class="{ 'arrow-down': expandedCategories.users }">▶</span>
        </div>
        <div class="menu-items" v-if="expandedCategories.users">
          <div
            class="menu-item"
            :class="{ active: activeRoute === '/students' }"
            @click="navigate('/students')"
          >Ученики</div>
          <div
            class="menu-item"
            :class="{ active: activeRoute === '/teachers' }"
            @click="navigate('/teachers')"
          >Учителя</div>
        </div>
      </div>

      <!-- Договора -->
      <div class="menu-category">
        <div class="menu-category-header" @click="toggleCategory('contracts')">
          <span>Договора</span>
          <span class="arrow" :class="{ 'arrow-down': expandedCategories.contracts }">▶</span>
        </div>
        <div class="menu-items" v-if="expandedCategories.contracts">
          <div
            class="menu-item"
            :class="{ active: activeRoute === '/student-contracts' }"
            @click="navigate('/student-contracts')"
          >Договора</div>
          <div
            class="menu-item"
            :class="{ active: activeRoute === '/teacher-contracts' }"
            @click="navigate('/teacher-contracts')"
          >------</div>
        </div>
      </div>

      <!-- Оборудование -->
      <div class="menu-category">
        <div class="menu-category-header" @click="toggleCategory('OS')">
          <span>Оборудование</span>
          <span class="arrow" :class="{ 'arrow-down': expandedCategories.OS }">▶</span>
        </div>
        <div class="menu-items" v-if="expandedCategories.OS">
          <div
            class="menu-item"
            :class="{ active: activeRoute === '/TableOS' }"
            @click="navigate('/TableOS')"
          >Основные средства</div>
          <div
            class="menu-item"
            :class="{ active: activeRoute === '/TableMZ' }"
            @click="navigate('/TableMZ')"
          >Мат запасы техника</div>
          <div
            class="menu-item"
            :class="{ active: activeRoute === '/TableMZHOZ' }"
            @click="navigate('/TableMZHOZ')"
          >Мат запасы хоз</div>
        </div>
      </div>

      <!-- Анализ -->
      <div class="menu-category">
        <div class="menu-category-header" @click="toggleCategory('AnalizBD')">
          <span>Анализ</span>
          <span class="arrow" :class="{ 'arrow-down': expandedCategories.AnalizBD }">▶</span>
        </div>
        <div class="menu-items" v-if="expandedCategories.AnalizBD">
          <div
            class="menu-item"
            :class="{ active: activeRoute === '/AnalizBD' }"
            @click="navigate('/AnalizBD')"
          >Основные средства</div>
          <div
            class="menu-item"
            :class="{ active: activeRoute === '/AnalizBDarhiv' }"
            @click="navigate('/AnalizBDarhiv')"
          >Основные средства Архив</div> 
          <div
            class="menu-item"
            :class="{ active: activeRoute === '/AnalizMZ' }"
            @click="navigate('/AnalizMZ')"
          >Забаланс</div>
          <div
            class="menu-item"
            :class="{ active: activeRoute === '/AnalizMZarhiv' }"
            @click="navigate('/AnalizMZarhiv')"
          >Забаланс Архив</div>
          <div
            class="menu-item"
            :class="{ active: activeRoute === '/PerecMOL' }"
            @click="navigate('/PerecMOL')"
          >МОЛ</div>
          <div
            class="menu-item"
            :class="{ active: activeRoute === '/TableFil' }"
            @click="navigate('/TableFil')"
          >Филиал</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

function getUser() {
  try {
    return JSON.parse(localStorage.getItem('user'))
  } catch {
    return null
  }
}
const user = ref(getUser())
function updateUser() {
  user.value = getUser()
}

onMounted(() => {
  window.addEventListener('storage', updateUser)
})
onUnmounted(() => {
  window.removeEventListener('storage', updateUser)
})

function logout() {
  localStorage.removeItem('user')
  user.value = null
  window.dispatchEvent(new Event('storage'))
  router.push('/login')
}

// Категории (группы меню)
const expandedCategories = ref({
  users: true,
  contracts: false,
  OS: false,
  AnalizBD: false,
})
const activeRoute = computed(() => route.path)

function navigate(path) {
  if (route.path !== path) {
    router.push(path)
  }
}
function toggleCategory(category) {
  expandedCategories.value[category] = !expandedCategories.value[category]
}
const showSidebarLoginButton = computed(() => {
  return !user.value && route.path !== '/login'
})
</script>

<style scoped>
.sidebar {
  width: 250px;
  background-color: #2c3e50;
  color: white;
  height: 100vh;
  box-shadow: 2px 0 5px rgba(0,0,0,0.1);
  display: flex;
  flex-direction: column;
}

.user-block {
  padding: 20px 15px 10px 15px;
  border-bottom: 1px solid #3c4e60;
}

.sidebar-header {
  padding: 20px 15px;
  border-bottom: 1px solid #3c4e60;
}

.sidebar-header h3 {
  margin: 0;
  font-size: 18px;
}

.sidebar-menu {
  padding: 15px 0;
  flex: 1 1 auto;
}

.menu-category {
  margin-bottom: 10px;
}

.menu-category-header {
  padding: 10px 15px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: bold;
  transition: background-color 0.2s;
}

.menu-category-header:hover {
  background-color: #3c4e60;
}

.menu-items {
  padding-left: 15px;
}

.menu-item {
  padding: 8px 15px 8px 20px;
  cursor: pointer;
  transition: background-color 0.2s;
  border-left: 3px solid transparent;
}

.menu-item:hover {
  background-color: #3c4e60;
}

.menu-item.active {
  background-color: #34495e;
  border-left-color: #42b983;
}

.arrow {
  transition: transform 0.3s;
  font-size: 10px;
}

.arrow-down {
  transform: rotate(90deg);
}
</style>
