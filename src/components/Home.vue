<script setup>
import { ref } from 'vue'
import AppSidebar from './AppSidebar.vue'
import TableStudent from './TableStudent.vue'
import TableOS from './TableOS.vue'
// остальные компоненты подключаем аналогично...

const activeSection = ref('students')
</script>

<template>
  <div class="app">
    <AppSidebar />
    <div class="content">
      <TableStudent v-if="activeSection === 'students'" />
      <TableOS v-if="activeSection === 'TableOS'" />
      <!-- остальные компоненты аналогично -->
    </div>
  </div>
</template>

<style>
.app {
  display: flex;
  min-height: 100vh;
}
.content {
  flex: 1;
  padding: 20px;
  background: #f6f7fb;
}
</style>
