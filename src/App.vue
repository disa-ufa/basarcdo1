<template>
  <div class="app">
    <AppSidebar v-model="activeSection" />
    <div class="content">
      <h2>База РЦДО</h2>
      
      <!-- Динамическое отображение компонентов в зависимости от выбранного пункта меню -->
      <TableStudent v-if="activeSection === 'students'" />
      <TableTeachers v-if="activeSection === 'teachers'" />
      <TableStudentContracts v-if="activeSection === 'student-contracts'" />
      <TableTeacherContracts v-if="activeSection === 'teacher-contracts'" />
    </div>
  </div> 
</template>

<script>
import { ref } from 'vue';
import AppSidebar from './components/AppSidebar.vue';
import TableStudent from './components/TableStudent.vue';
import TableTeachers from './components/TableTeachers.vue';
import TableStudentContracts from './components/TableStudentContracts.vue';
import TableTeacherContracts from './components/TableTeacherContracts.vue';

export default {
  name: 'App',
  components: {
    AppSidebar ,
    TableStudent,
    TableTeachers,
    TableStudentContracts,
    TableTeacherContracts
  },
  setup() {
    const activeSection = ref('students');
    
    return {
      activeSection
    };
  }
}
</script>

<style>
body {
  margin: 0;
  padding: 0;
  font-family: Arial, sans-serif;
}

.app {
  display: flex;
  min-height: 100vh;
}
</style>