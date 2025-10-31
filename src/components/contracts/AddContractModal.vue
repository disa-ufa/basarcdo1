<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <div class="modal-window">
      <button class="close-btn" @click="$emit('close')">×</button>
      <h3>Добавить договор</h3>

      <form @submit.prevent="addContract">
        <div class="form-row">
          <label>Номер договора:</label>
          <input v-model.trim="number" required inputmode="numeric" />
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
            <option
              v-for="person in fioOptions"
              :key="person.Код || person.code || person.id || person.Наименование"
              :value="person.Наименование"
            >
              {{ person.Наименование }}
            </option>
          </select>
        </div>

        <div class="form-row">
          <label>Филиал:</label>
          <select v-model="branch" required>
            <option value="">Выбрать</option>
            <option v-for="b in branchesList" :key="b" :value="b">
              {{ b }}
            </option>
          </select>
        </div>

        <div v-if="error" class="error-msg">{{ error }}</div>

        <div class="form-actions">
          <button type="submit" :disabled="saving || !canSubmit">
            {{ saving ? "Сохранение..." : "Сохранить" }}
          </button>
          <button type="button" @click="$emit('close')" :disabled="saving">
            Отмена
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, watch } from "vue";
// используем общий axios-инстанс, если он есть; если нет — можно оставить import axios from "axios"
import http from "@/api/http";

const basic = "Basic " + btoa("admin:10028585mM");

export default {
  emits: ["close", "contract-added"],
  setup(_, { emit }) {
    const number = ref("");
    const date = ref("");
    const userType = ref("");
    const fio = ref("");
    const branch = ref("");
    const error = ref("");
    const saving = ref(false);

    const students = ref([]);
    const teachers = ref([]);
    const allContracts = ref([]);
    const busyFioSet = ref(new Set());
    const branchesList = ref([]);

    // --- load helpers -------------------------------------------------------
    const fetchBranches = async () => {
      try {
        const { data } = await http.get("/RCDO/hs/rcdo/MOL", {
          headers: { Authorization: basic },
        });
        const arr = Array.isArray(data.filialy) ? data.filialy : [];
        const names = new Set();
        for (const f of arr) {
          if (f.НаименованиеФилиала) names.add(f.НаименованиеФилиала);
          else if (f.Наименование) names.add(f.Наименование);
        }
        branchesList.value = Array.from(names).sort();
      } catch {
        branchesList.value = [];
      }
    };

    const fetchContracts = async () => {
      try {
        const { data } = await http.get("/RCDO/hs/rcdo/ucenicidogovora", {
          headers: { Authorization: basic },
        });
        const list = Array.isArray(data.договоры) ? data.договоры : [];
        allContracts.value = list;
        busyFioSet.value = new Set(list.map((c) => c.ФИО).filter(Boolean));
      } catch {
        allContracts.value = [];
        busyFioSet.value = new Set();
      }
    };

    const fetchStudents = async () => {
      try {
        const { data } = await http.get("/RCDO/hs/rcdo/ucenici", {
          headers: { Authorization: basic },
        });
        students.value = Array.isArray(data.ученики) ? data.ученики : [];
      } catch {
        students.value = [];
      }
    };

    const fetchTeachers = async () => {
      try {
        const { data } = await http.get("/RCDO/hs/rcdo/teachers", {
          headers: { Authorization: basic },
        });
        teachers.value = Array.isArray(data.teachers) ? data.teachers : [];
      } catch {
        teachers.value = [];
      }
    };

    // --- defaults & derived -------------------------------------------------
    const getNextContractNumber = () => {
      let maxNum = 0;
      for (const c of allContracts.value) {
        let num = 0;
        if (typeof c.Номер_Договора === "number") {
          num = c.Номер_Договора;
        } else if (
          c.Номер_Договора &&
          !Number.isNaN(Number(String(c.Номер_Договора).trim()))
        ) {
          num = Number(String(c.Номер_Договора).trim());
        } else if (
          c.Наименование &&
          !Number.isNaN(Number(String(c.Наименование).trim()))
        ) {
          num = Number(String(c.Наименование).trim());
        }
        if (num > maxNum) maxNum = num;
      }
      return String(maxNum + 1);
    };

    const setDefaults = () => {
      userType.value = "";
      fio.value = "";
      branch.value = "";
      number.value = getNextContractNumber();
      if (!date.value) {
        // сегодняшняя дата по умолчанию
        const d = new Date();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        date.value = `${d.getFullYear()}-${mm}-${dd}`;
      }
    };

    const fioOptions = computed(() => {
      if (!userType.value) return [];
      const busy = busyFioSet.value;
      if (userType.value === "Ученик") {
        return students.value.filter((s) => !busy.has(s.Наименование));
      }
      if (userType.value === "Учитель") {
        return teachers.value.filter((t) => !busy.has(t.Наименование));
      }
      return [];
    });

    watch(userType, () => {
      fio.value = "";
    });

    watch(branchesList, () => {
      if (branch.value && !branchesList.value.includes(branch.value)) {
        branch.value = "";
      }
    });

    const canSubmit = computed(() => {
      const numOk = String(number.value || "").trim() !== "";
      return (
        numOk &&
        !!date.value &&
        !!userType.value &&
        !!fio.value &&
        !!branch.value
      );
    });

    // --- actions ------------------------------------------------------------
    const loadAll = async () => {
      await Promise.all([
        fetchBranches(),
        fetchContracts(),
        fetchStudents(),
        fetchTeachers(),
      ]);
      setDefaults();
    };

    const addContract = async () => {
      error.value = "";
      if (!canSubmit.value) return;

      saving.value = true;
      try {
        // полезно держать номер как число для 1С, но отправим как есть — сервер приведёт
        const payload = {
          Номер_Договора: Number(number.value),
          Дата_Подписания: date.value,
          Пользователь: userType.value,
          ФИО: fio.value,
          Филиал: branch.value,
        };

        // 1) создаём договор
        await http.post("/RCDO/hs/rcdo/add_contract", payload, {
          headers: { Authorization: basic },
        });

        // 2) забираем его по номеру (ВАЖНО: передаём номер через params!)
        const { data } = await http.get("/RCDO/hs/rcdo/Dogovor", {
          params: { nomer: Number(number.value) },
          headers: { Authorization: basic },
        });

        // 3) поднимаем событие наверх (открытие модалки редактирования)
        emit("contract-added", data);
      } catch (e) {
        const msg =
          e?.response?.data?.message ||
          e?.response?.data ||
          e?.message ||
          "Неизвестная ошибка";
        error.value = "Ошибка при сохранении: " + msg;
      } finally {
        saving.value = false;
      }
    };

    onMounted(loadAll);

    return {
      number,
      date,
      userType,
      fio,
      branch,
      error,
      saving,
      branchesList,
      fioOptions,
      canSubmit,
      addContract,
    };
  },
};
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  z-index: 9999;
  inset: 0;
  background: rgba(0, 0, 0, 0.12);
  display: flex;
  justify-content: flex-end;
  align-items: stretch;
}
.modal-window {
  background: #fff;
  width: 420px;
  max-width: 100vw;
  height: 100%;
  box-shadow: -2px 0 24px rgba(0, 0, 0, 0.13);
  position: relative;
  padding: 36px 28px 20px;
  animation: slideInPanel 0.35s cubic-bezier(0.33, 0.9, 0.56, 1.02);
  overflow-y: auto;
}
@keyframes slideInPanel {
  from {
    transform: translateX(100%);
    opacity: 0.3;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
.close-btn {
  position: absolute;
  right: 16px;
  top: 12px;
  font-size: 22px;
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
}
.form-row {
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
}
.form-row label {
  font-weight: 600;
  margin-bottom: 4px;
}
.form-row input,
.form-row select {
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
  margin-top: 10px;
}
</style>
