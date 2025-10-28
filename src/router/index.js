import { createRouter, createWebHashHistory, RouterView } from 'vue-router'
const Empty = RouterView

function isAuthed() {
  try {
    const u = JSON.parse(localStorage.getItem('user') || 'null')
    if (u && (u.token || u.login || u.fio || u.name || u.fullName)) return true
  } catch (e) { void e }
  return !!(localStorage.getItem('fio') || localStorage.getItem('login') || localStorage.getItem('username'))
}

function getRights () {
  try {
    const u = JSON.parse(localStorage.getItem('user') || 'null')
    return (u && u.rights) ? u.rights : {}
  } catch { return {} }
}
function firstAllowedPath (r = getRights()) {
  if (r['Пользователи']) return '/students'
  if (r['Договора'])     return '/contracts'
  if (r['Оборудование']) return '/equipment/os'
  if (r['Анализ'])       return '/analysis/os'
  // если прав нет — отправляем на домашнюю, где нет meta.right
  return '/'
}

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('@/components/Home.vue') },

    { path: '/login', name: 'login', component: () => import('@/components/auth/AppLogin.vue') },

    { path: '/students', alias: ['/users/students'], meta: { right: 'Пользователи' }, component: () => import('@/components/students/TableStudent.vue') },
    { path: '/teachers', alias: ['/users/teachers'], meta: { right: 'Пользователи' }, component: () => import('@/components/teachers/TableTeachers.vue') },

    { path: '/contracts', meta: { right: 'Договора' }, component: () => import('@/components/contracts/TableContracts.vue') },

    {
      path: '/equipment', component: Empty, children: [
        { path: 'os',      meta: { right: 'Оборудование' }, component: () => import('@/components/equipment/os/TableOS.vue') },
        { path: 'mz-tech', meta: { right: 'Оборудование' }, component: () => import('@/components/equipment/mz/TableMZ.vue') },
        { path: 'mz-hoz',  meta: { right: 'Оборудование' }, component: () => import('@/components/equipment/mz/TableMZHOZ.vue') },
      ]
    },

    {
      path: '/analysis', component: Empty, children: [
        { path: 'os',             meta: { right: 'Анализ' }, component: () => import('@/components/analysis/AnalizBD.vue') },
        { path: 'os-archive',     meta: { right: 'Анализ' }, component: () => import('@/components/analysis/AnalizBDarhiv.vue') },
        { path: 'mz-off',         meta: { right: 'Анализ' }, component: () => import('@/components/analysis/AnalizMZ.vue') },
        { path: 'mz-off-archive', meta: { right: 'Анализ' }, component: () => import('@/components/analysis/AnalizMZarhiv.vue') },
        { path: 'mol',            meta: { right: 'Анализ' }, component: () => import('@/components/analysis/PerecMOL.vue') },
        { path: 'filials',        meta: { right: 'Анализ' }, component: () => import('@/components/analysis/TableFil.vue') },
      ]
    },

    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

// глобальный гард
router.beforeEach((to) => {
  const authed = isAuthed()

  // 1) Без логина — только /login
  if (to.path !== '/login' && !authed) {
    return { path: '/login', replace: true }
  }

  // 2) Уже залогинен — не держать на /login
  if (to.path === '/login' && authed) {
    const target = firstAllowedPath()
    if (to.path !== target) {
      return { path: target, replace: true }
    }
    return true
  }

  // 3) Проверка прав по meta.right
  const needRight = to.meta && to.meta.right
  if (needRight) {
    const rights = getRights()
    if (!rights[needRight]) {
      const target = firstAllowedPath(rights)
      // защита от бесконечных редиректов: не редиректить на тот же путь
      if (to.path !== target) {
        return { path: target, replace: true }
      }
      return true
    }
  }

  return true
})

export default router
