<template>
  <div>
    <h2>Список договоров</h2>
    <button class="add-btn" @click="showAddModal = true">Добавить договор</button>

    <AddContractModal
      v-if="showAddModal"
      :usersList="usersList"
      :branchesList="branchesList"
      @close="showAddModal = false"
      @contract-added="handleContractAdded"
    />

    <div v-if="loading" class="loading-indicator">
      <span class="spinner"></span> Загрузка списка договоров...
    </div>

    <div v-if="error" class="error-container">
      <p class="error-message">{{ error }}</p>
      <p class="error-details" v-if="errorDetails">Техническая информация: {{ errorDetails }}</p>
      <button @click="fetchContracts" class="retry-button">Попробовать снова</button>
    </div>

    <div class="filters-group" v-if="!loading && !error && contracts.length > 0">
      <div class="filter-container" v-if="usersList.length > 1">
        <label for="user-filter">Фильтр по пользователю: </label>
        <select id="user-filter" v-model="selectedUser">
          <option v-for="user in usersList" :key="user" :value="user">{{ user }}</option>
        </select>
      </div>
      <div class="filter-container" v-if="branchesList.length > 1">
        <label for="branch-filter">Фильтр по филиалу: </label>
        <select id="branch-filter" v-model="selectedBranch">
          <option v-for="branch in branchesList" :key="branch" :value="branch">{{ branch }}</option>
        </select>
      </div>
    </div>

    <DataTableRed
      v-if="!loading && !error"
      :tableData="filteredContracts"
      :tableColumns="columns"
      initialSortKey="Код"
      initialSortOrder="asc"
      @sort-changed="onSortChanged"
      @action-triggered="handleOpenContractModal"
    />

    <ContractDetailsModal
      ref="detailsModalRef"
      :visible="isModalVisible"
      :loading="modalLoading"
      :error="modalError"
      :errorDetails="modalErrorDetails"
      :contractData="modalContractData"
      :contractRaw="modalContractDetailsRaw"
      :formatDate="formatDate"
      :formatDateTime="formatDateTime"
      :formatCurrency="formatCurrency"
      :autoEdit="autoEditMode"
      @close="closeModal"
      @retry="retryFetchContractDetails"
    />
  </div>
</template>

<script>
import { ref, onMounted, computed, nextTick } from 'vue';
import DataTableRed from '@/components/DataTableRed.vue';
import ContractDetailsModal from '@/components/ContractDetailsModal.vue';
import AddContractModal from '@/components/AddContractModal.vue';
import http from '@/api/http';

export default {
  components: { DataTableRed, ContractDetailsModal, AddContractModal },
  setup() {
    const columns = ref([
      { key: 'Код', label: 'Код' },
      { key: 'Номер_Договора', label: 'Номер договора' },
      { key: 'Дата_Подписания', label: 'Дата подписания' },
      { key: 'Пользователь', label: 'Пользователь' },
      { key: 'ФИО', label: 'ФИО ученика' },
      { key: 'Филиал', label: 'Филиал' },
      { key: 'actions', label: 'Действия' }
    ]);

    const contracts = ref([]);
    const loading = ref(true);
    const error = ref(null);
    const errorDetails = ref(null);

    const selectedUser = ref('Все');
    const usersList = ref(['Все']);
    const selectedBranch = ref('Все');
    const branchesList = ref(['Все']);

    const showAddModal = ref(false);

    const isModalVisible = ref(false);
    const modalLoading = ref(false);
    const modalError = ref(null);
    const modalErrorDetails = ref(null);
    const modalContractDetailsRaw = ref(null);
    const currentContractNumber = ref(null);

    const autoEditMode = ref(false);
    const detailsModalRef = ref(null);

    const modalContractData = computed(() => modalContractDetailsRaw.value?.договор || null);

    const formatDate = (dateStr) => {
      if (!dateStr || dateStr === '0001-01-01T00:00:00' || dateStr === '0001-01-01') return 'Не указана';
      try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) {
          const parts = dateStr.split('.');
          if (parts.length === 3) {
            const iso = `${parts[2]}-${parts[1]}-${parts[0]}`;
            const parsed = new Date(iso);
            return isNaN(parsed.getTime()) ? dateStr : parsed.toLocaleDateString('ru-RU');
          }
          return dateStr;
        }
        return d.toLocaleDateString('ru-RU');
      } catch { return dateStr; }
    };

    const formatDateTime = (dateTimeStr) => {
      if (!dateTimeStr) return 'Неизвестно';
      try {
        const d = new Date(dateTimeStr);
        return isNaN(d.getTime()) ? dateTimeStr : d.toLocaleString('ru-RU');
      } catch { return dateTimeStr; }
    };

    const formatCurrency = (value) => {
      if (typeof value !== 'number') return value;
      return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 2 }).format(value);
    };

    const fetchContracts = async () => {
      try {
        loading.value = true;
        error.value = null;
        errorDetails.value = null;
        contracts.value = [];
        usersList.value = ['Все'];
        branchesList.value = ['Все'];
        selectedUser.value = 'Все';
        selectedBranch.value = 'Все';

        const { data } = await http.get('/RCDO/hs/rcdo/ucenicidogovora');
        if (data && Array.isArray(data.договоры)) {
          const uniqueUsers = new Set();
          const uniqueBranches = new Set();

          contracts.value = data.договоры.map(contract => {
            if (contract?.Пользователь) uniqueUsers.add(contract.Пользователь.trim());
            if (contract?.Филиал) uniqueBranches.add(contract.Филиал.trim());
            return {
              ...contract,
              Дата_Подписания: formatDate(contract.Дата_Подписания),
              Пользователь: contract.Пользователь ? contract.Пользователь.trim() : 'Не указан',
              Филиал: contract.Филиал ? contract.Филиал.trim() : 'Не указан'
            };
          });

          usersList.value = ['Все', ...Array.from(uniqueUsers).sort()];
          branchesList.value = ['Все', ...Array.from(uniqueBranches).sort()];
        } else {
          throw new Error('Некорректный формат данных в ответе сервера (список договоров)');
        }
      } catch (err) {
        if (err.response) {
          error.value = `Ошибка сервера: ${err.response.status}`;
          errorDetails.value = `Сервер вернул: ${JSON.stringify(err.response.data)}`;
        } else if (err.request) {
          error.value = 'Сервер списка договоров не отвечает';
          errorDetails.value = 'Проверьте доступность сервера и сетевое соединение';
        } else if (err.code === 'ECONNABORTED') {
          error.value = 'Таймаут загрузки списка договоров';
          errorDetails.value = 'Сервер не ответил за установленное время.';
        } else {
          error.value = 'Не удалось загрузить список договоров.';
          errorDetails.value = err.message;
        }
      } finally {
        loading.value = false;
      }
    };

    const handleContractAdded = async (createdNumber) => {
      showAddModal.value = false;
      await fetchContracts();
      if (createdNumber) {
        await nextTick();
        isModalVisible.value = true;
        autoEditMode.value = true;
        fetchContractDetails(createdNumber);
      }
    };

    const fetchContractDetails = async (contractNumber) => {
      if (!contractNumber) {
        modalError.value = "Не передан номер договора";
        return;
      }
      modalLoading.value = true;
      modalError.value = null;
      modalErrorDetails.value = null;
      modalContractDetailsRaw.value = null;
      currentContractNumber.value = contractNumber;

      try {
        const { data, status } = await http.get('/RCDO/hs/rcdo/Dogovor', { params: { nomer: contractNumber } });
        if (status === 200 && data && typeof data.договор === 'object') {
          modalContractDetailsRaw.value = data;
        } else {
          throw new Error(`Некорректный формат данных в ответе сервера (детали договора). Статус: ${status}`);
        }
      } catch (err) {
        modalContractDetailsRaw.value = null;
        if (err.response) {
          modalError.value = `Ошибка сервера: ${err.response.status}`;
          modalErrorDetails.value = `Сервер вернул: ${JSON.stringify(err.response.data)}`;
        } else if (err.request) {
          modalError.value = 'Сервер деталей договора не отвечает';
          modalErrorDetails.value = 'Проверьте доступность сервера 1С по IP-адресу и сетевое соединение. Возможна проблема CORS.';
        } else if (err.code === 'ECONNABORTED') {
          modalError.value = 'Таймаут загрузки деталей договора';
          modalErrorDetails.value = 'Сервер не ответил за установленное время.';
        } else {
          modalError.value = 'Не удалось загрузить детали договора.';
          modalErrorDetails.value = err.message;
        }
      } finally {
        modalLoading.value = false;
      }
    };

    const handleOpenContractModal = (contractRow) => {
      if (contractRow && contractRow.Номер_Договора) {
        isModalVisible.value = true;
        autoEditMode.value = false;
        fetchContractDetails(contractRow.Номер_Договора);
      } else {
        alert("Ошибка: Не удалось определить номер договора для открытия деталей.");
      }
    };

    const closeModal = () => {
      isModalVisible.value = false;
      modalLoading.value = false;
      modalError.value = null;
      modalErrorDetails.value = null;
      modalContractDetailsRaw.value = null;
      currentContractNumber.value = null;
      autoEditMode.value = false;
    };

    const retryFetchContractDetails = () => {
      if (currentContractNumber.value) fetchContractDetails(currentContractNumber.value);
    };

    const filteredContracts = computed(() => {
      return contracts.value.filter(contract => {
        const passUserFilter = selectedUser.value === 'Все' || contract.Пользователь === selectedUser.value;
        const passBranchFilter = selectedBranch.value === 'Все' || contract.Филиал === selectedBranch.value;
        return passUserFilter && passBranchFilter;
      });
    });

    onMounted(fetchContracts);

    const onSortChanged = () => {};

    return {
      columns, contracts, loading, error, errorDetails, fetchContracts, onSortChanged,
      selectedUser, usersList, selectedBranch, branchesList, filteredContracts,
      showAddModal, handleContractAdded,
      isModalVisible, modalLoading, modalError, modalErrorDetails, modalContractData, modalContractDetailsRaw,
      handleOpenContractModal, closeModal, retryFetchContractDetails,
      formatDate, formatDateTime, formatCurrency, autoEditMode, detailsModalRef
    };
  }
}
</script>



<style scoped>
/* --- Стили для модального окна --- */
.add-btn {
  background: #2196f3;
  color: #fff;
  border: none;
  padding: 8px 18px;
  border-radius: 4px;
  font-size: 15px;
  cursor: pointer;
  margin-bottom: 18px;
  transition: background 0.17s;
}
.add-btn:hover {
  background: #167ee6;
}
/* --- Стили для модального окна --- */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.6); /* Полупрозрачный фон */
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000; /* Поверх остального контента */
  padding: 20px; /* Отступы для маленьких экранов */
  box-sizing: border-box;
}

.modal-content {
  background-color: white;
  padding: 25px 30px;
  border-radius: 8px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
  position: relative;
  max-width: 800px; /* Максимальная ширина */
  width: 90%; /* Ширина на больших экранах */
  max-height: 90vh; /* Максимальная высота */
  overflow-y: auto; /* Прокрутка, если контент не влезает */
}

.modal-close-button {
  position: absolute;
  top: 10px;
  right: 15px;
  background: none;
  border: none;
  font-size: 28px;
  line-height: 1;
  cursor: pointer;
  color: #888;
  padding: 0;
}
.modal-close-button:hover {
    color: #333;
}

.modal-content h3 {
  margin-top: 0;
  margin-bottom: 20px;
  color: #333;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
}

.contract-details p {
  margin: 8px 0;
  line-height: 1.6;
}

.contract-details strong {
  color: #555;
}

.contract-details h4 {
    margin-top: 25px;
    margin-bottom: 10px;
    color: #333;
    border-bottom: 1px solid #eee;
    padding-bottom: 5px;
}

.equipment-list table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 10px;
}

.equipment-list th,
.equipment-list td {
    border: 1px solid #ddd;
    padding: 8px 10px;
    text-align: left;
    font-size: 14px;
}

.equipment-list th {
    background-color: #f8f9fa;
    font-weight: bold;
}
.equipment-list tbody tr:nth-child(even) {
    background-color: #f9f9f9;
}
.equipment-list tfoot td {
    border-top: 2px solid #ccc;
}


.modal-loading {
    margin: 30px 0;
    text-align: center;
}
.modal-error {
    margin: 20px 0;
}

/* Адаптация кнопки Попробовать снова для модалки */
.modal-error .retry-button {
    margin-top: 10px;
}

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

/* Стили для группы фильтров */
.filters-group {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
  margin-bottom: 20px;
}

/* Стили для фильтров */
.filter-container {
  padding: 10px;
  background-color: #e9ecef;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 250px;
}

.filter-container label {
  font-weight: bold;
  color: #495057;
  white-space: nowrap;
}

.filter-container select {
  padding: 5px 8px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  flex: 1;
  min-width: 150px;
}
</style>