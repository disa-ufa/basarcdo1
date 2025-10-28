<template>
  <div>
    <h2>Список материальных запасов (не хозрасчетные)</h2>

    <div v-if="loading" class="loading-indicator">
      <span class="spinner"></span> Загрузка данных...
    </div>

    <div v-if="error" class="error-container">
      <p class="error-message">{{ error }}</p>
      <p class="error-details" v-if="errorDetails">Техническая информация: {{ errorDetails }}</p>
      <button @click="fetchAll" class="retry-button">Попробовать снова</button>
    </div>

    <div class="filter-row" v-if="!loading && !error && (responsiblePersonsList.length > 1 || filialList.length > 1)">
      <div class="filter-inline">
        <label for="responsible-filter">Ответственный:</label>
        <select id="responsible-filter" v-model="selectedResponsiblePerson">
          <option v-for="person in responsiblePersonsList" :key="person" :value="person">{{ person }}</option>
        </select>
      </div>
      <div class="filter-inline">
        <label for="filial-filter">Филиал:</label>
        <select id="filial-filter" v-model="selectedFilial">
          <option v-for="filial in filialList" :key="filial" :value="filial">{{ filial }}</option>
        </select>
      </div>
    </div>

    <DataTable
      v-if="!loading && !error"
      :tableData="filteredMzItemsWithIndex"
      :tableColumns="columns"
      initialSortKey="НаименованиеМЗ"
      initialSortOrder="asc"
      @row-click="handleRowClick"
    />

    <MZDetailsModal v-if="showMZModal" :mzData="selectedMZ" @close="closeMZModal" />
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue';
import DataTable from '@/components/shared/DataTable.vue';
import MZDetailsModal from '@/components/equipment/mz/MZDetailsModal.vue';
import http from '@/api/http';

export default {
  components: { DataTable, MZDetailsModal },
  setup() {
    const columns = ref([
      { key: 'Index', label: '№' },
      { key: 'НаименованиеМЗ', label: 'Наименование МЗ' },
      { key: 'СтоимостьПоследняяStr', label: 'Стоимость' },
      { key: 'Количество', label: 'Количество' },
      { key: 'МатериальноОтветственный', label: 'Ответственный' },
      { key: 'ФилиалRaw', label: 'Филиал' }
    ]);

    const mzItems = ref([]);
    const filialyData = ref([]);
    const loading = ref(true);
    const error = ref(null);
    const errorDetails = ref(null);

    const selectedResponsiblePerson = ref('Все');
    const responsiblePersonsList = ref(['Все']);
    const selectedFilial = ref('Все');
    const filialList = ref(['Все']);

    const fetchFilialy = async () => {
      try {
        const { data } = await http.get('/RCDO/hs/rcdo/MOL');
        let parsed = typeof data === 'string' ? JSON.parse(data) : data;
        const filialy = parsed?.filialy ?? parsed?.Filialy ?? parsed?.filials ?? [];
        filialyData.value = Array.isArray(filialy) ? filialy : [];
      } catch { filialyData.value = []; }
    };

    function findFilialByMOL(mol) {
      if (!mol || !filialyData.value.length) return 'Неизвестно';
      for (const f of filialyData.value) {
        if (Array.isArray(f.МОЛы) &&
            f.МОЛы.some(molItem => typeof molItem.МОЛ === 'string' && molItem.МОЛ.trim() === mol.trim())) {
          return f.НаименованиеФилиала || f.Наименование || 'Неизвестно';
        }
      }
      return 'Неизвестно';
    }

    const fetchMZ = async () => {
      try {
        loading.value = true; error.value = null; errorDetails.value = null;
        mzItems.value = []; responsiblePersonsList.value = ['Все']; filialList.value = ['Все'];
        selectedResponsiblePerson.value = 'Все'; selectedFilial.value = 'Все';

        const { data } = await http.get('/RCDO/hs/rcdo/MZ');
        let responseData = (typeof data === 'string') ? JSON.parse(data) : data;

        if (responseData && Array.isArray(responseData.materialnye_zapasy)) {
          const dataArray = responseData.materialnye_zapasy.filter(item => item && item.Хоз === false);

          const uniqueResponsible = new Set();
          const uniqueFilials = new Set();

          mzItems.value = dataArray.map(item => {
            const responsible = item.МатериальноОтветственный ? item.МатериальноОтветственный.trim() : 'Не указан';
            const filial = findFilialByMOL(responsible);
            uniqueResponsible.add(responsible);
            uniqueFilials.add(filial);
            return {
              ...item,
              НаименованиеМЗ: item.НаименованиеМЗ ? item.НаименованиеМЗ.trim() : (item.Наименование ? item.Наименование.trim() : 'Без наименования'),
              СтоимостьПоследняяStr: new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 2 }).format(item.СтоимостьПоследняя || 0),
              Количество: item.Количество ?? 0,
              МатериальноОтветственный: responsible,
              ФилиалRaw: filial
            };
          });

          responsiblePersonsList.value = ['Все', ...Array.from(uniqueResponsible).sort()];
          filialList.value = ['Все', ...Array.from(uniqueFilials).sort()];
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

    const fetchAll = async () => { loading.value = true; await fetchFilialy(); await fetchMZ(); };
    onMounted(fetchAll);

    const filteredMzItems = computed(() => {
      return mzItems.value.filter(item => {
        const byResp = selectedResponsiblePerson.value === 'Все' || item.МатериальноОтветственный === selectedResponsiblePerson.value;
        const byFilial = selectedFilial.value === 'Все' || item.ФилиалRaw === selectedFilial.value; // <- фикс
        return byResp && byFilial;
      });
    });

    const filteredMzItemsWithIndex = computed(() => filteredMzItems.value.map((item, idx) => ({ ...item, Index: idx + 1 })));

    const showMZModal = ref(false);
    const selectedMZ = ref(null);
    const handleRowClick = (row) => { selectedMZ.value = row; showMZModal.value = true; };
    const closeMZModal = () => { showMZModal.value = false; selectedMZ.value = null; };

    return {
      columns, loading, error, errorDetails, fetchAll,
      selectedResponsiblePerson, responsiblePersonsList, selectedFilial, filialList,
      filteredMzItemsWithIndex, handleRowClick, showMZModal, selectedMZ, closeMZModal
    };
  }
}
</script>

<style scoped>
/* стили без изменений */
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
  vertical-align: middle;
}
@keyframes spin { to { transform: rotate(360deg); } }
.error-container { margin: 20px 0; padding: 15px; border: 1px solid #f5c6cb; border-radius: 4px; background-color: #f8d7da; color: #721c24; }
.error-message { font-weight: bold; margin-bottom: 10px; }
.error-details { font-family: monospace; white-space: pre-wrap; word-break: break-all; margin-bottom: 15px; padding: 10px; background: rgba(0,0,0,0.05); border-radius: 3px; max-height: 200px; overflow-y: auto; }
.retry-button { background-color: #007bff; color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer; font-weight: bold; }
.retry-button:hover { background-color: #0056b3; }
.filter-row { display: flex; gap: 30px; align-items: center; margin-bottom: 15px; padding: 10px; background-color: #e9ecef; border-radius: 4px; }
.filter-inline { display: flex; align-items: center; gap: 10px; }
.filter-inline label { font-weight: bold; color: #495057; }
.filter-inline select { padding: 5px 8px; border: 1px solid #ced4da; border-radius: 4px; min-width: 180px; }
h2 { margin-bottom: 20px; color: #333; }
</style>
