<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <div class="modal-window">
      <button class="close-btn" @click="$emit('close')">×</button>
      <h3>Добавить учителя</h3>

      <form @submit.prevent="addTeacher">
        <div class="form-row">
          <label>Филиал:</label>
          <select
            v-model="branch"
            :disabled="lockToBranch || zguLoading || saving"
            required
          >
            <option v-for="b in branchOptions" :key="b" :value="b">{{ b }}</option>
          </select>
        </div>

        <div class="form-row">
          <label>Учитель:</label>
          <select
            v-model="selectedTeacherCode"
            @change="applySelectedTeacher"
            :disabled="zguLoading || saving || !filteredZguTeachers.length"
            required
          >
            <option value="">
              {{
                zguLoading
                  ? 'Загрузка списка учителей...'
                  : filteredZguTeachers.length
                    ? 'Выберите учителя'
                    : 'Нет доступных работающих учителей'
              }}
            </option>
            <option
              v-for="t in filteredZguTeachers"
              :key="t._optionKey"
              :value="t._optionValue"
            >
              {{ formatTeacherOption(t) }}
            </option>
          </select>
        </div>

        <div v-if="zguError" class="error-msg">{{ zguError }}</div>
        <div v-else-if="!zguLoading && branch && !filteredZguTeachers.length" class="hint-msg">
          В выбранном филиале нет доступных работающих учителей.
        </div>

        <div class="form-row">
          <label>Дата приёма на работу:</label>
          <input v-model="date" type="date" readonly required />
        </div>

        <div class="form-row">
          <label>Предмет:</label>
          <input v-model="subject" readonly />
        </div>

        <div class="form-row">
          <label>Адрес регистрации:</label>
          <input v-model="address" readonly />
        </div>

        <div v-if="error" class="error-msg">{{ error }}</div>

        <div class="form-actions">
          <button
            type="submit"
            :disabled="saving || zguLoading || !selectedTeacherCode || !branch"
          >
            {{ saving ? 'Сохранение…' : 'Сохранить' }}
          </button>
          <button type="button" @click="$emit('close')" :disabled="saving">Отмена</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import axios from 'axios'
import http from '@/api/http'

const ZGU_USERNAME = 'Длявыгрузки'
const ZGU_PASSWORD = '1'

function normalizeBranch(v) {
  return typeof v === 'string' ? v.trim() : ''
}

function normalizeString(v) {
  return typeof v === 'string' ? v.trim() : ''
}

function toInputDate(val) {
  if (!val || val === '0001-01-01T00:00:00' || val === 'Не указана') return ''

  if (/^\d{4}-\d{2}-\d{2}/.test(val)) return val.slice(0, 10)

  if (/^\d{2}\.\d{2}\.\d{4}$/.test(val)) {
    const [d, m, y] = val.split('.')
    return `${y}-${m}-${d}`
  }

  const d = new Date(val)
  if (!isNaN(d)) {
    const pad = n => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }

  return ''
}

function parseStatus(raw) {
  if (raw === true || raw === 1 || raw === '1') return true
  if (raw === false || raw === 0 || raw === '0') return false

  const s = String(raw ?? '').trim().toLowerCase()

  if (['да', 'true', 'истина', 'активен', 'работает', 'on', 'yes', 'y'].includes(s)) return true
  if (['нет', 'false', 'ложь', 'неактивен', 'уволен', 'off', 'no', 'n'].includes(s)) return false

  return false
}

function extractTeachersArray(raw) {
  if (Array.isArray(raw)) return raw

  if (typeof raw === 'string') {
    try {
      return extractTeachersArray(JSON.parse(raw))
    } catch {
      return []
    }
  }

  if (!raw || typeof raw !== 'object') return []

  const candidates = [
    raw.teachers,
    raw.items,
    raw.data,
    raw.result,
    raw.rows,
    raw.Данные,
    raw.Учителя
  ]

  for (const item of candidates) {
    if (Array.isArray(item)) return item
  }

  return []
}

function simplifyBranchName(v) {
  return normalizeBranch(v)
    .toLowerCase()
    .replace(/^центр\s+/i, '')
    .replace(/^филиал\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function encodeBasicAuthUtf8(username, password) {
  const source = `${username}:${password}`

  try {
    const bytes = new TextEncoder().encode(source)
    let binary = ''
    for (const b of bytes) binary += String.fromCharCode(b)
    return `Basic ${btoa(binary)}`
  } catch {
    return `Basic ${btoa(unescape(encodeURIComponent(source)))}`
  }
}

const zguClient = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    Accept: 'application/json',
    Authorization: encodeBasicAuthUtf8(ZGU_USERNAME, ZGU_PASSWORD)
  }
})

export default {
  props: {
    branches: { type: Array, required: true },
    lockToBranch: { type: Boolean, default: false },
    userBranch: { type: String, default: '' }
  },
  emits: ['close', 'teacher-added'],
  data() {
    return {
      surname: '',
      name: '',
      patronymic: '',
      date: '',
      subject: '',
      address: '',
      branch: '',
      error: '',
      saving: false,

      zguTeachers: [],
      zguLoading: false,
      zguError: '',
      selectedTeacherCode: '',
      selectedTeacherRawBranch: ''
    }
  },

  computed: {
    availableBranches() {
      const cleaned = []
      const seen = new Set()

      for (const item of this.branches || []) {
        const name = normalizeBranch(item)
        if (!name || name === 'Все' || seen.has(name)) continue
        seen.add(name)
        cleaned.push(name)
      }

      if (this.lockToBranch) {
        const own = normalizeBranch(this.userBranch)
        if (own) return [own]
      }

      return cleaned
    },

    branchOptions() {
      const list = [...this.availableBranches]

      if (this.branch && !list.includes(this.branch)) {
        list.push(this.branch)
      }

      return list
    },

    filteredZguTeachers() {
      let list = (this.zguTeachers || []).filter(t => t.Работа_Статус === true)

      const currentBranch = normalizeBranch(this.branch)
      if (currentBranch) {
        list = list.filter(t => normalizeBranch(t.Филиал) === currentBranch)
      }

      return [...list].sort((a, b) => {
        const af = [a.Фамилия, a.Имя, a.Отчество].filter(Boolean).join(' ')
        const bf = [b.Фамилия, b.Имя, b.Отчество].filter(Boolean).join(' ')
        return af.localeCompare(bf, 'ru')
      })
    }
  },

  watch: {
    branches: {
      immediate: true,
      handler() {
        this.applyBranchRules()
        this.remapTeachersBranches()
      }
    },
    userBranch() {
      this.applyBranchRules()
      this.remapTeachersBranches()
    },
    lockToBranch() {
      this.applyBranchRules()
      this.remapTeachersBranches()
    },
    branch() {
      this.syncSelectionWithBranch()
    }
  },

  mounted() {
    this.applyBranchRules()
    this.fetchZguTeachers()
  },

  methods: {
    resolveBranch(rawBranch) {
      const raw = normalizeBranch(rawBranch)
      const own = normalizeBranch(this.userBranch)
      const ownSimple = simplifyBranchName(own)

      if (!raw) {
        if (this.lockToBranch && own) return own
        return this.availableBranches[0] || ''
      }

      if (this.lockToBranch && own) {
        const rawSimple = simplifyBranchName(raw)
        if (
          rawSimple === ownSimple ||
          rawSimple.includes(ownSimple) ||
          ownSimple.includes(rawSimple)
        ) {
          return own
        }
        return own
      }

      if (this.availableBranches.includes(raw)) return raw

      const rawSimple = simplifyBranchName(raw)

      for (const item of this.availableBranches) {
        const simple = simplifyBranchName(item)
        if (simple === rawSimple) return item
      }

      for (const item of this.availableBranches) {
        const simple = simplifyBranchName(item)
        if (rawSimple.includes(simple) || simple.includes(rawSimple)) {
          return item
        }
      }

      return raw
    },

    normalizeZguTeacher(raw) {
      const surname = normalizeString(raw?.Фамилия)
      const name = normalizeString(raw?.Имя)
      const patronymic = normalizeString(raw?.Отчество)
      const fio =
        normalizeString(raw?.Наименование) ||
        [surname, name, patronymic].filter(Boolean).join(' ')
      const rawBranch = normalizeBranch(raw?.Филиал)
      const resolvedBranch = this.resolveBranch(rawBranch)

      return {
        Код: String(raw?.Код ?? ''),
        Фамилия: surname,
        Имя: name,
        Отчество: patronymic,
        Наименование: fio,
        Дата_Приема_На_Работу: toInputDate(raw?.Дата_Приема_На_Работу),
        Предмет: normalizeString(raw?.Предмет),
        Адрес_Регистрации: normalizeString(raw?.Адрес_Регистрации),
        ФилиалZGU: rawBranch,
        Филиал: resolvedBranch,
        Работа_Статус: parseStatus(raw?.Работа_Статус),
        _optionKey: `${String(raw?.Код ?? '')}::${fio}`,
        _optionValue: String(raw?.Код ?? '')
      }
    },

    async fetchZguTeachers() {
      this.zguLoading = true
      this.zguError = ''

      try {
        const { data } = await zguClient.get('/ZGU/hs/teachers/GetPersData')
        const arr = extractTeachersArray(data)

        this.zguTeachers = arr
          .map(item => this.normalizeZguTeacher(item))
          .filter(item => item.Работа_Статус === true)

        this.syncSelectionWithBranch(true)
      } catch (e) {
        const status = e?.response?.status
        const msg =
          (typeof e?.response?.data === 'string' && e.response.data) ||
          e?.message ||
          'Ошибка'

        if (status === 401) {
          this.zguError = 'Не удалось загрузить список учителей из ZGU: доступ отклонён (401).'
        } else {
          this.zguError = 'Не удалось загрузить список учителей из ZGU: ' + msg
        }

        this.zguTeachers = []
        this.clearTeacherFields(true)
      } finally {
        this.zguLoading = false
      }
    },

    remapTeachersBranches() {
      this.zguTeachers = (this.zguTeachers || []).map(item => ({
        ...item,
        Филиал: this.resolveBranch(item.ФилиалZGU || item.Филиал)
      }))

      this.syncSelectionWithBranch(true)
    },

    applyBranchRules() {
      const list = this.availableBranches || []

      if (this.lockToBranch) {
        this.branch = normalizeBranch(this.userBranch) || list[0] || ''
        return
      }

      if (!this.branch || !list.includes(this.branch)) {
        this.branch = list[0] || ''
      }
    },

    clearTeacherFields(keepBranch = false) {
      this.surname = ''
      this.name = ''
      this.patronymic = ''
      this.date = ''
      this.subject = ''
      this.address = ''
      this.selectedTeacherRawBranch = ''
      this.selectedTeacherCode = ''

      if (!keepBranch) {
        if (this.lockToBranch) {
          this.branch = normalizeBranch(this.userBranch) || (this.availableBranches[0] || '')
        } else {
          this.branch = this.availableBranches[0] || ''
        }
      }
    },

    syncSelectionWithBranch(autoPickSingle = false) {
      const currentCode = String(this.selectedTeacherCode || '')
      const existsInBranch = this.filteredZguTeachers.some(
        t => String(t.Код) === currentCode
      )

      if (!existsInBranch) {
        this.clearTeacherFields(true)
      }

      if (!this.selectedTeacherCode && autoPickSingle && this.filteredZguTeachers.length === 1) {
        this.selectedTeacherCode = this.filteredZguTeachers[0]._optionValue
        this.applySelectedTeacher()
        return
      }

      if (this.selectedTeacherCode) {
        this.applySelectedTeacher()
      }
    },

    applySelectedTeacher() {
      const code = String(this.selectedTeacherCode || '')
      const selected = (this.filteredZguTeachers || []).find(t => String(t.Код) === code)

      if (!selected) {
        this.clearTeacherFields(true)
        return
      }

      this.surname = selected.Фамилия || ''
      this.name = selected.Имя || ''
      this.patronymic = selected.Отчество || ''
      this.date = selected.Дата_Приема_На_Работу || ''
      this.subject = selected.Предмет || ''
      this.address = selected.Адрес_Регистрации || ''
      this.selectedTeacherRawBranch = selected.ФилиалZGU || ''
    },

    formatTeacherOption(t) {
      return [t.Фамилия, t.Имя, t.Отчество].filter(Boolean).join(' ')
    },

    async addTeacher() {
      this.error = ''

      if (!this.selectedTeacherCode) {
        this.error = 'Сначала выберите учителя из списка ZGU.'
        return
      }

      this.saving = true

      try {
        const fio = [this.surname, this.name, this.patronymic].filter(Boolean).join(' ')
        const filialToSave = this.lockToBranch
          ? (normalizeBranch(this.userBranch) || this.branch || this.availableBranches[0] || '')
          : this.branch

        const payload = {
          Фамилия: this.surname,
          Имя: this.name,
          Отчество: this.patronymic,
          Наименование: fio,
          Дата_Приема_На_Работу: this.date,
          Предмет: this.subject,
          Адрес_Регистрации: this.address,
          Филиал: filialToSave,
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
.error-msg {
  margin: 8px 0 12px;
  color: #b91c1c;
  font-size: 14px;
}

.hint-msg {
  margin: 8px 0 12px;
  color: #4b5563;
  font-size: 14px;
}
</style>