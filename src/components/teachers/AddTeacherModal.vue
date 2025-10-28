<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <div class="modal-window">
      <button class="close-btn" @click="$emit('close')">×</button>
      <h3>Добавить учителя</h3>
      <form @submit.prevent="addTeacher">
        <div class="form-row"><label>Фамилия:</label><input v-model="surname" required /></div>
        <div class="form-row"><label>Имя:</label><input v-model="name" required /></div>
        <div class="form-row"><label>Отчество:</label><input v-model="patronymic" /></div>
        <div class="form-row"><label>Дата приёма на работу:</label><input v-model="date" type="date" required /></div>
        <div class="form-row"><label>Предмет:</label><input v-model="subject" /></div>
        <div class="form-row"><label>Адрес регистрации:</label><input v-model="address" /></div>
        <div class="form-row">
          <label>Филиал:</label>
          <select v-model="branch" required>
            <option v-for="b in branches" :key="b" :value="b">{{ b }}</option>
          </select>
        </div>
        <div v-if="error" class="error-msg">{{ error }}</div>
        <div class="form-actions">
          <button type="submit" :disabled="saving">{{ saving ? 'Сохранение…' : 'Сохранить' }}</button>
          <button type="button" @click="$emit('close')" :disabled="saving">Отмена</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import http from '@/api/http'

export default {
  props: { branches: { type: Array, required: true } },
  emits: ['close', 'teacher-added'],
  data() {
    return {
      surname: '',
      name: '',
      patronymic: '',
      date: '',
      subject: '',
      address: '',
      branch: this.branches[0] || '',
      error: '',
      saving: false
    }
  },
  methods: {
    async addTeacher() {
      this.error = ''
      this.saving = true
      try {
        const fio = [this.surname, this.name, this.patronymic].filter(Boolean).join(' ')
        const payload = {
          Фамилия: this.surname,
          Имя: this.name,
          Отчество: this.patronymic,
          Наименование: fio,
          Дата_Приема_На_Работу: this.date,
          Предмет: this.subject,
          Адрес_Регистрации: this.address,
          Филиал: this.branch,
          Работа_Статус: true
        }
        await http.post('/RCDO/hs/rcdo/add_teacher', payload)
        this.$emit('teacher-added')
      } catch (e) {
        this.error = 'Ошибка при добавлении учителя: ' + (e.response?.data || e.message)
      } finally {
        this.saving = false
      }
    }
  }
}
</script>

<style scoped>

</style>
