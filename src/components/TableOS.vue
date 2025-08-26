<template>
  <div>
    <h2>Список основных средств</h2>

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
      :tableData="filteredOsItemsWithIndex"
      :tableColumns="columns"
      initialSortKey="ИнвентарныйНомер"
      initialSortOrder="asc"
      @row-click="handleRowClick"
    />

    <OSDetailsModal
      v-if="showModal"
      :osData="selectedOS"
      :dogovorData="selectedDogovor"
      :dogovorLoading="dogovorLoading"
      @close="closeModal"
      @inoe-updated="handleInoeUpdated"
    />
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue';
import DataTable from '@/components/DataTable.vue';
import OSDetailsModal from '@/components/OSDetailsModal.vue';
import http from '@/api/http';

export default {
  components: { DataTable, OSDetailsModal },
  setup() {
    const columns = ref([
      { key: 'Index', label: '№' },
      { key: 'НаименованиеОС', label: 'НаименованиеОС' },
      { key: 'ИнвентарныйНомер', label: 'Инвентарный номер' },
      { key: 'СтоимостьПоследняя', label: 'Стоимость' },
      { key: 'МатериальноОтветственный', label: 'Ответственный' },
      { key: 'Филиал', label: 'Филиал' },
      { key: 'Местонахождение', label: 'Местонахождение' }
    ]);

    const osItems = ref([]);
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
        const filialy = (typeof data === 'string') ? JSON.parse(data).filialy : data.filialy;
        filialyData.value = filialy || [];
      } catch {
        filialyData.value = [];
      }
    };

    const fetchOS = async () => {
      try {
        loading.value = true;
        error.value = null;
        errorDetails.value = null;
        osItems.value = [];
        responsiblePersonsList.value = ['Все'];
        filialList.value = ['Все'];
        selectedResponsiblePerson.value = 'Все';
        selectedFilial.value = 'Все';

        const { data: respRaw } = await http.get('/RCDO/hs/rcdo/OS');
        const responseData = typeof respRaw === 'string' ? JSON.parse(respRaw) : respRaw;

        if (responseData && typeof responseData === 'object' && Array.isArray(responseData.osnovnye_sredstva)) {
          const dataArray = responseData.osnovnye_sredstva;
          const uniqueResponsible = new Set();
          const uniqueFilials = new Set();

          const resolveFilial = (otvetstvenny) => {
            for (const f of filialyData.value) {
              if (f.МОЛы && Array.isArray(f.МОЛы) && f.МОЛы.some(mol => mol.МОЛ && mol.МОЛ.trim() === otvetstvenny)) {
                return f.Наименование || f.НаименованиеФилиала || 'Неизвестно';
              }
            }
            return 'Неизвестно';
          };

          osItems.value = dataArray.map(item => {
            const responsible = item.МатериальноОтветственный ? item.МатериальноОтветственный.trim() : 'Не указан';
            const filial = resolveFilial(responsible);

            uniqueResponsible.add(responsible);
            uniqueFilials.add(filial);

            let mesto = '—';
            if (item.Договор && String(item.Договор).trim() !== '' && String(item.Договор) !== '0') {
              mesto = `Договор №${item.Договор}`;
            } else if (item.ИноеМестоНахождения && String(item.ИноеМестоНахождения).trim() !== '') {
              mesto = item.ИноеМестоНахождения;
            }

            const noDogovor = !item.Договор || Number(item.Договор) === 0;
            const noInoe = !item.ИноеМестоНахождения || String(item.ИноеМестоНахождения).trim() === '';
            const rowClass = (noDogovor && noInoe) ? 'os-missing-row' : '';

            return {
              ...item,
              НаименованиеОС: item.НаименованиеОС ? item.НаименованиеОС.trim() : (item.Наименование ? item.Наименование.trim() : 'Без наименования'),
              ИнвентарныйНомер: item.ИнвентарныйНомер || 'Нет номера',
              СтоимостьПоследняя: new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 2 }).format(item.СтоимостьПоследняя || 0),
              МатериальноОтветственный: responsible,
              Филиал: filial,
              Местонахождение: mesto,
              rowClass
            };
          });

          responsiblePersonsList.value = ['Все', ...Array.from(uniqueResponsible).sort()];
          filialList.value = ['Все', ...Array.from(uniqueFilials).sort()];
        } else {
          throw new Error('Некорректная структура данных в ответе сервера (ожидался объект с массивом "osnovnye_sredstva")');
        }
      } catch (err) {
        if (err.response) {
          error.value = `Ошибка сервера: ${err.response.status}`;
          let details = '';
          try {
            details = typeof err.response.data === 'object' ? JSON.stringify(err.response.data) : String(err.response.data);
          } catch { details = 'Не удалось обработать ответ сервера'; }
          errorDetails.value = `Сервер вернул: ${details}`;
        } else if (err.code === 'ECONNABORTED' || (err.message && err.message.toLowerCase().includes('timeout'))) {
          error.value = 'Превышено время ожидания ответа от сервера';
          errorDetails.value = 'Сервер не успел обработать запрос в установленное время (таймаут). Возможно, сервер 1С перегружен, выполняется долгий запрос или недоступен.';
        } else if (err.request) {
          error.value = 'Сервер не отвечает или ошибка сети';
          errorDetails.value = 'Не удалось получить ответ от сервера. Проверьте доступность сервера 1С, сетевое соединение и настройки прокси (если используется). Ошибка: ' + (err.message || 'Нет ответа');
        } else if (err.message && err.message.includes('Network Error')) {
          error.value = 'Ошибка сети или CORS';
          errorDetails.value = 'Не удалось выполнить запрос из-за сетевой проблемы или ограничений CORS. Проверьте настройки CORS на сервере 1С и сетевую доступность.';
        } else {
          error.value = err.message || 'Не удалось загрузить данные';
          errorDetails.value = err.message ? `Техническая информация: ${err.message}` : 'Неизвестная ошибка';
        }
      } finally {
        loading.value = false;
      }
    };

    const fetchAll = async () => { loading.value = true; await fetchFilialy(); await fetchOS(); };
    onMounted(fetchAll);

    const filteredOsItems = computed(() => {
      return osItems.value.filter(item => {
        const byResp = selectedResponsiblePerson.value === 'Все' || item.МатериальноОтветственный === selectedResponsiblePerson.value;
        const byFilial = selectedFilial.value === 'Все' || item.Филиал === selectedFilial.value;
        return byResp && byFilial;
      });
    });

    const filteredOsItemsWithIndex = computed(() => filteredOsItems.value.map((item, idx) => ({ ...item, Index: idx + 1 })));

    const showModal = ref(false);
    const selectedOS = ref(null);
    const selectedDogovor = ref(null);
    const dogovorLoading = ref(false);

    const handleRowClick = async (row) => {
      selectedOS.value = row;
      showModal.value = true;
      selectedDogovor.value = null;

      if (!row.Договор || Number(row.Договор) === 0) return;

      dogovorLoading.value = true;
      try {
        const { data } = await http.get('/RCDO/hs/rcdo/ucenicidogovora');
        const parsed = (typeof data === 'string') ? JSON.parse(data) : data;
        const dogovoraArr = Array.isArray(parsed.договоры) ? parsed.договоры : [];
        selectedDogovor.value = dogovoraArr.find(d => String(d.Номер_Договора) === String(row.Договор)) || null;
      } catch {
        selectedDogovor.value = null;
      } finally {
        dogovorLoading.value = false;
      }
    };

    const handleInoeUpdated = ({ Код, ИноеМестоНахождения }) => {
      const idx = osItems.value.findIndex(os => os.Код === Код);
      if (idx !== -1) {
        osItems.value[idx].ИноеМестоНахождения = ИноеМестоНахождения;
        let mesto = '—';
        if (osItems.value[idx].Договор && String(osItems.value[idx].Договор).trim() !== '' && String(osItems.value[idx].Договор) !== '0') {
          mesto = `Договор №${osItems.value[idx].Договор}`;
        } else if (ИноеМестоНахождения && String(ИноеМестоНахождения).trim() !== '') {
          mesto = ИноеМестоНахождения;
        }
        osItems.value[idx].Местонахождение = mesto;

        const noDogovor = !osItems.value[idx].Договор || Number(osItems.value[idx].Договор) === 0;
        const noInoe = !ИноеМестоНахождения || String(ИноеМестоНахождения).trim() === '';
        osItems.value[idx].rowClass = (noDogovor && noInoe) ? 'os-missing-row' : '';
        if (selectedOS.value && selectedOS.value.Код === Код) {
          selectedOS.value.ИноеМестоНахождения = ИноеМестоНахождения;
          selectedOS.value.rowClass = osItems.value[idx].rowClass;
          selectedOS.value.Местонахождение = mesto;
        }
      }
    };

    const closeModal = () => { showModal.value = false; };

    return {
      columns, loading, error, errorDetails, fetchAll,
      selectedResponsiblePerson, responsiblePersonsList, selectedFilial, filialList,
      filteredOsItemsWithIndex, showModal, selectedOS, selectedDogovor, handleRowClick, closeModal, dogovorLoading, handleInoeUpdated
    };
  }
};
</script>


<style scoped>
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
  white-space: pre-wrap;
  word-break: break-all;
  margin-bottom: 15px;
  padding: 10px;
  background: rgba(0,0,0,0.05);
  border-radius: 3px;
  max-height: 200px;
  overflow-y: auto;
}
.retry-button {
  background-color: #007bff;
  color: white;
  border: none;
  padding: 8px 15px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}
.retry-button:hover {
  background-color: #0056b3;
}
.filter-row {
  display: flex;
  gap: 30px;
  align-items: center;
  margin-bottom: 15px;
  padding: 10px;
  background-color: #e9ecef;
  border-radius: 4px;
}
.filter-inline {
  display: flex;
  align-items: center;
  gap: 10px;
}
.filter-inline label {
  font-weight: bold;
  color: #495057;
}
.filter-inline select {
  padding: 5px 8px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  min-width: 180px;
}
h2 {
  margin-bottom: 20px;
  color: #333;
}
.os-missing-row {
  background-color: #ffe0e6 !important;
}
</style>
