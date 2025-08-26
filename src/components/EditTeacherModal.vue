<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <div class="modal-window">
      <button class="close-btn" @click="$emit('close')">×</button>
      <h3>Редактировать учителя</h3>

      <form @submit.prevent="saveTeacher">
        <div class="form-row"><label>Фамилия:</label><input v-model="surname" required /></div>
        <div class="form-row"><label>Имя:</label><input v-model="name" required /></div>
        <div class="form-row"><label>Отчество:</label><input v-model="patronymic" /></div>

        <div class="form-row">
          <label>Дата приема на работу:</label>
          <input v-model="date" type="date" required />
        </div>

        <div class="form-row"><label>Предмет:</label><input v-model="subject" /></div>
        <div class="form-row"><label>Адрес регистрации:</label><input v-model="address" /></div>

        <div class="form-row">
          <label>Филиал:</label>
          <select v-model="branch" required>
            <option v-for="b in branches" :key="b" :value="b">{{ b }}</option>
          </select>
        </div>

        <div class="form-row">
          <label>Статус работы:</label>
          <select v-model="workStatus" required>
            <option :value="true">Активен</option>
            <option :value="false">Неактивен</option>
          </select>
        </div>

        <div class="form-row" v-if="workStatus === false">
          <label>Дата увольнения:</label>
          <input v-model="firedDate" type="date" />
        </div>

        <div v-if="error" class="error-msg">{{ error }}</div>

        <div class="form-actions">
          <button type="submit" :disabled="saving">{{ saving ? "Сохранение..." : "Сохранить" }}</button>
          <button type="button" @click="$emit('close')" :disabled="saving">Отмена</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import http from '@/api/http';

export default {
  props: {
    teacher:  { type: Object, required: true },
    branches: { type: Array,  required: true }
  },
  emits: ['close', 'teacher-updated'],
  data() {
    const statusBool = parseStatus(this.teacher.Работа_Статус);
    return {
      surname:    this.teacher.Фамилия || '',
      name:       this.teacher.Имя || '',
      patronymic: this.teacher.Отчество || '',
      date:       toInputDate(this.teacher.Дата_Приема_На_Работу),
      firedDate:  toInputDate(this.teacher.Дата_Увольнения),
      subject:    this.teacher.Предмет || '',
      address:    this.teacher.Адрес_Регистрации || '',
      branch:     this.teacher.Филиал || (this.branches[0] || ''),
      workStatus: statusBool, // boolean
      error: '',
      saving: false
    };
  },
  watch: {
    workStatus(newVal) {
      if (newVal === true) this.firedDate = '';
    },
    teacher: {
      immediate: true,
      handler(t) {
        if (!t) return;
        this.surname    = t.Фамилия || '';
        this.name       = t.Имя || '';
        this.patronymic = t.Отчество || '';
        this.date       = toInputDate(t.Дата_Приема_На_Работу);
        this.firedDate  = toInputDate(t.Дата_Увольнения);
        this.subject    = t.Предмет || '';
        this.address    = t.Адрес_Регистрации || '';
        this.branch     = t.Филиал || (this.branches[0] || '');
        this.workStatus = parseStatus(t.Работа_Статус);
      }
    }
  },
  methods: {
    async saveTeacher() {
      this.error = '';
      this.saving = true;
      try {
        const fio = [this.surname, this.name, this.patronymic].filter(Boolean).join(' ');
        const payload = {
          Код: this.teacher.Код,
          Фамилия: this.surname,
          Имя: this.name,
          Отчество: this.patronymic,
          Наименование: fio,
          Дата_Приема_На_Работу: this.date || '',
          Предмет: this.subject,
          Адрес_Регистрации: this.address,
          Филиал: this.branch,
          // ← отправляем именно boolean
          Работа_Статус: this.workStatus === true,
          Дата_Увольнения: this.workStatus === false ? (this.firedDate || '') : ''
        };
        await http.post('/RCDO/hs/rcdo/edit_teacher', payload);
        this.$emit('teacher-updated');
      } catch (e) {
        this.error = 'Ошибка при сохранении изменений: ' + (e.response?.data || e.message);
      } finally {
        this.saving = false;
      }
    }
  }
};

// helpers
function toInputDate(val) {
  if (!val || val === '0001-01-01T00:00:00' || val === 'Не указана') return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(val)) return val.slice(0, 10);
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(val)) {
    const [d, m, y] = val.split('.');
    return `${y}-${m}-${d}`;
  }
  const d = new Date(val);
  if (!isNaN(d)) {
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }
  return '';
}
function parseStatus(raw) {
  if (raw === true || raw === 1 || raw === '1') return true;
  const s = String(raw ?? '').trim().toLowerCase();
  return s === 'да' || s === 'true' || s === 'истина' || s === 'активен';
}
</script>

<style scoped>
@import "./modal-styles.css";
</style>
