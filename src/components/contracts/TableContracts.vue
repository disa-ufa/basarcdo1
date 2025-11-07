<!-- src/components/contracts/TableContracts.vue -->
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
      <p class="error-details" v-if="errorDetails">
        Техническая информация: {{ errorDetails }}
      </p>
      <button @click="fetchContracts" class="retry-button">Попробовать снова</button>
    </div>

    <div class="filters-group" v-if="!loading && !error && contracts.length > 0">
      <div class="filter-container" v-if="usersList.length > 1">
        <label for="user-filter">Фильтр по пользователю:</label>
        <select id="user-filter" v-model="selectedUser">
          <option v-for="user in usersList" :key="user" :value="user">{{ user }}</option>
        </select>
      </div>

      <div class="filter-container" v-if="branchesList.length > 1">
        <label for="branch-filter">Фильтр по филиалу:</label>
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
      :show="isModalVisible"
      :contract="currentContract"
      :nomer="currentContractNumber"
      @close="closeModal"
    />
  </div>
</template>

<script>
import { ref, onMounted, computed, nextTick } from 'vue';
import DataTableRed from '@/components/shared/DataTableRed.vue';           // ✅ правильный путь
import ContractDetailsModal from './ContractDetailsModal.vue';      // относительный импорт
import AddContractModal from './AddContractModal.vue';              // относительный импорт
import http from '@/api/http';

export default {
  name: 'TableContracts',
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
    const currentContractNumber = ref(null);
    const currentContract = ref(null);

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
      } catch {
        return dateStr;
      }
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

          contracts.value = data.договоры.map((c) => {
            if (c?.Пользователь) uniqueUsers.add(c.Пользователь.trim());
            if (c?.Филиал) uniqueBranches.add(c.Филиал.trim());
            return {
              ...c,
              Дата_Подписания: formatDate(c.Дата_Подписания),
              Пользователь: c.Пользователь ? c.Пользователь.trim() : 'Не указан',
              Филиал: c.Филиал ? c.Филиал.trim() : 'Не указан'
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
          errorDetails.value = 'Сервер не ответил за установленное время';
        } else {
          error.value = 'Не удалось загрузить список договоров';
          errorDetails.value = err.message;
        }
      } finally {
        loading.value = false;
      }
    };

    const handleContractAdded = async (created) => {
      showAddModal.value = false;
      await fetchContracts();

      const num =
        created?.договор?.Номер_Договора ??
        created?.договор?.Номер ??
        created?.Номер_Договора ??
        created?.Номер ??
        '';

      if (num) {
        await nextTick();
        currentContractNumber.value = String(num);
        currentContract.value = null;
        isModalVisible.value = true;
      }
    };

    const handleOpenContractModal = (row) => {
      if (row && row.Номер_Договора) {
        currentContract.value = row;
        currentContractNumber.value = String(row.Номер_Договора);
        isModalVisible.value = true;
      } else {
        alert('Ошибка: не удалось определить номер договора.');
      }
    };

    const closeModal = () => {
      isModalVisible.value = false;
      currentContractNumber.value = null;
      currentContract.value = null;
    };

    const filteredContracts = computed(() => {
      return contracts.value.filter((c) => {
        const okUser = selectedUser.value === 'Все' || c.Пользователь === selectedUser.value;
        const okBranch = selectedBranch.value === 'Все' || c.Филиал === selectedBranch.value;
        return okUser && okBranch;
      });
    });

    onMounted(fetchContracts);

    const onSortChanged = () => {};

    return {
      // state
      columns, contracts, loading, error, errorDetails,
      selectedUser, usersList, selectedBranch, branchesList,
      showAddModal,

      // computed
      filteredContracts,

      // modal
      isModalVisible, currentContractNumber, currentContract,

      // methods
      fetchContracts, handleContractAdded, handleOpenContractModal, closeModal, onSortChanged
    };
  }
};
</script>

<style scoped>
.add-btn { background:#2196f3; color:#fff; border:none; padding:8px 18px; border-radius:4px; font-size:15px; cursor:pointer; margin-bottom:18px; transition:background .17s }
.add-btn:hover { background:#167ee6 }

.error-container { margin:20px 0; padding:15px; background:#fff8f8; border-left:4px solid #ff5252; border-radius:4px }
.error-message { color:#d32f2f; margin-bottom:8px; font-weight:700 }
.error-details { color:#666; font-size:.9em; margin-bottom:15px }
.retry-button { background-color:#2196f3; color:#fff; border:none; padding:8px 16px; border-radius:4px; cursor:pointer; font-weight:700 }
.retry-button:hover { background-color:#0d8aee }

.loading-indicator { display:flex; align-items:center; margin:20px 0 }
.spinner { display:inline-block; width:20px; height:20px; margin-right:10px; border:3px solid rgba(0,0,0,.1); border-radius:50%; border-top-color:#2196f3; animation:spin 1s ease-in-out infinite }
@keyframes spin { to { transform: rotate(360deg) } }

.filters-group { display:flex; flex-wrap:wrap; gap:15px; margin-bottom:20px }
.filter-container { padding:10px; background:#e9ecef; border-radius:4px; display:flex; align-items:center; gap:10px; flex:1; min-width:250px }
.filter-container label { font-weight:700; color:#495057; white-space:nowrap }
.filter-container select { padding:5px 8px; border:1px solid #ced4da; border-radius:4px; flex:1; min-width:150px }
</style>
