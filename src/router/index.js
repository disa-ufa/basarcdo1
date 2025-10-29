import { createRouter, createWebHashHistory } from 'vue-router';

function isAuthed() {
  try {
    const u = JSON.parse(localStorage.getItem('user') || 'null');
    return !!(u && (u.token || u.login || u.fio));
  } catch (_e) { return false; }
}

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('@/components/Home.vue') },

    { path: '/login', name: 'login', component: () => import('@/components/auth/AppLogin.vue') },

    // больше НИКАКИХ meta.right — доступ открыт, ограничения только визуально
    { path: '/students',  component: () => import('@/components/students/TableStudent.vue') },
    { path: '/teachers',  component: () => import('@/components/teachers/TableTeachers.vue') },
    { path: '/contracts', component: () => import('@/components/contracts/TableContracts.vue') },

    { path: '/equipment/os',      component: () => import('@/components/equipment/os/TableOS.vue') },
    { path: '/equipment/mz-tech', component: () => import('@/components/equipment/mz/TableMZ.vue') },
    { path: '/equipment/mz-hoz',  component: () => import('@/components/equipment/mz/TableMZHOZ.vue') },

    { path: '/analysis/os',             component: () => import('@/components/analysis/AnalizBD.vue') },
    { path: '/analysis/os-archive',     component: () => import('@/components/analysis/AnalizBDarhiv.vue') },
    { path: '/analysis/mz-off',         component: () => import('@/components/analysis/AnalizMZ.vue') },
    { path: '/analysis/mz-off-archive', component: () => import('@/components/analysis/AnalizMZarhiv.vue') },
    { path: '/analysis/mol',            component: () => import('@/components/analysis/PerecMOL.vue') },
    { path: '/analysis/filials',        component: () => import('@/components/analysis/TableFil.vue') },

    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

// единственная логика — требуем логин для любых страниц, кроме /login
router.beforeEach((to) => {
  const authed = isAuthed();

  if (!authed && to.path !== '/login') {
    return { path: '/login', replace: true };
  }

  if (authed && to.path === '/login') {
    return { path: '/', replace: true };
  }

  return true;
});

export default router;
