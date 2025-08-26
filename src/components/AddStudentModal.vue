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
        // Формируем Наименование как Фамилия + Имя + Отчество (через пробел)
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
@import "./modal-styles.css";
</style>