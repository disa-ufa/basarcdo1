<!-- src/components/contracts/ContractDetailsModal.vue -->
<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import http from '@/api/http'

const props = defineProps({
  visible: Boolean,
  loading: Boolean,
  error: String,
  errorDetails: String,
  contractData: Object,
  contractRaw: Object,
  formatDate: Function,
  formatDateTime: Function,
  formatCurrency: Function,
  autoEdit: Boolean
})
const emit = defineEmits(['close', 'retry'])

const isEditing = ref(false)
const editedEquipment = ref([])

const allOs = ref([])
const availableOs = ref([])
const filialMols = ref([])
const availableMz = ref([])

const groupedRaw = ref([])
const groupedRows = ref([])
const searchGroup = ref('')

const searchOs = ref('')
const searchMz = ref('')
const saving = ref(false)
const saveError = ref('')
const tab = ref('os')
const showHoz = ref(false)

const rights = ref(readRights())
const userFilial = ref(normalizeBranch(readUserFilial()))

const canEditOtherFilialData = computed(() => !!rights.value['РедактированиеДанныхЧужогоФилиала'])
const currentContractBranch = computed(() => normalizeBranch(props.contractData?.Филиал || props.contractRaw?.договор?.Филиал))

const canEditCurrentContractByBranch = computed(() => {
  if (canEditOtherFilialData.value) return true

  const own = normalizeBranch(userFilial.value)
  const contractBranch = normalizeBranch(currentContractBranch.value)

  if (!own || !contractBranch) return true
  return own === contractBranch
})

function readRights() {
  try {
    const u = JSON.parse(localStorage.getItem('user') || 'null')
    return (u && u.rights) ? u.rights : {}
  } catch {
    return {}
  }
}

function readUserFilial() {
  const direct = localStorage.getItem('filial')
    || localStorage.getItem('Филиал')
    || localStorage.getItem('branch')

  if (direct && direct.trim()) return direct.trim()

  try {
    const u = JSON.parse(localStorage.getItem('user') || 'null')
    const cand =
      u?.filial ?? u?.Филиал ?? u?.branch ?? u?.Branch ?? u?.profile?.filial ?? u?.profile?.Филиал
    if (typeof cand === 'string' && cand.trim()) return cand.trim()
  } catch {
    return null
  }

  return null
}

function normalizeBranch(v) {
  return typeof v === 'string' ? v.trim() : ''
}

function refreshAuthContext() {
  rights.value = readRights()
  userFilial.value = normalizeBranch(readUserFilial())
}

function onAuthRelatedChange() {
  refreshAuthContext()
}

function onClose() {
  isEditing.value = false
  emit('close')
}

function cancelEdit() {
  saveError.value = ''
  isEditing.value = false
}

function round2(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return 0
  return Math.round((x + Number.EPSILON) * 100) / 100
}

function mzUnitPrice(mz) {
  const total = Number(mz?.СтоимостьПоследняя ?? mz?.Стоимость ?? 0)
  const qty = Number(mz?.Количество ?? 0)
  if (!Number.isFinite(total)) return 0
  if (!Number.isFinite(qty) || qty <= 0) return total
  return total / qty
}

function calcTotal(list) {
  if (!Array.isArray(list)) return 0
  let sum = 0
  for (const it of list) {
    const cost = Number(it?.Стоимость ?? 0)
    if (!Number.isFinite(cost)) continue
    if (it?.Тип === 'МЗ') {
      const q = Number(it?.Количество ?? 1)
      const qty = Number.isFinite(q) && q > 0 ? q : 1
      sum += cost * qty
    } else {
      sum += cost
    }
  }
  return round2(sum)
}

watch(
  () => [props.visible, props.contractData, props.autoEdit, canEditCurrentContractByBranch.value],
  async ([v, cd, ae, canEdit]) => {
    if (v && cd && ae && canEdit) {
      isEditing.value = true
      await startEditing()
    }
    if (!v) isEditing.value = false
  },
  { immediate: true }
)

watch(
  () => tab.value,
  async (t) => {
    if (t === 'group' && groupedRaw.value.length === 0 && isEditing.value) {
      await fetchGroupedUchot()
    }
  }
)

async function startEditing() {
  saveError.value = ''

  if (!canEditCurrentContractByBranch.value) {
    saveError.value = 'Редактирование договора чужого филиала запрещено.'
    isEditing.value = false
    return
  }

  editedEquipment.value = props.contractData?.СоставОборудования
    ? JSON.parse(JSON.stringify(props.contractData.СоставОборудования))
    : []

  for (const it of editedEquipment.value) {
    if (it && it.Тип !== 'МЗ') {
      const q = Number(it.Количество ?? 1)
      it.Количество = Number.isFinite(q) && q > 0 ? q : 1
    }
  }

  isEditing.value = true
  await fetchFilialMolsAndMz()
  await fetchAvailableOs()
  await fetchGroupedUchot()

  enrichEditedWithGroupCodesByInv()
}

function getOsInvLabel(item) {
  if (!item) return '—'
  if (item.Тип === 'МЗ') return 'Без номера'
  const inv = (item.ИнвентарныйНомер ?? '').toString().trim()
  return inv ? inv : 'Без номера'
}

function isEquipmentAddedByInv(inv) {
  const needle = (inv ?? '').toString().trim()
  if (!needle) return false
  return editedEquipment.value.some(eq => String(eq?.ИнвентарныйНомер ?? '').trim() === needle)
}

function isEquipmentAdded(os) {
  return isEquipmentAddedByInv(os?.ИнвентарныйНомер)
}

function addEquipment(os) {
  if (!isEquipmentAdded(os)) {
    editedEquipment.value.push({
      ИнвентарныйНомер: os.ИнвентарныйНомер,
      НаименованиеОС: os.НаименованиеОС,
      Стоимость: os.СтоимостьПоследняя,
      Тип: 'ОС',
      Количество: 1
    })
  }
}

function isMzAdded(mz) {
  return editedEquipment.value.some(eq => eq.МЗ_ID === (mz.КодПоБгу || mz.Код))
}

function addMzToContract(mz) {
  const maxCount = (mz.Количество ?? 0) - (mz.КолВДоговорах ?? 0)
  let qty = prompt(`Введите количество (максимум: ${maxCount}):`, 1)
  if (qty === null) return
  qty = Math.max(1, Math.min(maxCount, Number(qty) || 1))
  if (!qty) return

  const unit = round2(mzUnitPrice(mz))

  editedEquipment.value.push({
    МЗ_ID: mz.КодПоБгу || mz.Код,
    НаименованиеМЗ: mz.НаименованиеМЗ,
    Стоимость: unit,
    Количество: qty,
    Тип: 'МЗ'
  })
}

function removeEquipment(idx) {
  editedEquipment.value.splice(idx, 1)
}

async function fetchFilialMolsAndMz() {
  filialMols.value = []
  const filial = props.contractData?.Филиал

  const molResp = await http.get('/RCDO/hs/rcdo/MOL')
  const molData = typeof molResp.data === 'string' ? JSON.parse(molResp.data) : molResp.data
  const found = molData.filialy?.find(f => f.НаименованиеФилиала === filial || f.Наименование === filial)
  if (found) filialMols.value = (found.МОЛы || []).map(x => (x.МОЛ || '').trim()).filter(Boolean)

  const mzResp = await http.get('/RCDO/hs/rcdo/MZ')
  const mzData = typeof mzResp.data === 'string' ? JSON.parse(mzResp.data) : mzResp.data
  availableMz.value = mzData.materialnye_zapasy || mzData.мз || []
}

async function fetchAvailableOs() {
  const filial = props.contractData?.Филиал

  const molResp = await http.get('/RCDO/hs/rcdo/MOL')
  const molData = typeof molResp.data === 'string' ? JSON.parse(molResp.data) : molResp.data
  const found = molData.filialy?.find(f => f.НаименованиеФилиала === filial || f.Наименование === filial)
  let mols = []
  if (found) mols = (found.МОЛы || []).map(x => (x.МОЛ || '').trim()).filter(Boolean)

  const osResp = await http.get('/RCDO/hs/rcdo/OS')
  const osData = typeof osResp.data === 'string' ? JSON.parse(osResp.data) : osResp.data
  allOs.value = osData.osnovnye_sredstva || []

  availableOs.value = (osData.osnovnye_sredstva || []).filter(
    os =>
      mols.includes((os.МатериальноОтветственный || '').trim()) &&
      (os.Договор === 0 || os.Договор === '0' || os.Договор == null)
  )
}

function normalizeGroupedArray(payload) {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== 'object') return []
  return (
    payload.gruppovoy_uchot ||
    payload.gruppovoyUchot ||
    payload.gruppovoi_uchot ||
    payload.gruppUchot ||
    payload.grouped ||
    payload.items ||
    payload.osnovnye_sredstva ||
    payload.основные_средства ||
    payload.групповой_учет ||
    []
  )
}

function groupKeyOf(g) {
  return (g?.КодПоБгу || g?.Код || `${g?.НаименованиеОС || g?.Наименование || 'Группа'}|${g?.МатериальноОтветственный || ''}`).toString()
}

function extractInvNumbers(g) {
  const arr = g?.ИнвентарныйНомера
  if (!Array.isArray(arr)) return []
  return arr.map(x => (x?.ИнвентарныйНомер ?? '').toString().trim()).filter(Boolean)
}

function extractUsedInvSet(g) {
  const set = new Set()
  const vd = g?.ВДоговорах
  if (!Array.isArray(vd)) return set
  for (const it of vd) {
    if (typeof it === 'string') {
      const v = it.trim()
      if (v) set.add(v)
    } else if (it && typeof it === 'object') {
      const v = (it.ИнвентарныйНомер ?? it.inv ?? it.Inv ?? it.Номер ?? it.number ?? '').toString().trim()
      if (v) set.add(v)
    }
  }
  return set
}

function alreadyAddedNoInvQty(gKey) {
  let sum = 0
  for (const eq of editedEquipment.value) {
    const inv = String(eq?.ИнвентарныйНомер ?? '').trim()
    const same = (eq?.__groupKey === gKey) && !inv && (eq?.Тип !== 'МЗ')
    if (!same) continue
    const q = Number(eq?.Количество ?? 1)
    sum += (Number.isFinite(q) && q > 0) ? q : 1
  }
  return sum
}

function buildGroupedRows(groups) {
  const mols = filialMols.value.map(m => (m || '').trim()).filter(Boolean)

  const rows = []
  for (const g of groups) {
    const gKey = groupKeyOf(g)
    const gCode = (g?.Код ?? '').toString().trim()
    const name = (g.НаименованиеОС || g.Наименование || '').toString()
    const mol = (g.МатериальноОтветственный || '').toString().trim()
    const cost = Number(g.СтоимостьПоследняя ?? g.Стоимость ?? 0)

    if (mols.length && !mols.includes(mol)) continue

    const invs = extractInvNumbers(g)
    const used = extractUsedInvSet(g)

    if (invs.length > 0) {
      for (const inv of invs) {
        if (used.has(inv)) continue
        rows.push({
          kind: 'inv',
          groupKey: gKey,
          groupCode: gCode,
          ИнвентарныйНомер: inv,
          НаименованиеОС: name,
          СтоимостьПоследняя: cost,
          МатериальноОтветственный: mol,
          available: 1
        })
      }
    } else {
      const total = Number(g.Количество ?? 0)
      const inContracts = Number(g.КолВДоговорах ?? 0)
      const already = alreadyAddedNoInvQty(gKey)
      const left = Math.max(0, total - inContracts - already)

      rows.push({
        kind: 'noinv',
        groupKey: gKey,
        groupCode: gCode,
        ИнвентарныйНомер: '',
        НаименованиеОС: name,
        СтоимостьПоследняя: cost,
        МатериальноОтветственный: mol,
        available: left,
        total,
        inContracts,
        alreadyAdded: already
      })
    }
  }

  return rows
}

async function fetchGroupedUchot() {
  try {
    const resp = await http.get('/RCDO/hs/rcdo/GruppUchotURL')
    const data = typeof resp.data === 'string' ? JSON.parse(resp.data) : resp.data
    groupedRaw.value = normalizeGroupedArray(data)
    groupedRows.value = buildGroupedRows(groupedRaw.value)
  } catch (e) {
    groupedRaw.value = []
    groupedRows.value = []
    void e
  }
}

function enrichEditedWithGroupCodesByInv() {
  if (!Array.isArray(groupedRaw.value) || groupedRaw.value.length === 0) return

  const inv2code = new Map()
  for (const g of groupedRaw.value) {
    const gCode = (g?.Код ?? '').toString().trim()
    if (!gCode) continue
    for (const inv of extractInvNumbers(g)) {
      if (inv) inv2code.set(inv, gCode)
    }
  }

  for (const it of editedEquipment.value) {
    if (!it || it.Тип === 'МЗ') continue
    const inv = String(it.ИнвентарныйНомер ?? '').trim()
    if (!inv) continue
    if (it.Гу_Код || it.ГУ_Код) continue
    const code = inv2code.get(inv)
    if (code) it.ГУ_Код = code
  }
}

function addGroupedRow(row) {
  if (!row) return

  if (row.kind === 'inv') {
    if (isEquipmentAddedByInv(row.ИнвентарныйНомер)) return
    editedEquipment.value.push({
      ИнвентарныйНомер: row.ИнвентарныйНомер,
      НаименованиеОС: row.НаименованиеОС,
      Стоимость: row.СтоимостьПоследняя,
      Тип: 'ОС',
      Количество: 1,
      ГУ_Код: row.groupCode || '',
      __groupKey: row.groupKey
    })
    return
  }

  const gKey = row.groupKey
  const left = Number(row.available ?? 0)
  if (left <= 0) return

  let qty = prompt(`Введите количество (максимум: ${left}):`, 1)
  if (qty === null) return
  qty = Math.max(1, Math.min(left, Number(qty) || 1))
  if (!qty) return

  editedEquipment.value.push({
    ИнвентарныйНомер: '',
    НаименованиеОС: row.НаименованиеОС,
    Стоимость: row.СтоимостьПоследняя,
    Тип: 'ОС',
    Количество: qty,
    ГУ_Код: row.groupCode || '',
    __groupKey: gKey
  })

  groupedRows.value = buildGroupedRows(groupedRaw.value)
}

const filteredAvailableOs = computed(() => {
  const q = searchOs.value.toLowerCase()
  return availableOs.value
    .filter(os => !isEquipmentAdded(os))
    .filter(os =>
      !q ||
      (os.ИнвентарныйНомер && String(os.ИнвентарныйНомер).toLowerCase().includes(q)) ||
      (os.НаименованиеОС && os.НаименованиеОС.toLowerCase().includes(q))
    )
})

const filteredAvailableMz = computed(() => {
  const q = searchMz.value.toLowerCase()
  const mols = filialMols.value.map(m => (m || '').trim())
  return availableMz.value
    .filter(mz => showHoz.value || !mz.Хоз)
    .filter(mz => (mz.Количество ?? 0) > (mz.КолВДоговорах ?? 0))
    .filter(mz => mols.includes((mz.МатериальноОтветственный || '').trim()))
    .filter(mz =>
      !q ||
      (mz.НаименованиеМЗ && mz.НаименованиеМЗ.toLowerCase().includes(q)) ||
      (mz.Код && String(mz.Код).toLowerCase().includes(q))
    )
    .filter(mz => !isMzAdded(mz))
})

const filteredGroupedRows = computed(() => {
  const q = searchGroup.value.toLowerCase().trim()
  return (groupedRows.value || [])
    .filter(r => {
      if (!q) return true
      const inv = String(r.ИнвентарныйНомер || '').toLowerCase()
      const nm = String(r.НаименованиеОС || '').toLowerCase()
      const mol = String(r.МатериальноОтветственный || '').toLowerCase()
      return inv.includes(q) || nm.includes(q) || mol.includes(q)
    })
    .filter(r => {
      if (r.kind === 'inv') return !isEquipmentAddedByInv(r.ИнвентарныйНомер)
      return Number(r.available ?? 0) > 0
    })
})

async function saveEdit() {
  saveError.value = ''

  if (!canEditCurrentContractByBranch.value) {
    saveError.value = 'Редактирование договора чужого филиала запрещено.'
    return
  }

  saving.value = true
  try {
    const u = JSON.parse(localStorage.getItem('user') || 'null') || {}
    const userLogin = u?.Логин || u?.login || u?.username || u?.name || u?.ФИО || ''

    const payload = {
      СоставОборудования: editedEquipment.value.map(item => {
        if (item.Тип === 'МЗ') {
          return {
            МЗ_ID: item.МЗ_ID,
            НаименованиеМЗ: item.НаименованиеМЗ,
            Стоимость: item.Стоимость,
            Количество: item.Количество,
            Тип: 'МЗ'
          }
        }
        return {
          ИнвентарныйНомер: item.ИнвентарныйНомер ?? '',
          НаименованиеОС: item.НаименованиеОС,
          Стоимость: item.Стоимость,
          Тип: 'ОС',
          Количество: Number(item.Количество ?? 1) || 1,
          ГУ_Код: (item.ГУ_Код ?? '').toString()
        }
      }),
      Пользователь: userLogin
    }

    const nomer =
      props.contractData?.Номер_Договора ??
      props.contractData?.Номер ??
      props.contractRaw?.договор?.Номер_Договора ??
      props.contractRaw?.договор?.Номер

    await http.post('/RCDO/hs/rcdo/RedDogovor', payload, { params: { nomer } })

    isEditing.value = false
    emit('retry')
  } catch (e) {
    saveError.value = e?.response?.data?.message || e?.message || 'Не удалось сохранить изменения'
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  refreshAuthContext()
  window.addEventListener('auth-changed', onAuthRelatedChange)
  window.addEventListener('storage', onAuthRelatedChange)
})

onBeforeUnmount(() => {
  window.removeEventListener('auth-changed', onAuthRelatedChange)
  window.removeEventListener('storage', onAuthRelatedChange)
})
</script>

<template>
  <div v-if="visible" class="modal-overlay" @click.self="onClose">
    <div class="modal-content" style="min-width: 600px">
      <button @click="onClose" class="modal-close-button">&times;</button>

      <h3>Содержимое договора №{{ contractData?.Номер_Договора || contractData?.Номер || '...' }}</h3>

      <div v-if="!isEditing">
        <div v-if="loading" class="loading-indicator modal-loading">
          <span class="spinner"></span> Загрузка деталей...
        </div>

        <div v-if="error" class="error-container modal-error">
          <p class="error-message">{{ error }}</p>
          <p class="error-details" v-if="errorDetails">Техническая информация: {{ errorDetails }}</p>
          <button @click="$emit('retry')" class="retry-button">Обновить</button>
        </div>

        <div v-if="contractData && !loading && !error" class="contract-details">
          <p><strong>№:</strong> {{ contractData.Наименование || contractData.Номер_Договора || contractData.Номер }}</p>
          <p><strong>Дата подписания:</strong> {{ formatDate(contractData.Дата_Подписания) }}</p>
          <p><strong>Пользователь:</strong> {{ contractData.Пользователь }}</p>
          <p><strong>ФИО:</strong> {{ contractData.ФИО }}</p>
          <p><strong>Филиал:</strong> {{ contractData.Филиал }}</p>

          <h4>Состав оборудования ({{ contractData.КоличествоОборудования || 0 }} шт.)</h4>
          <div v-if="contractData.СоставОборудования && contractData.СоставОборудования.length > 0" class="equipment-list">
            <table>
              <thead>
                <tr>
                  <th>Инв. номер</th>
                  <th>Наименование</th>
                  <th>Стоимость</th>
                  <th>Кол-во</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(item, idx) in contractData.СоставОборудования"
                  :key="item.ИнвентарныйНомер || item.МЗ_ID || idx"
                >
                  <td>
                    {{ item.Тип === 'МЗ'
                      ? 'Без номера'
                      : (String(item.ИнвентарныйНомер || '').trim() ? item.ИнвентарныйНомер : 'Без номера')
                    }}
                  </td>
                  <td>{{ item.Тип === 'МЗ' ? item.НаименованиеМЗ : item.НаименованиеОС }}</td>
                  <td>{{ formatCurrency(item.Стоимость) }}</td>
                  <td>{{ item.Тип === 'МЗ' ? item.Количество : (item.Количество || 1) }}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="3" style="text-align: right; font-weight: bold;">Итого</td>
                  <td style="font-weight: bold;">
                    {{ formatCurrency(calcTotal(contractData.СоставОборудования)) }}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p v-else>Состав оборудования не указан.</p>

          <p><small>Данные на: {{ formatDateTime(contractRaw?.датаФормирования) }}</small></p>

          <button
            v-if="canEditCurrentContractByBranch"
            @click="startEditing"
            class="retry-button"
            style="margin-top: 20px;"
          >
            Редактировать
          </button>
          <p
            v-else
            style="margin-top: 16px; color: #6b7280;"
          >
            Редактирование договора чужого филиала запрещено.
          </p>
        </div>
      </div>

      <div v-else>
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
          <button @click="saveEdit" class="retry-button" :disabled="saving">{{ saving ? 'Сохраняю...' : 'Сохранить' }}</button>
          <button @click="cancelEdit" class="retry-button" :disabled="saving">Отмена</button>
        </div>

        <div v-if="saveError" class="error-container modal-error">
          <p class="error-message">{{ saveError }}</p>
        </div>

        <h4>Редактирование состава оборудования</h4>
        <div class="equipment-editor">
          <div>
            <h5>В составе договора</h5>
            <table>
              <thead>
                <tr>
                  <th>Инв. номер</th>
                  <th>Наименование</th>
                  <th>Стоимость</th>
                  <th>Кол-во</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, idx) in editedEquipment" :key="item.ИнвентарныйНомер || item.МЗ_ID || idx">
                  <td>{{ getOsInvLabel(item) }}</td>
                  <td>{{ item.Тип === 'МЗ' ? item.НаименованиеМЗ : item.НаименованиеОС }}</td>
                  <td>{{ formatCurrency(item.Стоимость) }}</td>
                  <td>{{ item.Тип === 'МЗ' ? item.Количество : (item.Количество || 1) }}</td>
                  <td><button @click="removeEquipment(idx)" style="color: red" :disabled="saving">Удалить</button></td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="3" style="text-align:right; font-weight:bold;">Итого</td>
                  <td style="font-weight:bold;">{{ formatCurrency(calcTotal(editedEquipment)) }}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div style="margin-top: 24px;">
            <div style="display: flex; gap: 8px; margin-bottom: 10px;">
              <button :class="{active: tab==='os'}" @click="tab='os'">Основные средства филиала</button>
              <button :class="{active: tab==='mz'}" @click="tab='mz'">Материальные запасы филиала</button>
              <button :class="{active: tab==='group'}" @click="tab='group'">Групповой учот</button>
            </div>

            <div v-if="tab === 'mz'" style="margin-bottom: 10px;">
              <label><input type="checkbox" v-model="showHoz"> Показать хоз. МЗ</label>
              <input v-model="searchMz" placeholder="Поиск по наименованию МЗ" style="margin-left: 10px; padding: 4px; width: 60%;">
            </div>

            <div v-if="tab === 'os'">
              <input v-model="searchOs" placeholder="Поиск по наименованию или инв. номеру" style="margin-bottom: 10px; padding: 4px; width: 60%;">
              <table>
                <thead><tr><th>Инв. номер</th><th>Наименование</th><th>Стоимость</th><th></th></tr></thead>
                <tbody>
                  <tr v-for="os in filteredAvailableOs" :key="os.ИнвентарныйНомер">
                    <td>{{ os.ИнвентарныйНомер }}</td>
                    <td>{{ os.НаименованиеОС }}</td>
                    <td>{{ formatCurrency(os.СтоимостьПоследняя) }}</td>
                    <td><button @click="addEquipment(os)" :disabled="saving">Добавить</button></td>
                  </tr>
                </tbody>
              </table>
              <div v-if="filteredAvailableOs.length === 0" style="padding: 10px 0; color: #888;">Нет доступных ОС</div>
            </div>

            <div v-if="tab === 'mz'">
              <table>
                <thead>
                  <tr>
                    <th>Наименование</th>
                    <th>Стоимость (всего)</th>
                    <th>Стоимость за единицу</th>
                    <th>Доступно</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="mz in filteredAvailableMz" :key="mz.КодПоБгу || mz.Код">
                    <td>{{ mz.НаименованиеМЗ }}</td>
                    <td>{{ formatCurrency(mz.СтоимостьПоследняя) }}</td>
                    <td>{{ formatCurrency(round2(mzUnitPrice(mz))) }}</td>
                    <td>{{ mz.Количество - mz.КолВДоговорах }}</td>
                    <td>
                      <button
                        @click="addMzToContract(mz)"
                        :disabled="saving || (mz.Количество - mz.КолВДоговорах <= 0)"
                      >
                        Добавить
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
              <div v-if="filteredAvailableMz.length === 0" style="padding: 10px 0; color: #888;">Нет доступных МЗ</div>
            </div>

            <div v-if="tab === 'group'">
              <input v-model="searchGroup" placeholder="Поиск по инв. номеру / наименованию / МОЛ" style="margin-bottom: 10px; padding: 4px; width: 60%;">
              <table>
                <thead>
                  <tr>
                    <th>Инв. номер</th>
                    <th>Наименование</th>
                    <th>Стоимость</th>
                    <th>Доступно</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in filteredGroupedRows" :key="row.kind + '|' + (row.ИнвентарныйНомер || 'NOINV') + '|' + row.groupKey">
                    <td>{{ row.kind === 'inv' ? row.ИнвентарныйНомер : 'Без номера' }}</td>
                    <td>{{ row.НаименованиеОС }}</td>
                    <td>{{ formatCurrency(row.СтоимостьПоследняя) }}</td>
                    <td>{{ row.kind === 'inv' ? 1 : row.available }}</td>
                    <td>
                      <button
                        @click="addGroupedRow(row)"
                        :disabled="saving || (row.kind === 'inv' ? false : row.available <= 0)"
                      >
                        Добавить
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>

              <div v-if="filteredGroupedRows.length === 0" style="padding: 10px 0; color: #888;">
                Нет доступного оборудования по групповому учёту
              </div>

              <div v-if="groupedRaw.length === 0" style="padding: 6px 0; color: #aaa;">
                (Источник: /RCDO/hs/rcdo/GruppUchotURL)
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.6); display: flex; justify-content: center; align-items: center; z-index: 1000; padding: 20px; box-sizing: border-box; }
.modal-content { background-color: white; padding: 25px 30px; border-radius: 8px; box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2); position: relative; max-width: 900px; width: 92%; max-height: 90vh; overflow-y: auto; }
.modal-close-button { position: absolute; top: 10px; right: 15px; background: none; border: none; font-size: 28px; line-height: 1; cursor: pointer; color: #888; padding: 0; }
.modal-close-button:hover { color: #333; }
.modal-content h3 { margin-top: 0; margin-bottom: 20px; color: #333; border-bottom: 1px solid #eee; padding-bottom: 10px; }
.contract-details p { margin: 8px 0; line-height: 1.6; }
.contract-details h4 { margin-top: 25px; margin-bottom: 10px; color: #333; border-bottom: 1px solid #eee; padding-bottom: 5px; }
.equipment-list table { width: 100%; border-collapse: collapse; margin-top: 10px; }
.equipment-list th, .equipment-list td { border: 1px solid #ddd; padding: 8px 10px; text-align: left; font-size: 14px; }
.equipment-list th { background-color: #f8f9fa; font-weight: bold; }
.equipment-list tbody tr:nth-child(even) { background-color: #f9f9f9; }
.equipment-list tfoot td { border-top: 2px solid #ccc; }
.modal-loading { margin: 30px 0; text-align: center; }
.modal-error { margin: 20px 0; }
.error-container { margin: 20px 0; padding: 15px; background-color: #fff8f8; border-left: 4px solid #ff5252; border-radius: 4px; }
.error-message { color:#d32f2f; margin-bottom:8px; font-weight:bold; }
.error-details { color:#666; font-size:.9em; margin-bottom:15px; }
.retry-button { background-color:#2196f3; color:white; border:none; padding:8px 16px; border-radius:4px; cursor:pointer; font-weight:bold; }
.retry-button:hover { background-color:#0d8aee; }
.loading-indicator { display:flex; align-items:center; margin:20px 0; }
.spinner { display:inline-block; width:20px; height:20px; margin-right:10px; border:3px solid rgba(0,0,0,.1); border-radius:50%; border-top-color:#2196f3; animation: spin 1s ease-in-out infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.equipment-editor { display:flex; flex-direction:column; gap:20px; }
.equipment-editor table { width:100%; border-collapse:collapse; margin-bottom:10px; }
.equipment-editor th, .equipment-editor td { border:1px solid #ddd; padding:5px 7px; text-align:left; font-size:14px; }
.equipment-editor th { background:#f3f3f3; }
.active { background:#eaf6fd; color:#333; font-weight:bold; }
</style>