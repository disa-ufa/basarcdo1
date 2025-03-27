<template>
  <div>
    <h2>Список учителей</h2>
    <DataTable
      :tableData="teachers"
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
  components: {
    DataTable
  },
  
  setup() {
    const columns = ref([
      { key: 'id', label: 'ID' },
      { key: 'name', label: 'Имя' },
      { key: 'email', label: 'Email' },
      { key: 'subject', label: 'Предмет' },
      { key: 'experience', label: 'Опыт работы' }
    ]);
    
    const teachers = ref([
      { id: 1, name: 'Елена Петрова', email: 'elena@school.ru', subject: 'Математика', experience: '8 лет' },
      { id: 2, name: 'Николай Сидоров', email: 'nikolay@school.ru', subject: 'Физика', experience: '12 лет' },
      { id: 3, name: 'Ольга Иванова', email: 'olga@school.ru', subject: 'Литература', experience: '5 лет' },
      { id: 4, name: 'Сергей Кузнецов', email: 'sergey@school.ru', subject: 'История', experience: '15 лет' },
      { id: 5, name: 'Анна Васильева', email: 'anna@school.ru', subject: 'Английский', experience: '7 лет' }
    ]); 
    
    const onSortChanged = (sortInfo) => {
      console.log('Изменена сортировка:', sortInfo);
    };
    
    return {
      columns,
      teachers,
      onSortChanged
    };
  }
}
</script>