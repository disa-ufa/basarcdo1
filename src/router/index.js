import { createRouter, createWebHistory } from 'vue-router'

import AppLogin from '@/components/AppLogin.vue'
import TableStudent from '@/components/TableStudent.vue'
import TableTeachers from '@/components/TableTeachers.vue'
import TableStudentContracts from '@/components/TableStudentContracts.vue'
import TableTeacherContracts from '@/components/TableTeacherContracts.vue'
import TableOS from '@/components/TableOS.vue'
import TableMZ from '@/components/TableMZ.vue'
import TableMZHOZ from '@/components/TableMZHOZ.vue'
import AnalizBD from '@/components/AnalizBD.vue'
import AnalizMZ from '@/components/AnalizMZ.vue'
import PerecMOL from '@/components/PerecMOL.vue'
import TableFil from '@/components/TableFil.vue'
import AnalizBDarhiv from '@/components/AnalizBDarhiv.vue'
import AnalizMZarhiv from '@/components/AnalizMZarhiv.vue'

const routes = [
  { path: '/login', component: AppLogin },
  { path: '/students', component: TableStudent, meta: { requiresAuth: true } },
  { path: '/teachers', component: TableTeachers, meta: { requiresAuth: true } },
  { path: '/student-contracts', component: TableStudentContracts, meta: { requiresAuth: true } },
  { path: '/teacher-contracts', component: TableTeacherContracts, meta: { requiresAuth: true } },
  { path: '/TableOS', component: TableOS, meta: { requiresAuth: true } },
  { path: '/TableMZ', component: TableMZ, meta: { requiresAuth: true } },
  { path: '/TableMZHOZ', component: TableMZHOZ, meta: { requiresAuth: true } },
  { path: '/AnalizBD', component: AnalizBD, meta: { requiresAuth: true } },
  { path: '/AnalizMZ', component: AnalizMZ, meta: { requiresAuth: true } },
  { path: '/PerecMOL', component: PerecMOL, meta: { requiresAuth: true } },
  { path: '/TableFil', component: TableFil, meta: { requiresAuth: true } },
  { path: '/AnalizBDarhiv', component: AnalizBDarhiv, meta: { requiresAuth: true } },
  { path: '/AnalizMZarhiv', component: AnalizMZarhiv, meta: { requiresAuth: true } },
  { path: '/', redirect: '/students' }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const isAuthenticated = !!localStorage.getItem('user')
  if (to.meta.requiresAuth && !isAuthenticated) {
    next('/login')
  } else {
    next()
  }
})

export default router
