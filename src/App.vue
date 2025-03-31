<template>
   <div>
    <h2>Список учеников</h2>
    <DataTable
      :tableData="users"
      :tableColumns="columns"
      initialSortKey="id"
      initialSortOrder="asc"
      @sort-changed="onSortChanged"
    />
  </div> 
</template>

<script>
import { ref } from 'vue';
import DataTable from '@/components/DataTable.vue';

export default {
  name: 'App',
  components: {
    DataTable
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