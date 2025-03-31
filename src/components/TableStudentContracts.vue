<template>
  <div>
    <h2>Договора учеников</h2>
    <DataTable
      :tableData="contracts"
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
      { key: 'student', label: 'Ученик' },
      { key: 'contractNumber', label: 'Номер договора' },
      { key: 'date', label: 'Дата заключения' },
      { key: 'amount', label: 'Сумма' },
      { key: 'status', label: 'Статус' }
    ]);
    
    const contracts = ref([
      { id: 1, student: 'Иван Иванов', contractNumber: 'ST-2023-001', date: '12.01.2023', amount: '45000 ₽', status: 'Активен' },
      { id: 2, student: 'Анна Смирнова', contractNumber: 'ST-2023-002', date: '15.01.2023', amount: '42000 ₽', status: 'Активен' },
      { id: 3, student: 'Олег Петров', contractNumber: 'ST-2023-003', date: '20.01.2023', amount: '48000 ₽', status: 'Приостановлен' },
      { id: 4, student: 'Мария Соколова', contractNumber: 'ST-2023-004', date: '01.02.2023', amount: '40000 ₽', status: 'Активен' },
      { id: 5, student: 'Дмитрий Новиков', contractNumber: 'ST-2023-005', date: '10.02.2023', amount: '46000 ₽', status: 'Завершен' }
    ]); 
    
    const onSortChanged = (sortInfo) => {
      console.log('Изменена сортировка:', sortInfo);
    };
    
    return {
      columns,
      contracts,
      onSortChanged
    };
  }
}
</script>