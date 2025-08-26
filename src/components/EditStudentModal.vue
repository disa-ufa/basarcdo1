<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <div class="modal-window">
      <button class="close-btn" @click="$emit('close')">×</button>
      <h3>Редактировать ученика</h3>
      <form @submit.prevent="saveStudent">
        <div class="form-row"><label>Фамилия:</label><input v-model="surname" required /></div>
        <div class="form-row"><label>Имя:</label><input v-model="name" required /></div>
        <div class="form-row"><label>Отчество:</label><input v-model="patronymic" required /></div>
        <div class="form-row"><label>Дата поступления:</label><input v-model="date" type="date" required /></div>
        <div class="form-row"><label>Класс:</label><input v-model="klass" required /></div>
        <div class="form-row"><label>Приказ о зачислении:</label><input v-model="order" required /></div>
        <div class="form-row"><label>Адрес регистрации:</label><input v-model="address" required /></div>
        <div class="form-row">
          <label>Филиал:</label>
          <select v-model="branch" required>
            <option v-for="b in branches" :key="b" :value="b">{{ b }}</option>
          </select>
        </div>
        <div class="form-row">
          <label>Статус обучения:</label>
          <select v-model="activeStatus" required>
            <option :value="true">Активен</option>
            <option :value="false">Не активен</option>
          </select>
        </div>
        <div class="form-row" v-if="activeStatus === false">
          <label>Приказ об отчислении:</label>
          <input v-model="orderOut" required />
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
import http from '@/api/http'

// Парсинг входящего статуса из любых «Да/Нет/Истина/true/1…» в Boolean
function toBool(v) {
  if (typeof v === 'boolean') return v
  if (v == null) return false
  if (typeof v === 'number') return v !== 0
  const s = String(v).trim().toLowerCase()
  if (['да','истина','true','1','активен','учится','обучается','yes','y'].includes(s)) return true
  return false
}

export default {
  props: {
    branches: { type: Array, required: true },
    student:  { type: Object, required: true }
  },
  emits: ['close', 'student-updated'],
  data() {
    return {
      surname: this.student.Фамилия || (this.student.Наименование ? this.student.Наименование.split(' ')[0] : ''),
      name: this.student.Имя || (this.student.Наименование ? this.student.Наименование.split(' ')[1] : ''),
      patronymic: this.student.Отчество || (this.student.Наименование ? this.student.Наименование.split(' ')[2] : ''),
      date: this.prepareDate(this.student.Дата_Поступления),
      klass: this.student.Класс,
      order: this.student.Приказ_О_Зачислении,
      orderOut: this.student.Приказ_Об_Отчислении || '',
      address: this.student.Адрес_Регистрации,
      branch: this.student.Филиал,
      activeStatus: toBool(this.student.Обучение_Статус), // Boolean в v-model
      error: '',
      saving: false
    }
  },
  methods: {
    prepareDate(val) {
      if (!val || val === 'Не указана' || val === '0001-01-01T00:00:00') return ''
      if (/^\d{4}-\d{2}-\d{2}/.test(val)) return val.substr(0, 10)
      if (/^\d{2}\.\d{2}\.\d{4}/.test(val)) {
        const [d, m, y] = val.split('.')
        return `${y}-${m}-${d}`
      }
      return ''
    },
    async saveStudent() {
      this.error = ''
      this.saving = true
      try {
        const fio = [this.surname, this.name, this.patronymic].filter(Boolean).join(' ')
        const payload = {
          Код: this.student.Код,
          Фамилия: this.surname,
          Имя: this.name,
          Отчество: this.patronymic,
          Наименование: fio,
          Дата_Поступления: this.date,
          Класс: this.klass,
          Приказ_О_Зачислении: this.order,
          Адрес_Регистрации: this.address,
          Филиал: this.branch,
          // <== КЛЮЧЕВОЕ: отправляем булево, которое 1С парсит как Истина/Ложь
          Обучение_Статус: !!this.activeStatus,
          Приказ_Об_Отчислении: this.activeStatus === false ? this.orderOut : ""
        }
        await http.post('/RCDO/hs/rcdo/edit_ucenic', payload)
        this.$emit('student-updated')
      } catch (e) {
        this.error = 'Ошибка при сохранении: ' + (e.response?.data || e.message)
      } finally {
        this.saving = false
      }
    }
  }
}
</script>

<style scoped>
.modal-backdrop{position:fixed;z-index:9999;left:0;top:0;right:0;bottom:0;background:rgba(0,0,0,.12);display:flex;justify-content:flex-end;align-items:stretch}
.modal-window{background:#fff;width:400px;max-width:100vw;height:100%;box-shadow:-2px 0 24px rgba(0,0,0,.13);position:relative;padding:36px 28px 20px;animation:slideInPanel .35s cubic-bezier(.33,.9,.56,1.02);overflow-y:auto}
@keyframes slideInPanel{from{transform:translateX(100%);opacity:.3}to{transform:translateX(0);opacity:1}}
.close-btn{position:absolute;right:16px;top:12px;font-size:22px;background:none;border:none;color:#888;cursor:pointer}
.form-row{margin-bottom:16px;display:flex;flex-direction:column}
.form-row label{font-weight:700;margin-bottom:4px}
.form-row input,.form-row select{font-size:15px;padding:6px 10px;border:1px solid #bbb;border-radius:6px}
.form-actions{margin-top:18px;display:flex;gap:12px}
.error-msg{color:#d32f2f;margin:10px 0 0}
</style>
