<template>
  <div>
    <h2>Список договоров</h2>
    <button class="add-btn" @click="showAddModal = true">Добавить договор</button>

    <AddContractModal
      v-if="showAddModal"
      :usersList="filterUsersList"
      :branchesList="contractFormBranches"
      :lock-to-branch="!canEditOtherFilialData"
      :user-branch="userFilial"
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
      <div class="filter-container" v-if="filterUsersList.length > 1">
        <label for="user-filter">Фильтр по пользователю:</label>
        <select id="user-filter" v-model="selectedUser">
          <option v-for="user in filterUsersList" :key="user" :value="user">{{ user }}</option>
        </select>
      </div>

      <div class="filter-container" v-if="filterBranchesList.length > 0">
        <label for="branch-filter">Фильтр по филиалу:</label>
        <select
          id="branch-filter"
          v-model="selectedBranch"
          :disabled="!canEditOtherFilialData"
        >
          <option v-for="branch in filterBranchesList" :key="branch" :value="branch">{{ branch }}</option>
        </select>
      </div>

      <label class="checkbox-container">
        <input v-model="showWrittenOff" type="checkbox">
        <span>Показать списано выпускникам</span>
      </label>
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
      :visible="isModalVisible"
      :loading="modalLoading"
      :error="modalError"
      :errorDetails="modalErrorDetails"
      :contractData="modalContractData"
      :contractRaw="modalContractRaw"
      :listContractRow="currentContractRow"
      :formatDate="formatDate"
      :formatDateTime="formatDateTime"
      :formatCurrency="formatCurrency"
      :autoEdit="autoEdit"
      @retry="retryFetchContractDetails"
      @close="closeModal"
    />
  </div>
</template>

<script>
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue'
import http from '@/api/http'
import DataTableRed from '@/components/shared/DataTableRed.vue'
import ContractDetailsModal from './ContractDetailsModal.vue'
import AddContractModal from './AddContractModal.vue'

function readRights() {
  try {
    const u = JSON.parse(localStorage.getItem('user') || 'null')
    return (u && u.rights) ? u.rights : {}
  } catch {
    return {}
  }
}

function readUserFilial() {
  const direct = localStorage.getItem('filial')
    || localStorage.getItem('Филиал')
    || localStorage.getItem('branch')

  if (direct && direct.trim()) return direct.trim()

  try {
    const u = JSON.parse(localStorage.getItem('user') || 'null')
    const cand =
      u?.filial ?? u?.Филиал ?? u?.branch ?? u?.Branch ?? u?.profile?.filial ?? u?.profile?.Филиал
    if (typeof cand === 'string' && cand.trim()) return cand.trim()
  } catch {
    return null
  }

  return null
}

function normalizeBranchName(v) {
  return typeof v === 'string' ? v.trim() : ''
}

function safeTrim(v) {
  return v == null ? '' : String(v).trim()
}

function normalizeStatus(v) {
  return safeTrim(v)
}

function isWrittenOffStatus(status) {
  return normalizeStatus(status).toLowerCase().startsWith('списан')
}

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
    ])

    const contracts = ref([])
    const loading = ref(true)
    const error = ref(null)
    const errorDetails = ref(null)

    const selectedUser = ref('Все')
    const usersList = ref(['Все'])
    const selectedBranch = ref('Все')
    const branchesList = ref(['Все'])
    const showWrittenOff = ref(false)

    const showAddModal = ref(false)

    const isModalVisible = ref(false)
    const modalLoading = ref(false)
    const modalError = ref('')
    const modalErrorDetails = ref('')
    const modalContractRaw = ref(null)
    const modalContractData = computed(() => modalContractRaw.value?.договор || null)
    const autoEdit = ref(false)
    const currentContractNumber = ref(null)
    const currentContractRow = ref(null)

    const rights = ref(readRights())
    const userFilial = ref(normalizeBranchName(readUserFilial()))
    const canEditOtherFilialData = computed(() => !!rights.value['РедактированиеДанныхЧужогоФилиала'])

    const refreshAuthContext = () => {
      rights.value = readRights()
      userFilial.value = normalizeBranchName(readUserFilial())
    }

    const formatDate = (dateStr) => {
      if (!dateStr || dateStr === '0001-01-01T00:00:00' || dateStr === '0001-01-01') return 'Не указана'
      try {
        const d = new Date(dateStr)
        if (isNaN(d.getTime())) {
          const parts = String(dateStr).split('.')
          if (parts.length === 3) {
            const iso = `${parts[2]}-${parts[1]}-${parts[0]}`
            const parsed = new Date(iso)
            return isNaN(parsed.getTime()) ? dateStr : parsed.toLocaleDateString('ru-RU')
          }
          return dateStr
        }
        return d.toLocaleDateString('ru-RU')
      } catch {
        return dateStr
      }
    }

    const formatDateTime = (s) => {
      if (!s) return '—'
      const d = new Date(s)
      return isNaN(d.getTime()) ? String(s) : d.toLocaleString('ru-RU')
    }

    const formatCurrency = (v) => {
      const n = Number(v ?? 0)
      try {
        return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(n)
      } catch {
        return `${n.toFixed(2)} ₽`
      }
    }

    const filterBranchesList = computed(() => {
      if (!canEditOtherFilialData.value && userFilial.value) {
        return [userFilial.value]
      }
      return branchesList.value
    })

    const contractFormBranches = computed(() => {
      if (!canEditOtherFilialData.value && userFilial.value) {
        return [userFilial.value]
      }
      return branchesList.value.filter(branch => branch && branch !== 'Все')
    })

    const activeBranchFilter = computed(() => {
      if (!canEditOtherFilialData.value) {
        return userFilial.value || 'Все'
      }
      return (selectedBranch.value || '').trim() || 'Все'
    })

    const filterUsersList = computed(() => {
      const userSet = new Set()

      for (const c of contracts.value) {
        const branch = normalizeBranchName(c?.Филиал)
        const userName = c?.Пользователь ? String(c.Пользователь).trim() : ''
        const byWrittenOff = showWrittenOff.value || !c?.isWrittenOff

        if (!userName) continue
        if (!byWrittenOff) continue
        if (activeBranchFilter.value !== 'Все' && branch !== activeBranchFilter.value) continue

        userSet.add(userName)
      }

      return ['Все', ...Array.from(userSet).sort((a, b) => a.localeCompare(b, 'ru'))]
    })

    const applyDefaultBranch = () => {
      const own = normalizeBranchName(userFilial.value || readUserFilial())

      if (!canEditOtherFilialData.value) {
        selectedBranch.value = own || 'Все'
        return
      }

      if (own && branchesList.value.includes(own)) {
        selectedBranch.value = own
        return
      }

      if (!selectedBranch.value || !branchesList.value.includes(selectedBranch.value)) {
        selectedBranch.value = 'Все'
      }
    }

    watch(selectedBranch, (newVal) => {
      if (!canEditOtherFilialData.value) {
        const forced = userFilial.value || 'Все'
        if (newVal !== forced) {
          selectedBranch.value = forced
        }
      }
    })

    watch(filterUsersList, (list) => {
      if (!list.includes(selectedUser.value)) {
        selectedUser.value = 'Все'
      }
    }, { deep: true })

    function onAuthRelatedChange() {
      refreshAuthContext()
      applyDefaultBranch()
    }

    const fetchContracts = async () => {
      try {
        loading.value = true
        error.value = null
        errorDetails.value = null

        contracts.value = []
        usersList.value = ['Все']
        branchesList.value = ['Все']
        selectedUser.value = 'Все'
        selectedBranch.value = 'Все'

        const { data } = await http.get('/RCDO/hs/rcdo/ucenicidogovora')
        const parsed = typeof data === 'string' ? JSON.parse(data) : data

        if (parsed && Array.isArray(parsed.договоры)) {
          const uniqueUsers = new Set()
          const uniqueBranches = new Set()

          contracts.value = parsed.договоры.map((c) => {
            const userName = c.Пользователь ? String(c.Пользователь).trim() : 'Не указан'
            const branchName = c.Филиал ? String(c.Филиал).trim() : 'Не указан'
            const status = normalizeStatus(c.Статус)
            const writeOffDate = safeTrim(c.ДатаСписания)
            const isWrittenOff = isWrittenOffStatus(status)

            if (c?.Пользователь) uniqueUsers.add(userName)
            if (c?.Филиал) uniqueBranches.add(branchName)

            return {
              ...c,
              Статус: status,
              ДатаСписания: writeOffDate,
              isWrittenOff,
              rowClass: isWrittenOff ? 'contract-writtenoff-row' : '',
              Дата_Подписания: formatDate(c.Дата_Подписания),
              Пользователь: userName,
              Филиал: branchName
            }
          })

          usersList.value = ['Все', ...Array.from(uniqueUsers).sort((a, b) => a.localeCompare(b, 'ru'))]
          branchesList.value = ['Все', ...Array.from(uniqueBranches).sort((a, b) => a.localeCompare(b, 'ru'))]

          applyDefaultBranch()
        } else {
          throw new Error('Некорректный формат данных в ответе сервера (список договоров)')
        }
      } catch (err) {
        if (err.response) {
          error.value = `Ошибка сервера: ${err.response.status}`
          errorDetails.value = `Сервер вернул: ${JSON.stringify(err.response.data)}`
        } else if (err.request) {
          error.value = 'Сервер списка договоров не отвечает'
          errorDetails.value = 'Проверьте доступность сервера и сетевое соединение'
        } else if (err.code === 'ECONNABORTED') {
          error.value = 'Таймаут загрузки списка договоров'
          errorDetails.value = 'Сервер не ответил за установленное время'
        } else {
          error.value = 'Не удалось загрузить список договоров'
          errorDetails.value = err.message
        }
      } finally {
        loading.value = false
      }
    }

    async function tryFetchDetails(endpoint, nomer) {
      return http.get(endpoint, { params: { nomer } })
    }

    const fetchContractDetails = async (nomer) => {
      if (!nomer && nomer !== 0) return

      isModalVisible.value = true
      modalLoading.value = true
      modalError.value = ''
      modalErrorDetails.value = ''
      modalContractRaw.value = null
      currentContractNumber.value = nomer

      try {
        let resp = await tryFetchDetails('/RCDO/hs/rcdo/Dogovor', nomer).catch(() => null)

        if (!(resp?.status === 200 && resp?.data?.договор)) {
          resp = await tryFetchDetails('/RCDO/hs/rcdo/URLUD_DogovorPoNomeru', nomer)
        }

        const { data, status } = resp
        if (status === 200 && data && typeof data.договор === 'object') {
          modalContractRaw.value = data
        } else {
          throw new Error(`Некорректный формат данных (детали договора). Статус: ${status}`)
        }
      } catch (err) {
        modalContractRaw.value = null
        if (err.response) {
          modalError.value = `Ошибка сервера: ${err.response.status}`
          modalErrorDetails.value = `Сервер вернул: ${JSON.stringify(err.response.data)}`
        } else if (err.request) {
          modalError.value = 'Сервер деталей договора не отвечает'
          modalErrorDetails.value = 'Проверьте доступность 1С/прокси и CORS.'
        } else if (err.code === 'ECONNABORTED') {
          modalError.value = 'Таймаут загрузки деталей договора'
          modalErrorDetails.value = 'Сервер не ответил за установленное время'
        } else {
          modalError.value = 'Не удалось загрузить детали договора'
          modalErrorDetails.value = err.message
        }
      } finally {
        modalLoading.value = false
      }
    }

    const handleOpenContractModal = (payload) => {
      const row = payload?.row || payload
      const num = row?.Номер_Договора ?? row?.Номер
      if (!num) {
        alert('Ошибка: не удалось определить номер договора.')
        return
      }
      currentContractRow.value = row ? { ...row } : null
      autoEdit.value = false
      fetchContractDetails(num)
    }

    const retryFetchContractDetails = () => {
      if (currentContractNumber.value != null) {
        fetchContractDetails(currentContractNumber.value)
      }
    }

    const closeModal = () => {
      isModalVisible.value = false
      modalLoading.value = false
      modalError.value = ''
      modalErrorDetails.value = ''
      modalContractRaw.value = null
      currentContractRow.value = null
      autoEdit.value = false
    }

    const handleContractAdded = async (createdNumber) => {
      showAddModal.value = false
      await fetchContracts()
      if (createdNumber != null) {
        autoEdit.value = true
        currentContractRow.value = null
        fetchContractDetails(createdNumber)
      }
    }

    const filteredContracts = computed(() => {
      return contracts.value.filter((c) => {
        const okUser = selectedUser.value === 'Все' || c.Пользователь === selectedUser.value
        const okBranch = activeBranchFilter.value === 'Все' || c.Филиал === activeBranchFilter.value
        const okWrittenOff = showWrittenOff.value || !c.isWrittenOff
        return okUser && okBranch && okWrittenOff
      })
    })

    onMounted(() => {
      refreshAuthContext()
      fetchContracts()
      window.addEventListener('auth-changed', onAuthRelatedChange)
      window.addEventListener('storage', onAuthRelatedChange)
    })

    onBeforeUnmount(() => {
      window.removeEventListener('auth-changed', onAuthRelatedChange)
      window.removeEventListener('storage', onAuthRelatedChange)
    })

    const onSortChanged = (evt) => { void evt }

    return {
      columns,
      contracts,
      loading,
      error,
      errorDetails,
      selectedUser,
      usersList,
      filterUsersList,
      selectedBranch,
      branchesList,
      filterBranchesList,
      contractFormBranches,
      filteredContracts,
      fetchContracts,
      showAddModal,
      handleContractAdded,
      isModalVisible,
      modalLoading,
      modalError,
      modalErrorDetails,
      modalContractRaw,
      modalContractData,
      autoEdit,
      currentContractRow,
      handleOpenContractModal,
      retryFetchContractDetails,
      closeModal,
      formatDate,
      formatDateTime,
      formatCurrency,
      onSortChanged,
      canEditOtherFilialData,
      userFilial,
      showWrittenOff
    }
  }
}
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

.checkbox-container {
  display:inline-flex;
  align-items:center;
  gap:8px;
  padding:10px 12px;
  background:#e9ecef;
  border-radius:4px;
  color:#495057;
  font-weight:700;
  user-select:none;
  cursor:pointer;
}
.checkbox-container input {
  margin:0;
}
</style>