<template>
  <div>
    <h2>Список учителей</h2>

    <button
      v-if="canAddTeacher"
      class="add-btn"
      @click="showAddModal = true"
    >
      Добавить учителя
    </button>

    <AddTeacherModal
      v-if="showAddModal"
      :branches="teacherFormBranches"
      :lock-to-branch="!canEditOtherFilialData"
      :user-branch="userFilial"
      @close="showAddModal = false"
      @teacher-added="handleTeacherAdded"
    />

    <EditTeacherModal
      v-if="showEditModal"
      :teacher="selectedTeacher"
      :branches="teacherFormBranches"
      :lock-to-branch="!canEditOtherFilialData"
      :user-branch="userFilial"
      @close="closeEditModal"
      @teacher-updated="handleTeacherUpdated"
    />

    <div v-if="loading" class="loading-indicator">
      <span class="spinner"></span> Загрузка данных...
    </div>

    <div v-if="error" class="error-container">
      <p class="error-message">{{ error }}</p>
      <p class="error-details" v-if="errorDetails">Техническая информация: {{ errorDetails }}</p>
      <button @click="fetchAll" class="retry-button">Попробовать снова</button>
    </div>

    <div
      class="filter-container"
      v-if="!loading && !error && filterBranchesList.length > 0"
    >
      <label for="branch-filter">Фильтр по филиалу: </label>
      <select
        id="branch-filter"
        v-model="selectedBranch"
        :disabled="!canEditOtherFilialData"
      >
        <option
          v-for="branch in filterBranchesList"
          :key="branch"
          :value="branch"
        >
          {{ branch }}
        </option>
      </select>

      <label class="ml-3">
        <input type="checkbox" v-model="showInactiveOnly" style="vertical-align: middle; margin-right: 6px;" />
        Показать неработающих
      </label>
    </div>

    <DataTable
      v-if="!loading && !error"
      :tableData="filteredTeachers"
      :tableColumns="displayedColumns"
      initialSortKey="Код"
      initialSortOrder="asc"
      @sort-changed="onSortChanged"
      @row-click="onRowClick"
    />
  </div>
</template>

<script>
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue'
import axios from 'axios'
import DataTable from '@/components/shared/DataTable.vue'
import EditTeacherModal from '@/components/teachers/EditTeacherModal.vue'
import AddTeacherModal from '@/components/teachers/AddTeacherModal.vue'
import http from '@/api/http'

const ZGU_USERNAME = 'Длявыгрузки'
const ZGU_PASSWORD = '1'

function encodeBasicAuthUtf8(username, password) {
  const source = `${username}:${password}`

  try {
    const bytes = new TextEncoder().encode(source)
    let binary = ''
    for (const b of bytes) binary += String.fromCharCode(b)
    return `Basic ${btoa(binary)}`
  } catch {
    return `Basic ${btoa(unescape(encodeURIComponent(source)))}`
  }
}

const zguClient = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    Accept: 'application/json',
    Authorization: encodeBasicAuthUtf8(ZGU_USERNAME, ZGU_PASSWORD)
  }
})

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
    /* ignore */
  }

  return null
}

function normalizeString(v) {
  return typeof v === 'string' ? v.trim() : ''
}

function normalizeBranchName(v) {
  return typeof v === 'string' ? v.trim() : ''
}

function normalizeComparableString(v) {
  return normalizeString(v)
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ')
}

function simplifyBranchName(v) {
  return normalizeBranchName(v)
    .toLowerCase()
    .replace(/^центр\s+/i, '')
    .replace(/^филиал\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function uniqueBranches(arr = []) {
  const seen = new Set()
  const result = []

  for (const item of arr) {
    const name = normalizeBranchName(item)
    if (!name || seen.has(name)) continue
    seen.add(name)
    result.push(name)
  }

  return result
}

function extractTeachersArray(raw) {
  if (Array.isArray(raw)) return raw

  if (typeof raw === 'string') {
    try {
      return extractTeachersArray(JSON.parse(raw))
    } catch {
      return []
    }
  }

  if (!raw || typeof raw !== 'object') return []

  const candidates = [
    raw.teachers,
    raw.items,
    raw.data,
    raw.result,
    raw.rows,
    raw.Данные,
    raw.Учителя
  ]

  for (const item of candidates) {
    if (Array.isArray(item)) return item
  }

  return []
}

function normalizeDate(val) {
  if (!val || val === '0001-01-01T00:00:00') return ''
  if (/^\d{4}-\d{2}-\d{2}/.test(val)) return val.slice(0, 10).split('-').reverse().join('.')
  if (/^\d{2}\.\d{2}\.\d{4}/.test(val)) return val
  try {
    const d = new Date(val)
    if (!isNaN(d)) return d.toLocaleDateString('ru-RU')
  } catch (e) {
    /* no-op */
  }
  return String(val)
}

function toDateStamp(val) {
  if (!val || val === '0001-01-01T00:00:00') return 0

  if (/^\d{4}-\d{2}-\d{2}/.test(val)) {
    const d = new Date(val.slice(0, 10))
    return isNaN(d) ? 0 : d.getTime()
  }

  if (/^\d{2}\.\d{2}\.\d{4}$/.test(val)) {
    const [dd, mm, yyyy] = val.split('.')
    const d = new Date(`${yyyy}-${mm}-${dd}`)
    return isNaN(d) ? 0 : d.getTime()
  }

  try {
    const d = new Date(val)
    return isNaN(d) ? 0 : d.getTime()
  } catch {
    return 0
  }
}

function parseActive(raw) {
  if (raw === true || raw === 1 || raw === '1') return true
  if (raw === false || raw === 0 || raw === '0') return false

  const s = String(raw ?? '').trim().toLowerCase()
  if (!s) return false
  if (['да', 'true', 'истина', 'активен', 'работает', 'on', 'yes', 'y'].includes(s)) return true
  if (['нет', 'false', 'ложь', 'неактивен', 'уволен', 'off', 'no', 'n'].includes(s)) return false
  return false
}

function extractTeacherNameParts(t) {
  let surname = normalizeString(t?.Фамилия)
  let name = normalizeString(t?.Имя)
  let patronymic = normalizeString(t?.Отчество)

  if ((!surname || !name) && t?.Наименование) {
    const parts = String(t.Наименование).trim().split(/\s+/)
    if (!surname) surname = parts[0] || ''
    if (!name) name = parts[1] || ''
    if (!patronymic) patronymic = parts.slice(2).join(' ')
  }

  return { surname, name, patronymic }
}

function buildTeacherFioKey(t) {
  const { surname, name, patronymic } = extractTeacherNameParts(t)
  if (!surname || !name) return ''
  return [
    normalizeComparableString(surname),
    normalizeComparableString(name),
    normalizeComparableString(patronymic)
  ].join('|')
}

function resolveBranchByList(rawBranch, availableBranches = []) {
  const raw = normalizeBranchName(rawBranch)
  if (!raw) return ''

  if (availableBranches.includes(raw)) return raw

  const rawSimple = simplifyBranchName(raw)

  for (const item of availableBranches) {
    const simple = simplifyBranchName(item)
    if (simple === rawSimple) return item
  }

  for (const item of availableBranches) {
    const simple = simplifyBranchName(item)
    if (simple && (rawSimple.includes(simple) || simple.includes(rawSimple))) {
      return item
    }
  }

  return raw
}

function buildZguIndex(items = [], availableBranches = []) {
  const index = new Map()

  for (const raw of items) {
    const fioKey = buildTeacherFioKey(raw)
    if (!fioKey) continue

    const resolvedBranch = resolveBranchByList(raw?.Филиал, availableBranches)
    const entry = {
      Код: String(raw?.Код ?? ''),
      Филиал: resolvedBranch || normalizeBranchName(raw?.Филиал),
      _branchKey: simplifyBranchName(resolvedBranch || raw?.Филиал || ''),
      _workActive: parseActive(raw?.Работа_Статус),
      Дата_Увольнения: normalizeDate(raw?.Дата_Увольнения),
      _dismissedStamp: toDateStamp(raw?.Дата_Увольнения)
    }

    const arr = index.get(fioKey) || []
    arr.push(entry)
    index.set(fioKey, arr)
  }

  return index
}

function annotateTeacherWithZgu(localTeacher, zguIndex) {
  const noMismatch = {
    ...localTeacher,
    _zguDismissedMismatch: false,
    _zguSyncLabel: ''
  }

  if (!localTeacher?._workActive) return noMismatch

  const fioKey = buildTeacherFioKey(localTeacher)
  if (!fioKey) return noMismatch

  let candidates = zguIndex.get(fioKey) || []
  if (!candidates.length) return noMismatch

  const localBranchKey = simplifyBranchName(localTeacher.Филиал || '')
  if (localBranchKey) {
    const sameBranch = candidates.filter(c => c._branchKey && c._branchKey === localBranchKey)
    if (sameBranch.length) {
      candidates = sameBranch
    }
  }

  const hasActiveZguRecord = candidates.some(c => c._workActive)
  if (hasActiveZguRecord) return noMismatch

  const dismissed = candidates
    .filter(c => !c._workActive)
    .sort((a, b) => (b._dismissedStamp || 0) - (a._dismissedStamp || 0))

  if (!dismissed.length) return noMismatch

  const latestDismissed = dismissed[0]
  const dateSuffix = latestDismissed.Дата_Увольнения
    ? ` (${latestDismissed.Дата_Увольнения})`
    : ''

  return {
    ...localTeacher,
    _zguDismissedMismatch: true,
    _zguSyncLabel: `Уволен в ZGU${dateSuffix}, в локальной базе не отмечен`
  }
}

export default {
  components: { DataTable, EditTeacherModal, AddTeacherModal },
  setup() {
    const baseColumns = [
      { key: 'Код', label: 'Код' },
      { key: 'Фамилия', label: 'Фамилия' },
      { key: 'Имя', label: 'Имя' },
      { key: 'Отчество', label: 'Отчество' },
      { key: 'Дата_Приема_На_Работу', label: 'Дата приёма' },
      { key: 'Предмет', label: 'Предмет' },
      { key: 'Адрес_Регистрации', label: 'Адрес регистрации' },
      { key: 'Филиал', label: 'Филиал' }
    ]
    const firedColumn = { key: 'Дата_Увольнения', label: 'Дата увольнения' }
    const zguSyncColumn = { key: '_zguSyncLabel', label: 'Сверка ZGU' }

    const showInactiveOnly = ref(false)
    const teachers = ref([])
    const zguIndex = ref(new Map())
    const loading = ref(true)
    const error = ref(null)
    const errorDetails = ref(null)

    const selectedBranch = ref('Все')
    const branchesList = ref(['Все'])

    const showAddModal = ref(false)
    const showEditModal = ref(false)
    const selectedTeacher = ref(null)

    const rights = ref(readRights())
    const userFilial = ref(normalizeBranchName(readUserFilial()))

    const canAddTeacher = computed(() => !!rights.value['ДобавлениеУчителя'])
    const canEditTeacher = computed(() => !!rights.value['РедактированиеУчителя'])
    const canEditOtherFilialData = computed(() => !!rights.value['РедактированиеДанныхЧужогоФилиала'])

    const hasZguWarnings = computed(() =>
      teachers.value.some(t => t._zguDismissedMismatch)
    )

    const displayedColumns = computed(() => {
      const cols = [...baseColumns]

      if (showInactiveOnly.value) {
        cols.push(firedColumn)
      }

      if (hasZguWarnings.value) {
        cols.push(zguSyncColumn)
      }

      return cols
    })

    const refreshAuthContext = () => {
      rights.value = readRights()
      userFilial.value = normalizeBranchName(readUserFilial())
    }

    const filterBranchesList = computed(() => {
      if (!canEditOtherFilialData.value && userFilial.value) {
        return [userFilial.value]
      }
      return branchesList.value
    })

    const teacherFormBranches = computed(() => {
      if (!canEditOtherFilialData.value && userFilial.value) {
        return [userFilial.value]
      }
      return branchesList.value.filter(branch => branch && branch !== 'Все')
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

    watch(userFilial, () => {
      applyDefaultBranch()
    })

    watch(canEditOtherFilialData, () => {
      applyDefaultBranch()
    })

    watch(branchesList, () => {
      applyDefaultBranch()
    }, { deep: true })

    watch(selectedBranch, (newVal) => {
      if (!canEditOtherFilialData.value) {
        const forced = userFilial.value || 'Все'
        if (newVal !== forced) {
          selectedBranch.value = forced
        }
      }
    })

    function onAuthRelatedChange() {
      refreshAuthContext()
      applyDefaultBranch()
    }

    onMounted(() => {
      refreshAuthContext()
      fetchAll()
      window.addEventListener('auth-changed', onAuthRelatedChange)
      window.addEventListener('storage', onAuthRelatedChange)
    })

    onBeforeUnmount(() => {
      window.removeEventListener('auth-changed', onAuthRelatedChange)
      window.removeEventListener('storage', onAuthRelatedChange)
    })

    const fetchFilialy = async () => {
      try {
        const { data } = await http.get('/RCDO/hs/rcdo/MOL')
        const filialy = (typeof data === 'string') ? JSON.parse(data).filialy : data.filialy

        const rawNames = (filialy || [])
          .map(x => x.НаименованиеФилиала || x.Наименование)
          .filter(Boolean)

        const names = uniqueBranches(rawNames)

        if (userFilial.value && !names.includes(userFilial.value)) {
          names.push(userFilial.value)
        }

        names.sort((a, b) => a.localeCompare(b, 'ru'))

        branchesList.value = ['Все', ...names]
        applyDefaultBranch()
      } catch (e) {
        console.debug('Не удалось получить MOL:', e && e.message)

        if (userFilial.value) {
          branchesList.value = ['Все', userFilial.value]
          selectedBranch.value = userFilial.value
        } else {
          branchesList.value = ['Все']
          selectedBranch.value = 'Все'
        }
      }
    }

    const fetchZguTeachers = async () => {
      try {
        const { data } = await zguClient.get('/ZGU/hs/teachers/GetPersData')
        const arr = extractTeachersArray(data)
        const availableBranches = branchesList.value.filter(b => b && b !== 'Все')

        zguIndex.value = buildZguIndex(arr, availableBranches)
      } catch (e) {
        console.debug('Не удалось выполнить сверку с ZGU:', e && (e.message || e))
        zguIndex.value = new Map()
      }
    }

    const fetchTeachers = async () => {
      try {
        loading.value = true
        error.value = null
        errorDetails.value = null
        teachers.value = []

        const { data: resp } = await http.get('/RCDO/hs/rcdo/teachers')
        const arr = resp && Array.isArray(resp.teachers) ? resp.teachers : []

        teachers.value = arr
          .map(t => {
            const start = normalizeDate(t.Дата_Приема_На_Работу)
            const fired = normalizeDate(t.Дата_Увольнения)
            const active = parseActive(t.Работа_Статус)
            const branch = t.Филиал ? String(t.Филиал).trim() : 'Не указан'
            const { surname, name, patronymic } = extractTeacherNameParts(t)

            return {
              ...t,
              Фамилия: t.Фамилия || surname,
              Имя: t.Имя || name,
              Отчество: t.Отчество || patronymic,
              Дата_Приема_На_Работу: start,
              Дата_Увольнения: fired,
              _workActive: active,
              Филиал: branch
            }
          })
          .map(t => annotateTeacherWithZgu(t, zguIndex.value))
      } catch (err) {
        if (err.response) {
          error.value = `Ошибка сервера: ${err.response.status}`
          errorDetails.value = `Сервер вернул: ${JSON.stringify(err.response.data)}`
        } else if (err.request) {
          error.value = 'Сервер не отвечает'
          errorDetails.value = 'Проверьте доступность сервера 1С и сеть'
        } else {
          error.value = 'Не удалось загрузить данные.'
          errorDetails.value = err.message
        }
      } finally {
        loading.value = false
      }
    }

    const fetchAll = async () => {
      loading.value = true
      await fetchFilialy()
      await fetchZguTeachers()
      await fetchTeachers()
    }

    const filteredTeachers = computed(() => {
      let arr = teachers.value

      const activeBranchFilter = !canEditOtherFilialData.value
        ? (userFilial.value || 'Все')
        : (selectedBranch.value || '').trim()

      if (activeBranchFilter !== 'Все') {
        arr = arr.filter(t => (t.Филиал || '').trim() === activeBranchFilter)
      }

      if (!showInactiveOnly.value) {
        arr = arr.filter(t => t._workActive)
      }

      return arr.map(t => {
        let rowClass = ''

        if (t._zguDismissedMismatch) {
          rowClass = 'zgu-dismissed-row'
        } else if (!t._workActive) {
          rowClass = 'inactive-row'
        }

        return {
          ...t,
          rowClass
        }
      })
    })

    const handleTeacherAdded = () => {
      showAddModal.value = false
      fetchAll()
    }

    const handleTeacherUpdated = () => {
      showEditModal.value = false
      fetchAll()
    }

    const closeEditModal = () => {
      showEditModal.value = false
    }

    const onRowClick = (teacher) => {
      if (!canEditTeacher.value) return
      selectedTeacher.value = teacher
      showEditModal.value = true
    }

    const onSortChanged = () => undefined

    return {
      displayedColumns,
      teachers,
      loading,
      error,
      errorDetails,
      selectedBranch,
      branchesList,
      filterBranchesList,
      teacherFormBranches,
      showInactiveOnly,
      filteredTeachers,
      showAddModal,
      showEditModal,
      selectedTeacher,
      handleTeacherAdded,
      handleTeacherUpdated,
      closeEditModal,
      onRowClick,
      fetchAll,
      onSortChanged,
      canAddTeacher,
      canEditTeacher,
      canEditOtherFilialData,
      userFilial
    }
  }
}
</script>

<style scoped>
.add-btn{background:#2196f3;color:#fff;border:none;padding:8px 18px;border-radius:4px;font-size:15px;cursor:pointer;margin-bottom:18px;transition:background .17s}
.add-btn:hover{background:#167ee6}
.error-container{margin:20px 0;padding:15px;background-color:#fff8f8;border-left:4px solid #ff5252;border-radius:4px}
.error-message{color:#d32f2f;margin-bottom:8px;font-weight:bold}
.error-details{color:#666;font-size:.9em;margin-bottom:15px}
.retry-button{background-color:#2196f3;color:#fff;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;font-weight:bold}
.retry-button:hover{background-color:#0d8aee}
.loading-indicator{display:flex;align-items:center;margin:20px 0}
.spinner{display:inline-block;width:20px;height:20px;margin-right:10px;border:3px solid rgba(0,0,0,.1);border-radius:50%;border-top-color:#2196f3;animation:spin 1s ease-in-out infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.filter-container{margin-bottom:15px;padding:10px;background-color:#e9ecef;border-radius:4px;display:flex;align-items:center;gap:10px}
.filter-container label{font-weight:bold;color:#495057;margin-right:14px}
.filter-container select{padding:5px 8px;border:1px solid #ced4da;border-radius:4px;min-width:200px}
.ml-3{margin-left:16px}

:deep(tr.inactive-row) { background:#f3f4f6; color:#6b7280; }
:deep(tr.inactive-row td) { color:#6b7280 !important; }

:deep(tr.zgu-dismissed-row) { background:#fff1f2; }
:deep(tr.zgu-dismissed-row td) { color:#9f1239 !important; font-weight:500; }
</style>