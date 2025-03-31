<template>
  <div>
    <h2>Список учеников</h2>
    <p v-if="loading">Загрузка данных...</p>
    <p v-if="error" class="error-message">{{ error }}</p>
    <DataTable
      v-if="!loading && !error"
      :tableData="students"
      :tableColumns="columns"
      initialSortKey="Код"
      initialSortOrder="asc"
      @sort-changed="onSortChanged"
    />
  </div> 
</template>

<script>
import { ref, onMounted } from 'vue';
import DataTable from '@/components/DataTable.vue';
import axios from 'axios';

export default {
  components: {
    DataTable
  },
  
  setup() {
    const columns = ref([
      { key: 'Код', label: 'Код' },
      { key: 'Наименование', label: 'ФИО' },
      { key: 'Дата_Поступления', label: 'Дата поступления' },
      { key: 'Класс', label: 'Класс' },
      { key: 'Приказ_О_Зачислении', label: 'Приказ о зачислении' },
      { key: 'Обучение_Статус', label: 'Статус обучения' },
      { key: 'Адрес_Регистрации', label: 'Адрес регистрации' }
    ]);
    
    const students = ref([]);
    const loading = ref(true);
    const error = ref(null);
    
    // Функция для загрузки данных из 1С
    const fetchStudents = async () => {
      try {
        loading.value = true;
        error.value = null;
        
        const response = await axios.get('/api/ucenici', {
          // При необходимости добавьте заголовки для авторизации
          // headers: {
          //   'Authorization': 'Basic ' + btoa('username:password')
          // }
        });
        
        // Обработка полученных данных
        if (response.data && response.data.ученики) {
          students.value = response.data.ученики.map(student => {
            // Форматируем дату, чтобы она отображалась в удобном формате
            const dateStr = student.Дата_Поступления;
            let formattedDate = 'Не указана';
            
            if (dateStr && dateStr !== '0001-01-01T00:00:00') {
              const date = new Date(dateStr);
              formattedDate = date.toLocaleDateString('ru-RU');
            }
            
            // Преобразуем булево значение в текст
            const statusText = student.Обучение_Статус ? 'Активен' : 'Неактивен';
            
            return {
              ...student,
              Дата_Поступления: formattedDate,
              Обучение_Статус: statusText
            };
          });
          
          console.log('Загружено учеников:', students.value.length);
        } else {
          throw new Error('Некорректный формат данных');
        }
      } catch (err) {
        console.error('Ошибка при загрузке данных:', err);
        error.value = 'Не удалось загрузить данные. Пожалуйста, попробуйте позже.';
      } finally {
        loading.value = false;
      }
    };
    
    // Загружаем данные при создании компонента
    onMounted(fetchStudents);
    
    const onSortChanged = (sortInfo) => {
      console.log('Изменена сортировка:', sortInfo);
      // При необходимости можно реализовать повторную загрузку данных с сервера с сортировкой
    };
    
    return {
      columns,
      students,
      loading,
      error,
      onSortChanged
    };
  }
}
</script>

<style scoped>
.error-message {
  color: red;
  padding: 10px;
  background-color: #ffeeee;
  border-radius: 4px;
  margin-bottom: 10px;
}
</style>