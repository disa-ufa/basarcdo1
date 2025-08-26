<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <div class="modal-window">
      <button class="close-btn" @click="$emit('close')">×</button>
      <h3>Добавить договор</h3>
      <form @submit.prevent="addContract">
        <div class="form-row">
          <label>Номер договора:</label>
          <input v-model="number" required />
        </div>
        <div class="form-row">
          <label>Дата подписания:</label>
          <input v-model="date" type="date" required />
        </div>
        <div class="form-row">
          <label>Пользователь:</label>
          <select v-model="userType" required>
            <option value="">Выбрать</option>
            <option value="Ученик">Ученик</option>
            <option value="Учитель">Учитель</option>
          </select>
        </div>
        <div class="form-row">
          <label>ФИО пользователя:</label>
          <select v-model="fio" :disabled="!userType" required>
            <option value="">Выбрать</option>
            <option v-for="person in fioOptions" :key="person.Код" :value="person.Наименование">
              {{ person.Наименование }}
            </option>
          </select>
        </div>
        <div class="form-row">
          <label>Филиал:</label>
          <select v-model="branch" required>
            <option value="">Выбрать</option>
            <option v-for="b in branchesList" :key="b" :value="b">{{ b }}</option>
          </select>
        </div>
        <div v-if="error" class="error-msg">{{ error }}</div>
        <div class="form-actions">
          <button type="submit" :disabled="saving || !canSubmit">{{ saving ? "Сохранение..." : "Сохранить" }}</button>
          <button type="button" @click="$emit('close')" :disabled="saving">Отмена</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, watch } from 'vue';
import axios from 'axios';

export default {
  emits: ['close', 'contract-added'],
  setup(_, { emit }) {
    const number = ref('');
    const date = ref('');
    const userType = ref('');
    const fio = ref('');
    const branch = ref('');
    const error = ref('');
    const saving = ref(false);

    const students = ref([]);
    const teachers = ref([]);
    const busyFioSet = ref(new Set());
    const branchesList = ref([]);
    const allContracts = ref([]);

    // Получение всех филиалов из MOL
    const fetchBranches = async () => {
      try {
        const resp = await axios.get('/api/RCDO/hs/rcdo/MOL', {
          headers: { Authorization: 'Basic ' + btoa('admin:10028585mM') }
        });
        const filialy = Array.isArray(resp.data.filialy) ? resp.data.filialy : [];
        const namesSet = new Set();
        filialy.forEach(f => {
          if (f.НаименованиеФилиала) namesSet.add(f.НаименованиеФилиала);
          else if (f.Наименование) namesSet.add(f.Наименование);
        });
        branchesList.value = Array.from(namesSet);
      } catch (e) {
        branchesList.value = [];
      }
    };

    // Получение договоров (для поиска максимального номера и исключения ФИО)
    const fetchContracts = async () => {
      try {
        const resp = await axios.get('/api/RCDO/hs/rcdo/ucenicidogovora', {
          headers: { Authorization: 'Basic ' + btoa('admin:10028585mM') }
        });
        allContracts.value = Array.isArray(resp.data.договоры) ? resp.data.договоры : [];
        // Собираем Set занятых ФИО для фильтрации (по ключу ФИО)
        busyFioSet.value = new Set(allContracts.value.map(c => c.ФИО));
      } catch {
        allContracts.value = [];
        busyFioSet.value = new Set();
      }
    };

    // Универсальный поиск максимального номера
    const getNextContractNumber = () => {
      let maxNum = 0;
      for (const c of allContracts.value) {
        let num = 0;
        // Число либо в Номер_Договора (число), либо в Наименование (могут быть строка или число)
        if (c.Номер_Договора && typeof c.Номер_Договора === "number") {
          num = c.Номер_Договора;
        } else if (c.Наименование && !isNaN(Number(c.Наименование))) {
          num = Number(c.Наименование);
        }
        if (num > maxNum) maxNum = num;
      }
      return (maxNum + 1).toString();
    };

    const fetchStudents = async () => {
      try {
        const resp = await axios.get('/api/RCDO/hs/rcdo/ucenici', {
          headers: { Authorization: 'Basic ' + btoa('admin:10028585mM') }
        });
        students.value = Array.isArray(resp.data.ученики) ? resp.data.ученики : [];
      } catch {
        students.value = [];
      }
    };
    const fetchTeachers = async () => {
      try {
        const resp = await axios.get('/api/RCDO/hs/rcdo/teachers', {
          headers: { Authorization: 'Basic ' + btoa('admin:10028585mM') }
        });
        teachers.value = Array.isArray(resp.data.teachers) ? resp.data.teachers : [];
      } catch {
        teachers.value = [];
      }
    };

    // Комбинированная загрузка
    const loadAll = async () => {
      await Promise.all([
        fetchBranches(),
        fetchContracts(),
        fetchStudents(),
        fetchTeachers()
      ]);
      setDefaults();
    };

    function setDefaults() {
      userType.value = '';
      fio.value = '';
      branch.value = '';
      number.value = getNextContractNumber();
    }

    // Фильтрация ФИО пользователей для select'а
    const fioOptions = computed(() => {
      if (!userType.value) return [];
      const busySet = busyFioSet.value;
      if (userType.value === 'Ученик') {
        return students.value.filter(s => !busySet.has(s.Наименование));
      } else if (userType.value === 'Учитель') {
        return teachers.value.filter(t => !busySet.has(t.Наименование));
      }
      return [];
    });

    // Сброс ФИО при смене типа пользователя
    watch(userType, () => {
      fio.value = '';
    });

    // Сброс branch если не совпадает
    watch(branchesList, () => {
      if (!branchesList.value.includes(branch.value)) {
        branch.value = '';
      }
    });

    const canSubmit = computed(() =>
      !!number.value && !!date.value && !!userType.value && !!fio.value && !!branch.value
    );

    // Добавить договор
    const addContract = async () => {
      error.value = '';
      saving.value = true;
      try {
        const payload = {
          Номер_Договора: number.value,
          Дата_Подписания: date.value,
          Пользователь: userType.value,
          ФИО: fio.value,
          Филиал: branch.value
        };
        // 1. Сохраняем договор
        await axios.post('/api/RCDO/hs/rcdo/add_contract', payload, {
          headers: { Authorization: 'Basic ' + btoa('admin:10028585mM') }
        });
        // 2. Получаем свежие данные по номеру
        const resp = await axios.get(
          `/api/RCDO/hs/rcdo/Dogovor?nomer=${encodeURIComponent(number.value)}`,
          { headers: { Authorization: 'Basic ' + btoa('admin:10028585mM') } }
        );
        // 3. Отправляем детали наверх для открытия модалки редактирования!
        emit('contract-added', resp.data);
        
      } catch (e) {
        error.value = 'Ошибка при сохранении: ' + (e.response?.data || e.message);
      } finally {
        saving.value = false;
      }
    };

    onMounted(loadAll);

    return {
      number, date, userType, fio, branch, error, saving,
      branchesList,
      fioOptions,
      canSubmit,
      addContract
    };
  }
};
</script>








<style scoped>
.modal-backdrop {
  position: fixed;
  z-index: 9999;
  left: 0; top: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.12);
  display: flex;
  justify-content: flex-end;
  align-items: stretch;
}
.modal-window {
  background: #fff;
  width: 400px;
  max-width: 100vw;
  height: 100%;
  box-shadow: -2px 0 24px rgba(0,0,0,0.13);
  position: relative;
  padding: 36px 28px 20px 28px;
  animation: slideInPanel .35s cubic-bezier(.33,.9,.56,1.02);
  overflow-y: auto;
}
@keyframes slideInPanel {
  from { transform: translateX(100%); opacity: 0.3; }
  to { transform: translateX(0); opacity: 1; }
}
.close-btn {
  position: absolute; right: 16px; top: 12px;
  font-size: 22px; background: none; border: none;
  color: #888; cursor: pointer;
}
.form-row {
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
}
.form-row label {
  font-weight: bold;
  margin-bottom: 4px;
}
.form-row input, .form-row select {
  font-size: 15px;
  padding: 6px 10px;
  border: 1px solid #bbb;
  border-radius: 6px;
}
.form-actions {
  margin-top: 18px;
  display: flex;
  gap: 12px;
}
.error-msg {
  color: #d32f2f;
  margin: 10px 0 0 0;
}
</style>
