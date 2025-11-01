<template>
  <aside class="sidebar">
    <h2 class="sidebar-title">РЦДО</h2>

    <div
      v-for="section in sections"
      :key="section.key"
      class="section"
    >
      <button class="section-toggle" @click="toggle(section.key)">
        <span class="section-title">{{ section.title }}</span>
        <span class="chevron" :class="{ open: isOpen(section.key) }">▾</span>
      </button>

      <nav v-show="isOpen(section.key)" class="section-items">
        <RouterLink
          v-for="item in section.items"
          :key="item.to"
          :to="item.to"
          class="nav-link"
          :class="{ active: isActive(item.to) }"
        >
          {{ item.label }}
        </RouterLink>
      </nav>
    </div>
  </aside>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
const route = useRoute()

// --- права из localStorage ---
const rights = ref({})
function readRights () {
  try {
    const u = JSON.parse(localStorage.getItem('user') || 'null')
    rights.value = (u && u.rights) ? u.rights : {}
  } catch { rights.value = {} }
}
function can(flag) {
  if (!flag) return true
  return !!rights.value?.[flag]
}
function onAuthChanged() { readRights() }

onMounted(() => {
  readRights()
  window.addEventListener('auth-changed', onAuthChanged)
  window.addEventListener('storage', onAuthChanged)
})
onBeforeUnmount(() => {
  window.removeEventListener('auth-changed', onAuthChanged)
  window.removeEventListener('storage', onAuthChanged)
})

// --- состояния разделов ---
const openMap = ref({
  users: true,
  contracts: true,
  equipment: true,
  analysis: true,
})
const toggle  = k => (openMap.value[k] = !openMap.value[k])
const isOpen  = k => !!openMap.value[k]
const isActive = to => route.path === to || route.path.startsWith(to + '/')

// полное меню + флаг доступа на раздел
const menu = [
  {
    key: 'users',
    title: 'Пользователи',
    flag: 'Пользователи',
    items: [
      { label: 'Ученики', to: '/students' },
      { label: 'Учителя', to: '/teachers' },
    ],
  },
  {
    key: 'contracts',
    title: 'Договора',
    flag: 'Договора',
    items: [{ label: 'Договора', to: '/contracts' }],
  },
  {
    key: 'equipment',
    title: 'Оборудование',
    flag: 'Оборудование',
    items: [
      { label: 'Основные средства', to: '/equipment/os' },
      { label: 'Мат запасы техника', to: '/equipment/mz-tech' },
      { label: 'Мат запасы хоз', to: '/equipment/mz-hoz' },
    ],
  },
  {
    key: 'analysis',
    title: 'Анализ',
    flag: 'Анализ',
    items: [
      { label: 'Основные средства', to: '/analysis/os' },
      { label: 'Основные средства Архив', to: '/analysis/os-archive' },
      { label: 'Забаланс', to: '/analysis/mz-off' },
      { label: 'Забаланс Архив', to: '/analysis/mz-off-archive' },
      { label: 'МОЛ', to: '/analysis/mol' },
      { label: 'Филиал', to: '/analysis/filials' },
    ],
  },
]

// показываем только доступные разделы
const sections = computed(() => menu.filter(sec => can(sec.flag)))
</script>

<style scoped>
.sidebar{
  flex: 0 0 280px;
  height: 100vh;
  position: sticky;
  top: 0;
  box-sizing: border-box;
  overflow-y: auto;
  background: #263445;
  color: #fff;
  padding: 16px 12px;
}
.sidebar-title{
  margin: 6px 8px 18px;
  font-weight: 800;
  font-size: 26px;
  letter-spacing: .3px;
}
.section{ margin-bottom: 12px; }
.section-toggle{
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: transparent;
  border: 0;
  color: #cfd8e3;
  cursor: pointer;
  padding: 9px 10px;
  font-weight: 700;
  font-size: 16px;
  text-align: left;
}
.section-title{ color:#cfd8e3; }
.chevron{ transition: transform .15s ease; opacity: .9; }
.chevron.open{ transform: rotate(180deg); }
.section-items{ display: flex; flex-direction: column; padding-left: 8px; }
.nav-link{
  display: block;
  padding: 8px 12px;
  margin: 3px 0;
  border-left: 2px solid transparent;
  color: #cdd7e1;
  text-decoration: none;
  border-radius: 2px;
  font-size: 15px;
  transition: background .12s ease, color .12s ease, border-color .12s ease;
}
.nav-link:hover{ background: #1f2a38; color: #fff; }
.nav-link.active{
  background: #1f2a38;
  border-left-color: #2ea3ff;
  color: #fff;
}
</style>
