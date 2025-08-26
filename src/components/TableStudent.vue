<template>
  <div>
    <h2>Список учеников</h2>
    <button class="add-btn" @click="showAddModal = true">Добавить ученика</button>

    <AddStudentModal
      v-if="showAddModal"
      :branches="branchesList"
      @close="showAddModal = false"
      @student-added="handleStudentAdded"
    />

    <EditStudentModal
      v-if="showEditModal"
      :student="selectedStudent"
      :branches="branchesList"
      @close="closeEditModal"
      @student-updated="handleStudentUpdated"
    />

    <div v-if="loading" class="loading-indicator">
      <span class="spinner"></span> Загрузка данных...
    </div>

    <div v-if="error" class="error-container">
      <p class="error-message">{{ error }}</p>
      <p class="error-details" v-if="errorDetails">Техническая информация: {{ errorDetails }}</p>
      <button @click="fetchAll" class="retry-button">Попробовать снова</button>
    </div>

    <div class="filter-container" v-if="!loading && !error && branchesList.length > 1">
      <label for="branch-filter">Фильтр по филиалу: </label>
      <select id="branch-filter" v-model="selectedBranch">
        <option v-for="branch in branchesList" :key="branch" :value="branch">{{ branch }}</option>
      </select>
      <label class="ml-3">
        <input type="checkbox" v-model="showInactiveOnly" style="vertical-align: middle; margin-right: 6px;" />
        Показать выбывших
      </label>
    </div>

    <DataTable
      v-if="!loading && !error"
      :tableData="filteredStudents"
      :tableColumns="displayedColumns"
      initialSortKey="Код"
      initialSortOrder="asc"
      @sort-changed="onSortChanged"
      @row-click="onRowClick"
    />
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue'
import DataTable from '@/components/DataTable.vue'
import AddStudentModal from '@/components/AddStudentModal.vue'
import EditStudentModal from '@/components/EditStudentModal.vue'
import http from '@/api/http'

// Универсальная нормализация любых представлений «да/нет» к Boolean
function toBool(v) {
  if (typeof v === 'boolean') return v
  if (v == null) return false
  // числа
  if (typeof v === 'number') return v !== 0
  const s = String(v).trim().toLowerCase()
  if (['да','истина','true','1','активен','учится','обучается','yes','y'].includes(s)) return true
  if (['нет','ложь','false','0','не активен','no','n'].includes(s)) return false
  // по умолчанию — ложь
  return false
}

export default {
  components: { DataTable, AddStudentModal, EditStudentModal },
  setup() {
    const baseColumns = [
      { key: 'Код', label: 'Код' },
      { key: 'Фамилия', label: 'Фамилия' },
      { key: 'Имя', label: 'Имя' },
      { key: 'Отчество', label: 'Отчество' },
      { key: 'Дата_Поступления', label: 'Дата поступления' },
      { key: 'Класс', label: 'Класс' },
      { key: 'Приказ_О_Зачислении', label: 'Приказ о зачислении' },
      { key: 'Адрес_Регистрации', label: 'Адрес регистрации' },
      { key: 'Филиал', label: 'Филиал' }
    ]
    const orderOutColumn = { key: 'Приказ_Об_Отчислении', label: 'Приказ об отчислении' }
    const showInactiveOnly = ref(false)
    const displayedColumns = computed(() =>
      showInactiveOnly.value ? [...baseColumns, orderOutColumn] : baseColumns
    )

    const students = ref([])
    const loading = ref(true)
    const error = ref(null)
    const errorDetails = ref(null)

    const selectedBranch = ref('Все')
    const branchesList = ref(['Все'])
    const filialyData = ref([])

    const showAddModal = ref(false)
    const showEditModal = ref(false)
    const selectedStudent = ref(null)

    const fetchFilialy = async () => {
      try {
        const { data } = await http.get('/RCDO/hs/rcdo/MOL')
        const filialy = (typeof data === 'string') ? JSON.parse(data).filialy : data.filialy
        filialyData.value = filialy || []
        const allNames = filialyData.value.map(f => f.НаименованиеФилиала || f.Наименование).filter(Boolean)
        branchesList.value = ['Все', ...allNames.sort()]
      } catch {
        filialyData.value = []
        branchesList.value = ['Все']
      }
    }

    const fetchStudents = async () => {
      try {
        loading.value = true
        error.value = null
        errorDetails.value = null
        students.value = []
        selectedBranch.value = 'Все'
        const { data: resp } = await http.get('/RCDO/hs/rcdo/ucenici')
        if (resp && Array.isArray(resp.ученики)) {
          students.value = resp.ученики.map(student => {
            const dateStr = student.Дата_Поступления
            let formattedDate = 'Не указана'
            if (dateStr && dateStr !== '0001-01-01T00:00:00') {
              const d = new Date(dateStr)
              if (!isNaN(d)) formattedDate = d.toLocaleDateString('ru-RU')
              else if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) formattedDate = dateStr.split('-').reverse().join('.')
              else formattedDate = dateStr
            }
            const branch = student.Филиал ? student.Филиал.trim() : 'Не указан'
            return { ...student, Дата_Поступления: formattedDate, _statusBool: toBool(student.Обучение_Статус), Филиал: branch }
          })
        } else {
          throw new Error('Некорректный формат данных в ответе сервера')
        }
      } catch (err) {
        if (err.response) {
          error.value = `Ошибка сервера: ${err.response.status}`
          errorDetails.value = `Сервер вернул: ${JSON.stringify(err.response.data)}`
        } else if (err.request) {
          error.value = 'Сервер не отвечает'
          errorDetails.value = 'Проверьте доступность сервера 1С и сетевое соединение'
        } else if (err.message && err.message.includes('Network Error')) {
          error.value = 'Ошибка доступа к серверу'
          errorDetails.value = 'Возможная проблема с CORS. Требуется настройка сервера 1С.'
        } else {
          error.value = 'Не удалось загрузить данные. Пожалуйста, попробуйте позже.'
          errorDetails.value = err.message
        }
      } finally { loading.value = false }
    }

    const fetchAll = async () => { loading.value = true; await fetchFilialy(); await fetchStudents() }
    onMounted(fetchAll)

    const filteredStudents = computed(() => {
      let arr = students.value
      if (selectedBranch.value !== 'Все') arr = arr.filter(s => s.Филиал === selectedBranch.value)
      if (showInactiveOnly.value) return arr
      arr = arr.filter(s => s._statusBool)
      return arr.map(stud => ({ ...stud, rowClass: !stud._statusBool ? 'inactive-row' : '' }))
    })

    const handleStudentAdded = () => { showAddModal.value = false; fetchAll() }
    const handleStudentUpdated = () => { showEditModal.value = false; fetchAll() }
    const closeEditModal = () => { showEditModal.value = false }
    const onRowClick = (student) => { selectedStudent.value = student; showEditModal.value = true }
    const onSortChanged = () => {}

    return {
      displayedColumns, students, loading, error, errorDetails, fetchAll, onSortChanged,
      selectedBranch, branchesList, filteredStudents, showAddModal, handleStudentAdded,
      showEditModal, selectedStudent, handleStudentUpdated, closeEditModal, onRowClick, showInactiveOnly
    }
  }
}
</script>

<style scoped>
.add-btn{background:#2196f3;color:#fff;border:none;padding:8px 18px;border-radius:4px;font-size:15px;cursor:pointer;margin-bottom:18px;transition:background .17s}
.add-btn:hover{background:#167ee6}
.error-container{margin:20px 0;padding:15px;background-color:#fff8f8;border-left:4px solid #ff5252;border-radius:4px}
.error-message{color:#d32f2f;margin-bottom:8px;font-weight:700}
.error-details{color:#666;font-size:.9em;margin-bottom:15px}
.retry-button{background-color:#2196f3;color:#fff;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;font-weight:700}
.retry-button:hover{background-color:#0d8aee}
.loading-indicator{display:flex;align-items:center;margin:20px 0}
.spinner{display:inline-block;width:20px;height:20px;margin-right:10px;border:3px solid rgba(0,0,0,.1);border-radius:50%;border-top-color:#2196f3;animation:spin 1s ease-in-out infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.filter-container{margin-bottom:15px;padding:10px;background-color:#e9ecef;border-radius:4px;display:flex;align-items:center;gap:10px}
.filter-container label{font-weight:700;color:#495057;margin-right:14px}
.filter-container select{padding:5px 8px;border:1px solid #ced4da;border-radius:4px;min-width:200px}
.ml-3{margin-left:16px}
</style>
