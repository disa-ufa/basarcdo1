<template>
  <div>
    <h2>Список материальных запасов (хозрасчетные)</h2>

    <div v-if="loading" class="loading-indicator">
      <span class="spinner"></span> Загрузка данных...
    </div>

    <div v-if="error" class="error-container">
      <p class="error-message">{{ error }}</p>
      <p class="error-details" v-if="errorDetails">Техническая информация: {{ errorDetails }}</p>
      <button @click="fetchMZ" class="retry-button">Попробовать снова</button>
    </div>

    <div class="filter-container" v-if="!loading && !error && responsiblePersonsList.length > 1">
      <label for="responsible-filter">Фильтр по ответственному: </label>
      <select id="responsible-filter" v-model="selectedResponsiblePerson">
        <option v-for="person in responsiblePersonsList" :key="person" :value="person">{{ person }}</option>
      </select>
    </div>

    <DataTable
      v-if="!loading && !error"
      :tableData="filteredMzItems"
      :tableColumns="columns"
      initialSortKey="НаименованиеМЗ"
      initialSortOrder="asc"
      @sort-changed="onSortChanged"
    />
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue';
import DataTable from '@/components/DataTable.vue';
import http from '@/api/http';

export default {
  components: { DataTable },
  setup() {
    const columns = ref([
      { key: 'НаименованиеМЗ', label: 'Наименование МЗ' },
      { key: 'СтоимостьПоследняя', label: 'Стоимость' },
      { key: 'Количество', label: 'Количество' },
      { key: 'МатериальноОтветственный', label: 'Ответственный' }
    ]);

    const mzItems = ref([]);
    const loading = ref(true);
    const error = ref(null);
    const errorDetails = ref(null);

    const selectedResponsiblePerson = ref('Все');
    const responsiblePersonsList = ref(['Все']);

    const fetchMZ = async () => {
      try {
        loading.value = true; error.value = null; errorDetails.value = null;
        mzItems.value = []; responsiblePersonsList.value = ['Все']; selectedResponsiblePerson.value = 'Все';

        const { data } = await http.get('/RCDO/hs/rcdo/MZ');
        let responseData = (typeof data === 'string') ? JSON.parse(data) : data;

        if (responseData && Array.isArray(responseData.materialnye_zapasy)) {
          const dataArray = responseData.materialnye_zapasy.filter(item => item && item.Хоз === true);

          const uniqueResponsible = new Set();
          dataArray.forEach(item => {
            if (item?.МатериальноОтветственный) uniqueResponsible.add(item.МатериальноОтветственный.trim());
          });
          responsiblePersonsList.value = ['Все', ...Array.from(uniqueResponsible).sort()];

          mzItems.value = dataArray.map(item => {
            const responsible = item.МатериальноОтветственный ? item.МатериальноОтветственный.trim() : 'Не указан';
            return {
              ...item,
              НаименованиеМЗ: item.НаименованиеМЗ ? item.НаименованиеМЗ.trim() : (item.Наименование ? item.Наименование.trim() : 'Без наименования'),
              СтоимостьПоследняя: new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 2 }).format(item.СтоимостьПоследняя || 0),
              Количество: item.Количество ?? 0,
              МатериальноОтветственный: responsible
            };
          });
        } else {
          throw new Error('Некорректная структура данных в ответе сервера (ожидался объект с массивом "materialnye_zapasy")');
        }
      } catch (err) {
        if (err.response) {
          error.value = `Ошибка сервера: ${err.response.status}`;
          let details = '';
          try { details = typeof err.response.data === 'object' ? JSON.stringify(err.response.data) : String(err.response.data); }
          catch { details = 'Не удалось обработать ответ сервера'; }
          errorDetails.value = `Сервер вернул: ${details}`;
        } else if (err.code === 'ECONNABORTED' || (err.message && err.message.toLowerCase().includes('timeout'))) {
          error.value = 'Превышено время ожидания ответа от сервера';
          errorDetails.value = 'Сервер не успел обработать запрос в установленное время (таймаут).';
        } else if (err.request) {
          error.value = 'Сервер не отвечает или ошибка сети';
          errorDetails.value = 'Не удалось получить ответ от сервера. Проверьте доступность сервера и соединение.';
        } else if (err.message && err.message.includes('Network Error')) {
          error.value = 'Ошибка сети или CORS';
          errorDetails.value = 'Не удалось выполнить запрос из-за сетевой проблемы или ограничений CORS.';
        } else {
          error.value = err.message || 'Не удалось загрузить данные';
          errorDetails.value = err.message ? `Техническая информация: ${err.message}` : 'Неизвестная ошибка';
        }
      } finally { loading.value = false; }
    };

    onMounted(fetchMZ);

    const filteredMzItems = computed(() => {
      if (selectedResponsiblePerson.value === 'Все') return mzItems.value;
      return mzItems.value.filter(item => item.МатериальноОтветственный === selectedResponsiblePerson.value);
    });

    const onSortChanged = (sortInfo) => { console.log('Изменена сортировка (передано из DataTable):', sortInfo); };

    return { columns, loading, error, errorDetails, fetchMZ, onSortChanged, selectedResponsiblePerson, responsiblePersonsList, filteredMzItems };
  }
}
</script>



<style scoped>
/* Стили индикатора загрузки, ошибок и кнопки */
.loading-indicator {
  text-align: center;
  padding: 20px;
  color: #666;
}

.spinner {
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 3px solid rgba(0, 0, 0, 0.1);
  border-radius: 50%;
  border-top-color: #3498db;
  animation: spin 1s ease-in-out infinite;
  margin-right: 10px;
  vertical-align: middle; /* Выравнивание по вертикали */
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-container {
  margin: 20px 0;
  padding: 15px;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
  background-color: #f8d7da;
  color: #721c24;
}

.error-message {
  font-weight: bold;
  margin-bottom: 10px;
}

.error-details {
  font-family: monospace;
  white-space: pre-wrap; /* Сохраняет пробелы и переносы */
  word-break: break-all; /* Переносит длинные строки без пробелов */
  margin-bottom: 15px;
  padding: 10px;
  background: rgba(0,0,0,0.05);
  border-radius: 3px;
  max-height: 200px; /* Ограничение высоты для длинных сообщений */
  overflow-y: auto; /* Добавление прокрутки при необходимости */
}

.retry-button {
  background-color: #007bff; /* Синий цвет для кнопки */
  color: white;
  border: none;
  padding: 8px 15px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}

.retry-button:hover {
  background-color: #0056b3; /* Более темный синий при наведении */
}

/* --- Стили для фильтра --- */
.filter-container {
  margin-bottom: 15px;
  padding: 10px;
  background-color: #e9ecef;
  border-radius: 4px;
  display: flex; /* Используем flex для выравнивания */
  align-items: center; /* Выравниваем элементы по центру по вертикали */
  gap: 10px; /* Пространство между label и select */
}

.filter-container label {
  font-weight: bold;
  color: #495057;
}

.filter-container select {
  padding: 5px 8px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  min-width: 200px; /* Минимальная ширина для удобства */
}

/* Стили для заголовка (если нужны) */
h2 {
  margin-bottom: 20px;
  color: #333;
}
</style>