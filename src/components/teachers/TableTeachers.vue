<template>
  <div>
    <h2>Список учителей</h2>

    <!-- Кнопка добавления видна только при праве ДобавлениеУчителя -->
    <button
      v-if="canAddTeacher"
      class="add-btn"
      @click="showAddModal = true"
    >
      Добавить учителя
    </button>

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
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import DataTable from '@/components/shared/DataTable.vue';
import EditTeacherModal from '@/components/teachers/EditTeacherModal.vue';
import AddTeacherModal from '@/components/teachers/AddTeacherModal.vue';
import http from '@/api/http';

function readRights () {
  try {
    const u = JSON.parse(localStorage.getItem('user') || 'null');
    return (u && u.rights) ? u.rights : {};
  } catch { return {}; }
}

// читаем «филиал пользователя» из localStorage (поддерживаем разные ключи)
function readUserFilial () {
  const direct = localStorage.getItem('filial')
    || localStorage.getItem('Филиал')
    || localStorage.getItem('branch');
  if (direct && direct.trim()) return direct.trim();

  try {
    const u = JSON.parse(localStorage.getItem('user') || 'null');
    const cand = u?.filial ?? u?.Филиал ?? u?.branch ?? u?.Branch ?? u?.profile?.filial ?? u?.profile?.Филиал;
    if (typeof cand === 'string' && cand.trim()) return cand.trim();
  } catch { /* ignore */ }

  return null;
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
    ];
    const firedColumn = { key: 'Дата_Увольнения', label: 'Дата увольнения' };
    const showInactiveOnly = ref(false);
    const displayedColumns = computed(() =>
      showInactiveOnly.value ? [...baseColumns, firedColumn] : baseColumns
    );

    const teachers = ref([]);
    const loading = ref(true);
    const error = ref(null);
    const errorDetails = ref(null);

    const selectedBranch = ref('Все');
    const branchesList = ref(['Все']);

    const showAddModal = ref(false);
    const showEditModal = ref(false);
    const selectedTeacher = ref(null);

    // === права ===
    const rights = ref(readRights());
    const canAddTeacher  = computed(() => !!rights.value['ДобавлениеУчителя']);
    const canEditTeacher = computed(() => !!rights.value['РедактированиеУчителя']);
    const refreshRights = () => { rights.value = readRights(); };

    // применяем «филиал по умолчанию»
    const applyDefaultBranch = () => {
      const def = readUserFilial();
      if (def && branchesList.value.includes(def)) {
        selectedBranch.value = def;
      } else {
        selectedBranch.value = 'Все';
      }
    };

    function onAuthRelatedChange () {
      refreshRights();
      applyDefaultBranch();
    }

    onMounted(() => {
      fetchAll();
      window.addEventListener('auth-changed', onAuthRelatedChange);
      window.addEventListener('storage', onAuthRelatedChange);
    });
    onBeforeUnmount(() => {
      window.removeEventListener('auth-changed', onAuthRelatedChange);
      window.removeEventListener('storage', onAuthRelatedChange);
    });

    const fetchFilialy = async () => {
      try {
        const { data } = await http.get('/RCDO/hs/rcdo/MOL');
        const filialy = (typeof data === 'string') ? JSON.parse(data).filialy : data.filialy;
        const names = (filialy || []).map(x => x.НаименованиеФилиала || x.Наименование).filter(Boolean);
        branchesList.value = ['Все', ...names.sort()];
        // после загрузки списка филиалов выбираем дефолт из профиля
        applyDefaultBranch();
      } catch (e) {
        // eslint-disable-next-line no-console
        console.debug('Не удалось получить MOL:', e && e.message);
        branchesList.value = ['Все'];
        selectedBranch.value = 'Все';
      }
    };

    const fetchTeachers = async () => {
      try {
        loading.value = true;
        error.value = null;
        errorDetails.value = null;
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

    const filteredTeachers = computed(() => {
      let arr = teachers.value;
      const sel = (selectedBranch.value || '').trim();
      if (sel !== 'Все') {
        arr = arr.filter(t => (t.Филиал || '').trim() === sel);
      }
      if (!showInactiveOnly.value) {
        arr = arr.filter(t => t._workActive);
      }
      return arr.map(t => ({
        ...t,
        rowClass: t._workActive ? '' : 'inactive-row'
      }));
    });

    const handleTeacherAdded   = () => { showAddModal.value = false; fetchAll(); };
    const handleTeacherUpdated = () => { showEditModal.value = false; fetchAll(); };
    const closeEditModal = () => { showEditModal.value = false; };

    const onRowClick = (teacher) => {
      if (!canEditTeacher.value) return;
      selectedTeacher.value = teacher;
      showEditModal.value = true;
    };

    const onSortChanged = () => undefined;

    return {
      displayedColumns,
      teachers, loading, error, errorDetails,
      selectedBranch, branchesList, showInactiveOnly,
      filteredTeachers,
      showAddModal, showEditModal, selectedTeacher,
      handleTeacherAdded, handleTeacherUpdated, closeEditModal, onRowClick,
      fetchAll, onSortChanged,
      canAddTeacher, canEditTeacher
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
  if (raw === true || raw === 1 || raw === '1') return true;
  if (raw === false || raw === 0 || raw === '0') return false;
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return false;
  if (['да','true','истина','активен','работает','on','yes','y'].includes(s)) return true;
  if (['нет','false','ложь','неактивен','уволен','off','no','n'].includes(s)) return false;
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

/* Подсветка неработающих, применяемая к строкам внутри DataTable */
:deep(tr.inactive-row) { background:#f3f4f6; color:#6b7280; }
:deep(tr.inactive-row td) { color:#6b7280 !important; }
</style>
