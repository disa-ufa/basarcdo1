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
import { ref } from 'vue'; // Добавьте этот импорт
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
      { key: 'age', label: 'Возраст' },
      { key: 'city', label: 'Город' }
    ]);
    
    const users = ref([
      { id: 1, name: 'Иван Иванов', email: 'ivan@example.com', age: 32, city: 'Москва' },
      { id: 2, name: 'Анна Смирнова', email: 'anna@example.com', age: 27, city: 'Санкт-Петербург' },
      { id: 3, name: 'Олег Петров', email: 'oleg@example.com', age: 41, city: 'Казань' },
      { id: 4, name: 'Мария Соколова', email: 'maria@example.com', age: 24, city: 'Екатеринбург' },
      { id: 5, name: 'Дмитрий Новиков', email: 'dmitry@example.com', age: 35, city: 'Новосибирск' }
    ]); 
    
    const onSortChanged = (sortInfo) => {
      console.log('Изменена сортировка:', sortInfo);
      // Здесь может быть логика для серверной сортировки, если необходимо
    };
    
    return {
      columns,
      users,
      onSortChanged
    };
  }
}
</script>

<style>

</style>
