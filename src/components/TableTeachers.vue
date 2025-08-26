<template>
  <div>
    <h2>Список учителей</h2>
    <button class="add-btn" @click="showAddModal = true">Добавить учителя</button>

    <AddTeacherModal
      v-if="showAddModal"
      :branches="branchesList"
      @close="showAddModal = false"
      @teacher-added="handleTeacherAdded"
    />

    <EditTeacherModal
      v-if="showEditModal"
      :teacher="selectedTeacher"
      :branches="branchesList"
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

    <div class="filter-container" v-if="!loading && !error && branchesList.length > 1">
      <label for="branch-filter">Фильтр по филиалу: </label>
      <select id="branch-filter" v-model="selectedBranch">
        <option v-for="branch in branchesList" :key="branch" :value="branch">{{ branch }}</option>
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
import { ref, onMounted, computed } from 'vue';
import DataTable from '@/components/DataTable.vue';
import EditTeacherModal from '@/components/EditTeacherModal.vue';
import AddTeacherModal from '@/components/AddTeacherModal.vue';
import http from '@/api/http';

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
    ];
    const firedColumn = { key: 'Дата_Увольнения', label: 'Дата увольнения' };
    const displayedColumns = computed(() =>
      showInactiveOnly.value ? [...baseColumns, firedColumn] : baseColumns
    );

    const teachers = ref([]);
    const loading = ref(true);
    const error = ref(null);
    const errorDetails = ref(null);

    const selectedBranch = ref('Все');
    const branchesList = ref(['Все']);
    const showInactiveOnly = ref(false);

    const showAddModal = ref(false);
    const showEditModal = ref(false);
    const selectedTeacher = ref(null);

    const fetchFilialy = async () => {
      try {
        const { data } = await http.get('/RCDO/hs/rcdo/MOL');
        const filialy = (typeof data === 'string') ? JSON.parse(data).filialy : data.filialy;
        const names = (filialy || []).map(x => x.НаименованиеФилиала || x.Наименование).filter(Boolean);
        branchesList.value = ['Все', ...names.sort()];
      } catch (e) {
        // eslint-disable-next-line no-console
        console.debug('Не удалось получить MOL:', e && e.message);
        branchesList.value = ['Все'];
      }
    };

    const fetchTeachers = async () => {
      try {
        loading.value = true;
        error.value = null;
        errorDetails.value = null;
        selectedBranch.value = 'Все';
        teachers.value = [];

        const { data: resp } = await http.get('/RCDO/hs/rcdo/teachers');
        const arr = resp && Array.isArray(resp.teachers) ? resp.teachers : [];
        teachers.value = arr.map(t => {
          const start = normalizeDate(t.Дата_Приема_На_Работу);
          const fired = normalizeDate(t.Дата_Увольнения);
          const active = parseActive(t.Работа_Статус);
          const branch = t.Филиал ? String(t.Филиал).trim() : 'Не указан';
          return {
            ...t,
            Фамилия: t.Фамилия || (t.Наименование ? t.Наименование.split(' ')[0] : ''),
            Имя: t.Имя || (t.Наименование ? t.Наименование.split(' ')[1] : ''),
            Отчество: t.Отчество || (t.Наименование ? t.Наименование.split(' ')[2] : ''),
            Дата_Приема_На_Работу: start,
            Дата_Увольнения: fired,
            _workActive: active,
            Филиал: branch
          };
        });
      } catch (err) {
        if (err.response) {
          error.value = `Ошибка сервера: ${err.response.status}`;
          errorDetails.value = `Сервер вернул: ${JSON.stringify(err.response.data)}`;
        } else if (err.request) {
          error.value = 'Сервер не отвечает';
          errorDetails.value = 'Проверьте доступность сервера 1С и сеть';
        } else {
          error.value = 'Не удалось загрузить данные.';
          errorDetails.value = err.message;
        }
      } finally {
        loading.value = false;
      }
    };

    const fetchAll = async () => { loading.value = true; await fetchFilialy(); await fetchTeachers(); };
    onMounted(fetchAll);

    const filteredTeachers = computed(() => {
      let arr = teachers.value;
      if (selectedBranch.value !== 'Все') {
        arr = arr.filter(t => t.Филиал === selectedBranch.value);
      }
      if (!showInactiveOnly.value) {
        arr = arr.filter(t => t._workActive);
      }
      // Подкрашиваем неактивных серым
      return arr.map(t => ({ ...t, rowClass: t._workActive ? '' : 'row-inactive' }));
    });

    const handleTeacherAdded   = () => { showAddModal.value = false; fetchAll(); };
    const handleTeacherUpdated = () => { showEditModal.value = false; fetchAll(); };
    const closeEditModal = () => { showEditModal.value = false; };
    const onRowClick = (teacher) => { selectedTeacher.value = teacher; showEditModal.value = true; };
    const onSortChanged = () => { /* место для будущей логики */ };

    return {
      displayedColumns,
      teachers, loading, error, errorDetails,
      selectedBranch, branchesList, showInactiveOnly,
      filteredTeachers,
      showAddModal, showEditModal, selectedTeacher,
      handleTeacherAdded, handleTeacherUpdated, closeEditModal, onRowClick,
      fetchAll, onSortChanged
    };
  }
};

// === helpers ===
function normalizeDate(val) {
  if (!val || val === '0001-01-01T00:00:00') return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(val)) return val.slice(0, 10).split('-').reverse().join('.');
  if (/^\d{2}\.\d{2}\.\d{4}/.test(val)) return val;
  try {
    const d = new Date(val);
    if (!isNaN(d)) return d.toLocaleDateString('ru-RU');
  } catch (e) { /* no-op */ }
  return String(val);
}

function parseActive(raw) {
  // Устойчивый парсер: обрезаем пробелы и учитываем альтернативы
  if (raw === true || raw === 1 || raw === '1') return true;
  if (raw === false || raw === 0 || raw === '0') return false;
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return false;
  if (['да','true','истина','активен','работает','on','yes','y'].includes(s)) return true;
  if (['нет','false','ложь','неактивен','уволен','off','no','n'].includes(s)) return false;
  // неизвестное значение трактуем как false, чтобы не красить активным по ошибке
  return false;
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

/* Серые строки — неработающие */
.inactive-row { background:#f3f4f6; color:#6b7280; }
.inactive-row td { color:#6b7280 !important; }
</style>
