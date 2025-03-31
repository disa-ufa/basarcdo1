<template>
  <div>
    <h2>Список учеников</h2>
    <div v-if="loading" class="loading-indicator">
      <span class="spinner"></span> Загрузка данных...
    </div>
    
    <div v-if="error" class="error-container">
      <p class="error-message">{{ error }}</p>
      <p class="error-details" v-if="errorDetails">Техническая информация: {{ errorDetails }}</p>
      <button @click="fetchStudents" class="retry-button">Попробовать снова</button>
    </div>
    
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
    const errorDetails = ref(null);
    
    // Функция для загрузки данных из 1С
    const fetchStudents = async () => {
      try {
        loading.value = true;
        error.value = null;
        errorDetails.value = null;
        
        // URL сервера 1С
        const apiUrl = await axios.get('/api/ucenici');
        console.log('Отправка запроса к:', apiUrl);
        
        const response = await axios.get(apiUrl, {
          // Таймаут запроса в миллисекундах
          timeout: 10000,
          
          // Заголовки авторизации (если требуются)
          // headers: {
          //   'Authorization': 'Basic ' + btoa('username:password')
          // }
        });
        
        console.log('Получен ответ:', response);
        
        // Проверка наличия и формата данных
        if (response.data && Array.isArray(response.data.ученики)) {
          students.value = response.data.ученики.map(student => {
            // Форматируем дату
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
          throw new Error('Некорректный формат данных в ответе сервера');
        }
      } catch (err) {
        console.error('Ошибка при загрузке данных:', err);
        
        // Детальная диагностика ошибки
        if (err.response) {
          // Сервер ответил с кодом ошибки
          error.value = `Ошибка сервера: ${err.response.status}`;
          errorDetails.value = `Сервер вернул: ${JSON.stringify(err.response.data)}`;
        } else if (err.request) {
          // Запрос был отправлен, но ответ не получен
          error.value = 'Сервер не отвечает';
          errorDetails.value = 'Проверьте доступность сервера 1С и сетевое соединение';
        } else if (err.message && err.message.includes('Network Error')) {
          // Ошибка CORS чаще всего
          error.value = 'Ошибка доступа к серверу';
          errorDetails.value = 'Возможная проблема с CORS. Требуется настройка сервера 1С.';
        } else {
          // Другие ошибки
          error.value = 'Не удалось загрузить данные. Пожалуйста, попробуйте позже.';
          errorDetails.value = err.message;
        }
      } finally {
        loading.value = false;
      }
    };
    
    // Загружаем данные при создании компонента
    onMounted(fetchStudents);
    
    const onSortChanged = (sortInfo) => {
      console.log('Изменена сортировка:', sortInfo);
    };
    
    return {
      columns,
      students,
      loading,
      error,
      errorDetails,
      fetchStudents,
      onSortChanged
    };
  }
}
</script>

<style scoped>
.error-container {
  margin: 20px 0;
  padding: 15px;
  background-color: #fff8f8;
  border-left: 4px solid #ff5252;
  border-radius: 4px;
}

.error-message {
  color: #d32f2f;
  margin-bottom: 8px;
  font-weight: bold;
}

.error-details {
  color: #666;
  font-size: 0.9em;
  margin-bottom: 15px;
}

.retry-button {
  background-color: #2196f3;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}

.retry-button:hover {
  background-color: #0d8aee;
}

.loading-indicator {
  display: flex;
  align-items: center;
  margin: 20px 0;
}

.spinner {
  display: inline-block;
  width: 20px;
  height: 20px;
  margin-right: 10px;
  border: 3px solid rgba(0, 0, 0, 0.1);
  border-radius: 50%;
  border-top-color: #2196f3;
  animation: spin 1s ease-in-out infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>