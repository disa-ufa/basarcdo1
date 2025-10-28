<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <div class="modal-window">
      <button class="close-btn" @click="$emit('close')">×</button>
      <h3>Добавить ученика</h3>
      <form @submit.prevent="addStudent">
        <div class="form-row">
          <label>Фамилия:</label>
          <input v-model="surname" required />
        </div>
        <div class="form-row">
          <label>Имя:</label>
          <input v-model="name" required />
        </div>
        <div class="form-row">
          <label>Отчество:</label>
          <input v-model="patronymic" required />
        </div>
        <div class="form-row">
          <label>Дата поступления:</label>
          <input v-model="date" type="date" required />
        </div>
        <div class="form-row">
          <label>Класс:</label>
          <input v-model="klass" required />
        </div>
        <div class="form-row">
          <label>Приказ о зачислении:</label>
          <input v-model="order" required />
        </div>
        <div class="form-row">
          <label>Адрес регистрации:</label>
          <input v-model="address" required />
        </div>
        <div class="form-row">
          <label>Филиал:</label>
          <select v-model="branch" required>
            <option v-for="b in branches" :key="b" :value="b">{{ b }}</option>
          </select>
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
import axios from 'axios';
export default {
  props: { branches: { type: Array, required: true } },
  emits: ['close', 'student-added'],
  data() {
    return {
      surname: '',
      name: '',
      patronymic: '',
      date: '',
      klass: '',
      order: '',
      address: '',
      branch: this.branches[0] || '',
      error: '',
      saving: false,
    };
  },
  methods: {
    async addStudent() {
      this.error = '';
      this.saving = true;
      try {
        const fio = [this.surname, this.name, this.patronymic].filter(Boolean).join(' ');
        const payload = {
          Фамилия: this.surname,
          Имя: this.name,
          Отчество: this.patronymic,
          Наименование: fio,
          Дата_Поступления: this.date,
          Класс: this.klass,
          Приказ_О_Зачислении: this.order,
          Адрес_Регистрации: this.address,
          Филиал: this.branch,
          Обучение_Статус: true
        };
        await axios.post('/api/RCDO/hs/rcdo/add_ucenic', payload, {
          headers: { Authorization: 'Basic ' + btoa('admin:10028585mM') }
        });
        this.$emit('student-added');
      } catch (e) {
        this.error = 'Ошибка при добавлении ученика: ' + (e.response?.data || e.message);
      } finally {
        this.saving = false;
      }
    }
  }
};
</script>

<style scoped>
.modal-backdrop{position:fixed;z-index:9999;left:0;top:0;right:0;bottom:0;background:rgba(0,0,0,.12);display:flex;justify-content:flex-end;align-items:stretch}
.modal-window{background:#fff;width:400px;max-width:100vw;height:100%;box-shadow:-2px 0 24px rgba(0,0,0,.13);position:relative;padding:36px 28px 20px;animation:slideInPanel .35s cubic-bezier(.33,.9,.56,1.02);overflow-y:auto}
.close-btn{position:absolute;right:16px;top:12px;font-size:22px;background:none;border:none;color:#888;cursor:pointer}
.form-row{margin-bottom:16px;display:flex;flex-direction:column}
.form-row label{font-weight:700;margin-bottom:4px}
.form-row input,.form-row select{font-size:15px;padding:6px 10px;border:1px solid #bbb;border-radius:6px}
.form-actions{margin-top:18px;display:flex;gap:12px}
.error-msg{color:#d32f2f;margin:10px 0 0}
</style>
