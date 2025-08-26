<template>
  <div>
    <h2>Список МОЛ по филиалам</h2>

    <div v-if="loading" class="loading-indicator">
      <span class="spinner"></span> Загрузка данных...
    </div>

    <div v-if="error" class="error-container">
      <p class="error-message">{{ error }}</p>
      <p class="error-details" v-if="errorDetails">Техническая информация: {{ errorDetails }}</p>
      <button @click="fetchMOL" class="retry-button">Попробовать снова</button>
    </div>

    <div class="filter-container" v-if="!loading && !error && filialList.length > 1">
      <label for="filial-filter">Фильтр по филиалу: </label>
      <select id="filial-filter" v-model="selectedFilial">
        <option v-for="filial in filialList" :key="filial" :value="filial">{{ filial }}</option>
      </select>
    </div>

    <DataTable
      v-if="!loading && !error"
      :tableData="filteredMOL"
      :tableColumns="columns"
      initialSortKey="Наименование"
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
      { key: 'Наименование', label: 'Филиал' },
      { key: 'Адрес', label: 'Адрес' },
      { key: 'Почта', label: 'Почта' },
      { key: 'Телефон', label: 'Телефон' },
      { key: 'МОЛыСписок', label: 'МОЛ(ы)' }
    ]);

    const molItems = ref([]);
    const loading = ref(true);
    const error = ref(null);
    const errorDetails = ref(null);

    const filialList = ref(['Все']);
    const selectedFilial = ref('Все');

    const fetchMOL = async () => {
      try {
        loading.value = true; error.value = null; errorDetails.value = null;
        molItems.value = []; filialList.value = ['Все']; selectedFilial.value = 'Все';

        const { data } = await http.get('/RCDO/hs/rcdo/MOL');
        let parsed = data;
        if (typeof parsed === 'string') parsed = JSON.parse(parsed);

        let array = Array.isArray(parsed) ? parsed : (parsed.filialy || parsed.Filialy || parsed.filials);
        if (!Array.isArray(array)) {
          throw new Error('Ожидался массив в ответе или в ключе filialy. Получено: ' + JSON.stringify(parsed));
        }

        const uniqueFilials = new Set();
        molItems.value = array.map(item => {
          uniqueFilials.add(item.Наименование);
          let molList = '';
          if (Array.isArray(item.МОЛы)) {
            molList = item.МОЛы.map(mol => mol.МОЛ).join(', ');
          }
          return { ...item, МОЛыСписок: molList };
        });

        filialList.value = ['Все', ...Array.from(uniqueFilials).sort()];
      } catch (err) {
        if (err.response) {
          error.value = `Ошибка сервера: ${err.response.status}`;
          errorDetails.value = typeof err.response.data === 'object' ? JSON.stringify(err.response.data) : String(err.response.data);
        } else if (err.code === 'ECONNABORTED' || (err.message && err.message.toLowerCase().includes('timeout'))) {
          error.value = 'Превышено время ожидания ответа от сервера';
          errorDetails.value = 'Сервер не ответил вовремя.';
        } else {
          error.value = err.message || 'Не удалось загрузить данные';
          errorDetails.value = err.message ? `Техническая информация: ${err.message}` : 'Неизвестная ошибка';
        }
      } finally { loading.value = false; }
    };

    onMounted(fetchMOL);

    const filteredMOL = computed(() => (selectedFilial.value === 'Все' ? molItems.value : molItems.value.filter(item => item.Наименование === selectedFilial.value)));

    const onSortChanged = (sortInfo) => { console.log('Изменена сортировка:', sortInfo); };

    return { columns, molItems, loading, error, errorDetails, fetchMOL, filialList, selectedFilial, filteredMOL, onSortChanged };
  }
};
</script>



<style scoped>
.loading-indicator, .error-container {
  margin-bottom: 15px;
  padding: 10px;
  border-radius: 4px;
}
.loading-indicator {
  background-color: #e0e0e0;
  display: flex;
  align-items: center;
}
.error-container {
  background-color: #f8d7da;
  border: 1px solid #f5c6cb;
  color: #721c24;
}
.error-message {
  font-weight: bold;
  margin-bottom: 5px;
}
.error-details {
  font-size: 0.9em;
  color: #58151c;
  word-break: break-all;
}
.retry-button {
  padding: 8px 15px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.retry-button:hover {
  background-color: #0056b3;
}
.spinner {
  display: inline-block;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: #333;
  width: 16px;
  height: 16px;
  animation: spin 1s ease-in-out infinite;
  margin-right: 8px;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
.filter-container {
  margin-bottom: 15px;
  padding: 10px;
  background-color: #e9ecef;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.filter-container label {
  font-weight: bold;
  color: #495057;
}
.filter-container select {
  padding: 5px 8px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  min-width: 200px;
}
h2 {
  margin-bottom: 20px;
  color: #333;
}
</style>
