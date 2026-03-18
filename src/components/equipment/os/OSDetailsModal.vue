<template>
  <div class="os-side-panel-backdrop" @click.self="$emit('close')">
    <div class="os-side-panel">
      <button class="close-btn" @click="$emit('close')">×</button>
      <h3 class="panel-title">Детали основного средства</h3>

      <div class="panel-scroll">
        <div v-if="osData">
          <p><b>Наименование ОС:</b><br> {{ osData.НаименованиеОС }}</p>

          <template v-if="isGrouped">
            <p>
              <b>Инвентарные номера:</b><br>
              <span v-if="groupInvList.length" class="preline">
                {{ groupInvList.map(n => (n ? n : 'Без инв. номера')).join('\n') }}
              </span>
              <span v-else><em>Нет инвентарных номеров</em></span>
            </p>
            <p><b>Количество (всего):</b> {{ groupTotalQty }}</p>
            <p><b>В договорах:</b> {{ groupQtyInContracts }}</p>
            <p><b>В ином месте:</b> {{ groupQtyInOtherPlaces }}</p>
            <p><b>Не определено:</b> {{ groupQtyUndefined }}</p>
          </template>

          <template v-else>
            <p><b>Инвентарный номер:</b><br> <span class="preline">{{ osData.ИнвентарныйНомер }}</span></p>
          </template>

          <p><b>Стоимость:</b><br> {{ osData.СтоимостьПоследняя }}</p>
          <p><b>Ответственный:</b><br> {{ osData.МатериальноОтветственный }}</p>
          <p><b>Филиал:</b><br> {{ osData.Филиал }}</p>

          <p v-if="!canEditCurrentOsByBranch" class="muted" style="margin-top: 10px;">
            Редактирование данных чужого филиала запрещено.
          </p>
        </div>

        <hr>

        <template v-if="!isGrouped">
          <div v-if="dogovorLoading" style="margin: 24px 0;">
            <span class="small-spinner"></span> Загрузка данных договора...
          </div>
          <div v-else>
            <h4>Договор</h4>
            <template v-if="dogovorData">
              <p><b>Номер:</b> {{ dogovorData.Номер_Договора }}</p>
              <p><b>Дата подписания:</b> {{ dogovorData.Дата_Подписания }}</p>
              <p><b>Тип:</b> {{ dogovorData.Пользователь }}</p>
              <p><b>ФИО:</b> {{ dogovorData.ФИО }}</p>
              <p><b>Филиал:</b> {{ dogovorData.Филиал }}</p>
            </template>
            <p v-else><em>Договор для этого ОС не найден.</em></p>
          </div>
        </template>

        <template v-else>
          <h4>Договор / местонахождение по позициям</h4>

          <div class="group-hint">
            Позиция может быть: в договоре <b>(НомерДоговора)</b> или в ином месте <b>(ИноеМестоНахождения)</b>.
            Если оба пустые — <b>не определено</b>.
          </div>

          <div v-if="!canEditCurrentOsByBranch" class="muted" style="margin: 8px 0 12px;">
            Редактирование строк группового учёта чужого филиала запрещено.
          </div>

          <div v-if="groupRows.length" class="group-table-wrap">
            <table class="group-table">
              <thead>
                <tr>
                  <th style="width: 34%;">Инв. номер</th>
                  <th style="width: 10%;">Кол-во</th>
                  <th style="width: 22%;">Договор</th>
                  <th>Иное место</th>
                  <th style="width: 120px;"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in groupRows" :key="row._key" :class="{ 'undef-row': row.kind === 'undef' }">
                  <td class="preline">
                    {{ row.inv ? row.inv : 'Без инв. номера' }}
                  </td>
                  <td>{{ row.qty }}</td>
                  <td>
                    <span v-if="row.kind === 'contract'">№{{ row.contractNo }}</span>
                    <span v-else class="muted">—</span>
                  </td>
                  <td class="preline">
                    <template v-if="isEditingGroupRow(row)">
                      <textarea v-model="groupEditValue" rows="2" style="width:100%;"></textarea>
                      <div class="row-edit-actions">
                        <button class="save-btn" @click="saveGroupRow(row)" :disabled="groupSaving">
                          {{ groupSaving ? 'Сохранение...' : 'Сохранить' }}
                        </button>
                        <button class="cancel-btn" @click="cancelGroupEdit" :disabled="groupSaving">Отмена</button>
                      </div>
                      <div v-if="groupErrorMsg" class="edit-error">{{ groupErrorMsg }}</div>
                    </template>

                    <template v-else>
                      <span v-if="row.kind === 'inoe'">{{ row.inoe }}</span>
                      <span v-else-if="row.kind === 'undef'"><span class="dot">🔴</span> Не определено</span>
                      <span v-else class="muted">—</span>
                    </template>
                  </td>
                  <td class="actions">
                    <template v-if="row.kind !== 'contract' && !isEditingGroupRow(row) && canEditCurrentOsByBranch">
                      <button class="edit-btn" @click="startGroupEdit(row)">
                        Редактировать
                      </button>
                    </template>
                    <span v-else class="muted"> </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-else>
            <em>Нет данных “ВДоговорах”.</em>
          </div>

          <div style="margin-top: 14px;">
            <div v-if="groupDogovorsLoading">
              <span class="small-spinner"></span> Загрузка сведений по договорам...
            </div>

            <template v-else-if="groupDogovors.length">
              <h4 style="margin-top: 14px;">Договоры, в которых находится оборудование</h4>
              <div class="contract-cards">
                <div class="contract-card" v-for="d in groupDogovors" :key="String(d.Номер_Договора)">
                  <p><b>Номер:</b> {{ d.Номер_Договора }}</p>
                  <p><b>Дата подписания:</b> {{ d.Дата_Подписания }}</p>
                  <p><b>Тип:</b> {{ d.Пользователь }}</p>
                  <p><b>ФИО:</b> {{ d.ФИО }}</p>
                  <p><b>Филиал:</b> {{ d.Филиал }}</p>
                </div>
              </div>
            </template>

            <template v-else-if="groupContractNumbers.length">
              <p class="muted">
                Договоры: {{ groupContractNumbers.join(', ') }} (детали не найдены или недоступны).
              </p>
            </template>
          </div>
        </template>

        <hr>
        <h4>Иное место нахождения (примечания)</h4>

        <template v-if="!isGrouped">
          <div v-if="!editMode">
            <p v-if="osData && osData.ИноеМестоНахождения && osData.ИноеМестоНахождения.trim()">
              {{ osData.ИноеМестоНахождения }}
            </p>
            <p v-else><em>Примечаний пока нет.</em></p>

            <button v-if="canEditCurrentOsByBranch" @click="startEdit" class="edit-btn">Редактировать</button>
            <p v-else class="muted">Редактирование данных чужого филиала запрещено.</p>
          </div>

          <div v-else>
            <textarea v-model="editInoe" rows="3" style="width: 100%;"></textarea>
            <div style="margin-top: 10px;">
              <button @click="saveInoe" :disabled="saving" class="save-btn">
                {{ saving ? 'Сохранение...' : 'Сохранить' }}
              </button>
              <button @click="cancelEdit" :disabled="saving" class="cancel-btn">Отмена</button>
            </div>
            <div v-if="errorMsg" class="edit-error">{{ errorMsg }}</div>
          </div>
        </template>

        <template v-else>
          <p class="muted">
            Для группового учёта примечания (иное место) задаются <b>по позициям</b> в таблице выше.
          </p>
        </template>

        <hr>
        <h4>История перемещений</h4>

        <div v-if="isGrouped" class="history-select">
          <label>Инв. номер для истории:</label>
          <select v-model="selectedInvForHistory">
            <option value="">— выбрать —</option>
            <option v-for="n in groupInvList" :key="String(n)" :value="String(n)">
              {{ n }}
            </option>
          </select>
          <div class="muted" style="margin-top:6px;">
            История доступна только для позиций с инвентарным номером.
          </div>
        </div>

        <div v-if="historyLoading" style="margin: 10px 0;">
          <span class="small-spinner"></span> Загрузка истории...
        </div>

        <div v-else>
          <div v-if="osHistory && osHistory.length" class="history-wrap">
            <table class="history-table">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Событие</th>
                  <th>Договор</th>
                  <th>Комментарий</th>
                  <th>Пользователь</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, idx) in osHistory" :key="idx">
                  <td>{{ item.ДатаСобытия }}</td>
                  <td>{{ item.ТипСобытия }}</td>
                  <td>{{ item.Договор }}</td>
                  <td>{{ item.Комментарий }}</td>
                  <td>{{ item.Пользователь }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else>
            <em v-if="historyError">{{ historyError }}</em>
            <em v-else>Нет истории перемещений по данному ОС.</em>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script>
import { ref, watch, computed, onMounted, onBeforeUnmount } from 'vue'
import http from '@/api/http'

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

export default {
  props: {
    osData: Object,
    dogovorData: Object,
    dogovorLoading: Boolean
  },
  emits: ['close', 'inoe-updated', 'gu-updated'],
  setup(props, { emit }) {
    const safeTrim = (v) => (v == null ? '' : String(v)).trim()

    const rights = ref(readRights())
    const userFilial = ref(readUserFilial() || '')

    const canEditOtherFilialData = computed(() => !!rights.value['РедактированиеДанныхЧужогоФилиала'])
    const currentOsFilial = computed(() => safeTrim(props.osData?.Филиал))
    const canEditCurrentOsByBranch = computed(() => {
      if (canEditOtherFilialData.value) return true

      const own = safeTrim(userFilial.value)
      const osFilial = safeTrim(currentOsFilial.value)

      if (!own || !osFilial) return true
      return own === osFilial
    })

    const refreshAuthContext = () => {
      rights.value = readRights()
      userFilial.value = readUserFilial() || ''
    }

    function onAuthRelatedChange() {
      refreshAuthContext()
    }

    const isGrouped = computed(() => {
      const t = safeTrim(props.osData?.ТипУчета)
      if (t === 'Групповой') return true
      if (Array.isArray(props.osData?.ВДоговорах)) return true
      if (props.osData?.Количество != null && props.osData?.КолВДоговорах != null) return true
      return false
    })

    const normalizeVD = (arr) => {
      if (!Array.isArray(arr)) return []
      return arr
        .map((r) => {
          const nd = safeTrim(r?.НомерДоговора)
          const inv = safeTrim(r?.ИнвентарныйНомер)
          const inoe = safeTrim(r?.ИноеМестоНахождения)
          const qty = Number(r?.Количество || 0) || 0

          return {
            ...r,
            НомерДоговора: nd,
            ИнвентарныйНомер: inv,
            ИноеМестоНахождения: inoe,
            Количество: qty
          }
        })
        .filter((r) => r.Количество > 0)
        .filter((r) => {
          const nd = safeTrim(r.НомерДоговора)
          const inv = safeTrim(r.ИнвентарныйНомер)
          const inoe = safeTrim(r.ИноеМестоНахождения)
          const ndOk = nd && nd !== '0'
          return Boolean(inv || inoe || ndOk)
        })
    }

    const editMode = ref(false)
    const editInoe = ref('')
    const saving = ref(false)
    const errorMsg = ref('')

    const osHistory = ref([])
    const historyLoading = ref(false)
    const historyError = ref('')
    const selectedInvForHistory = ref('')

    const loadOsHistory = async (invNumber) => {
      const inv = safeTrim(invNumber)
      if (!inv) {
        osHistory.value = []
        historyError.value = ''
        return
      }
      historyLoading.value = true
      osHistory.value = []
      historyError.value = ''
      try {
        const { data } = await http.get('/RCDO/hs/rcdo/OSHISTORY', { params: { inv: String(inv) } })
        const parsed = typeof data === 'string' ? JSON.parse(data) : data

        if (Array.isArray(parsed)) {
          osHistory.value = parsed
          historyError.value = ''
        } else if (parsed && parsed.error) {
          osHistory.value = []
          historyError.value = parsed.error
        } else {
          osHistory.value = []
          historyError.value = ''
        }
      } catch (e) {
        osHistory.value = []
        if (e.response?.data && typeof e.response.data === 'object' && e.response.data.error) {
          historyError.value = e.response.data.error
        } else {
          historyError.value = 'Ошибка загрузки истории'
        }
      } finally {
        historyLoading.value = false
      }
    }

    const groupVDogovorah = ref([])
    const groupEditKey = ref('')
    const groupEditValue = ref('')
    const groupSaving = ref(false)
    const groupErrorMsg = ref('')

    const groupInvList = computed(() => {
      const d = props.osData || {}

      if (Array.isArray(d._invList) && d._invList.length) {
        return d._invList.map(x => safeTrim(x)).filter(x => x && x !== 'Без номера')
      }

      if (Array.isArray(d.ИнвентарныйНомера) && d.ИнвентарныйНомера.length) {
        return d.ИнвентарныйНомера
          .map(r => safeTrim(r?.ИнвентарныйНомер))
          .filter(Boolean)
      }

      const raw = safeTrim(d.ИнвентарныйНомер)
      if (!raw) return []
      return raw
        .split('\n')
        .map(s => safeTrim(s.replace('🔴', '')))
        .filter(Boolean)
        .filter(s => s !== 'Групповой учёт' && s !== 'Групповой учет')
    })

    const groupTotalQty = computed(() => Number(props.osData?.Количество || 0))

    const groupContractNumbers = computed(() => {
      const set = new Set()
      for (const r of groupVDogovorah.value) {
        const nd = safeTrim(r?.НомерДоговора)
        if (nd && nd !== '0') set.add(nd)
      }
      return Array.from(set).sort((a, b) => Number(a) - Number(b))
    })

    const groupQtyInContracts = computed(() => {
      let sum = 0
      for (const r of groupVDogovorah.value) {
        const nd = safeTrim(r?.НомерДоговора)
        const qty = Number(r?.Количество || 0)
        if (nd && nd !== '0') sum += qty
      }
      return sum
    })

    const groupQtyInOtherPlaces = computed(() => {
      let sum = 0
      for (const r of groupVDogovorah.value) {
        const nd = safeTrim(r?.НомерДоговора)
        const inoe = safeTrim(r?.ИноеМестоНахождения)
        const qty = Number(r?.Количество || 0)
        if ((!nd || nd === '0') && inoe) sum += qty
      }
      return sum
    })

    const groupQtyUndefined = computed(() => {
      const total = groupTotalQty.value
      const used = groupQtyInContracts.value + groupQtyInOtherPlaces.value
      const rest = total - used
      return rest < 0 ? 0 : rest
    })

    const groupRows = computed(() => {
      const rows = []
      const normalized = normalizeVD(groupVDogovorah.value)

      normalized.forEach((r, idx) => {
        const inv = safeTrim(r?.ИнвентарныйНомер)
        const qty = Number(r?.Количество || 0) || 0
        const nd = safeTrim(r?.НомерДоговора)
        const inoe = safeTrim(r?.ИноеМестоНахождения)

        let kind = 'undef'
        let contractNo = ''
        if (nd && nd !== '0') {
          kind = 'contract'
          contractNo = nd
        } else if (inoe) {
          kind = 'inoe'
        } else {
          kind = 'undef'
        }

        rows.push({
          _key: inv ? `vd:inv:${inv}` : `vd:noinv:${idx}`,
          src: 'vdogovorah',
          inv,
          qty,
          kind,
          contractNo,
          inoe
        })
      })

      const usedInv = new Set(
        normalized
          .map(r => safeTrim(r?.ИнвентарныйНомер))
          .filter(Boolean)
      )

      const invs = groupInvList.value
      const missingInvs = invs.filter(inv => inv && !usedInv.has(inv))

      missingInvs.forEach((inv) => {
        rows.push({
          _key: `syn:undefinv:${inv}`,
          src: 'synthetic',
          inv,
          qty: 1,
          kind: 'undef',
          contractNo: '',
          inoe: ''
        })
      })

      const qtyFromVD = normalized.reduce((acc, r) => acc + (Number(r?.Количество || 0) || 0), 0)
      const shownQty = qtyFromVD + missingInvs.length
      const remainder = groupTotalQty.value - shownQty

      if (remainder > 0) {
        rows.push({
          _key: 'syn:undef_noinv_remainder',
          src: 'synthetic',
          inv: '',
          qty: remainder,
          kind: 'undef',
          contractNo: '',
          inoe: ''
        })
      }

      const order = { contract: 1, inoe: 2, undef: 3 }
      rows.sort((a, b) => (order[a.kind] - order[b.kind]) || String(a.inv).localeCompare(String(b.inv)))

      return rows
    })

    const isEditingGroupRow = (row) => groupEditKey.value === row._key

    const startGroupEdit = (row) => {
      if (!canEditCurrentOsByBranch.value) {
        groupErrorMsg.value = 'Редактирование данных чужого филиала запрещено.'
        return
      }

      groupErrorMsg.value = ''
      groupEditKey.value = row._key
      groupEditValue.value = row.kind === 'inoe' ? (row.inoe || '') : ''
    }

    const cancelGroupEdit = () => {
      groupEditKey.value = ''
      groupEditValue.value = ''
      groupErrorMsg.value = ''
    }

    const saveGroupRow = async (row) => {
      if (!props.osData?.Код) return
      if (!canEditCurrentOsByBranch.value) {
        groupErrorMsg.value = 'Редактирование данных чужого филиала запрещено.'
        return
      }

      groupSaving.value = true
      groupErrorMsg.value = ''

      try {
        const userLogin = JSON.parse(localStorage.getItem('user'))?.Логин || ''

        const payload = {
          Код: props.osData.Код,
          ИнвентарныйНомер: row.inv || '',
          Количество: String(row.qty || 1),
          ИноеМестоНахождения: groupEditValue.value || '',
          Пользователь: userLogin
        }

        const { data } = await http.post('/RCDO/hs/rcdo/PATCH_GU/', payload)
        const parsed = typeof data === 'string' ? JSON.parse(data) : data

        if (parsed?.ВДоговорах && Array.isArray(parsed.ВДоговорах)) {
          groupVDogovorah.value = normalizeVD(parsed.ВДоговорах)
        } else {
          const inv = row.inv || ''
          const newInoe = safeTrim(groupEditValue.value)

          let idx = groupVDogovorah.value.findIndex(r => {
            const rInv = safeTrim(r?.ИнвентарныйНомер)
            const rNd = safeTrim(r?.НомерДоговора)
            return (rInv === inv) && (!rNd || rNd === '0')
          })

          if (idx === -1 && inv === '') {
            idx = groupVDogovorah.value.findIndex(r => {
              const rInv = safeTrim(r?.ИнвентарныйНомер)
              const rNd = safeTrim(r?.НомерДоговора)
              return (!rInv) && (!rNd || rNd === '0')
            })
          }

          if (newInoe) {
            if (idx !== -1) {
              groupVDogovorah.value[idx].ИноеМестоНахождения = newInoe
              groupVDogovorah.value[idx].Количество = Number(row.qty || 1)
              groupVDogovorah.value[idx].НомерДоговора = ''
              groupVDogovorah.value[idx].ИнвентарныйНомер = inv
            } else {
              groupVDogovorah.value.push({
                НомерДоговора: '',
                ИноеМестоНахождения: newInoe,
                Количество: Number(row.qty || 1),
                ИнвентарныйНомер: inv
              })
            }
          } else {
            if (idx !== -1) groupVDogovorah.value.splice(idx, 1)
          }

          groupVDogovorah.value = normalizeVD(groupVDogovorah.value)
        }

        emit('gu-updated', { Код: props.osData.Код, ВДоговорах: groupVDogovorah.value })

        cancelGroupEdit()
      } catch (e) {
        const msg =
          (e.response?.data && typeof e.response.data === 'string' ? e.response.data : '') ||
          (e.response?.data && typeof e.response.data === 'object' ? JSON.stringify(e.response.data) : '') ||
          e.message ||
          'Ошибка'
        groupErrorMsg.value = 'Ошибка при сохранении: ' + msg
      } finally {
        groupSaving.value = false
      }
    }

    const groupDogovors = ref([])
    const groupDogovorsLoading = ref(false)

    const loadGroupDogovors = async () => {
      groupDogovors.value = []
      const nums = groupContractNumbers.value
      if (!nums.length) return

      groupDogovorsLoading.value = true
      try {
        const { data } = await http.get('/RCDO/hs/rcdo/ucenicidogovora')
        const parsed = typeof data === 'string' ? JSON.parse(data) : data
        const arr = Array.isArray(parsed?.договоры) ? parsed.договоры : []
        groupDogovors.value = arr.filter(d => nums.includes(String(d.Номер_Договора)))
      } catch {
        groupDogovors.value = []
      } finally {
        groupDogovorsLoading.value = false
      }
    }

    const startEdit = () => {
      if (!canEditCurrentOsByBranch.value) {
        errorMsg.value = 'Редактирование данных чужого филиала запрещено.'
        return
      }

      editInoe.value = props.osData?.ИноеМестоНахождения || ''
      editMode.value = true
      errorMsg.value = ''
    }

    const cancelEdit = () => {
      editMode.value = false
      errorMsg.value = ''
    }

    const saveInoe = async () => {
      if (!props.osData || !props.osData.Код) return
      if (!canEditCurrentOsByBranch.value) {
        errorMsg.value = 'Редактирование данных чужого филиала запрещено.'
        return
      }

      saving.value = true
      errorMsg.value = ''
      try {
        const userLogin = JSON.parse(localStorage.getItem('user'))?.Логин || ''
        const { data } = await http.post('/RCDO/hs/rcdo/PATCH_OS/', {
          Код: props.osData.Код,
          ИноеМестоНахождения: editInoe.value,
          Пользователь: userLogin
        })

        const parsed = typeof data === 'string' ? JSON.parse(data) : data

        if (parsed?.history && Array.isArray(parsed.history)) {
          osHistory.value = parsed.history
        } else if (props.osData?.ИнвентарныйНомер) {
          await loadOsHistory(props.osData.ИнвентарныйНомер)
        }

        emit('inoe-updated', { Код: props.osData.Код, ИноеМестоНахождения: editInoe.value })
        editMode.value = false
      } catch (e) {
        errorMsg.value = 'Ошибка при сохранении: ' + (e.response?.data || e.message)
      } finally {
        saving.value = false
      }
    }

    watch(() => props.osData, async (val) => {
      editMode.value = false
      editInoe.value = val?.ИноеМестоНахождения || ''
      errorMsg.value = ''

      cancelGroupEdit()

      if (isGrouped.value) {
        const src = Array.isArray(val?.ВДоговорах) ? val.ВДоговорах : []
        groupVDogovorah.value = normalizeVD(JSON.parse(JSON.stringify(src || [])))
        await loadGroupDogovors()
      } else {
        groupVDogovorah.value = []
        groupDogovors.value = []
      }

      osHistory.value = []
      historyError.value = ''

      if (isGrouped.value) {
        selectedInvForHistory.value = groupInvList.value[0] ? String(groupInvList.value[0]) : ''
        if (selectedInvForHistory.value) {
          await loadOsHistory(selectedInvForHistory.value)
        }
      } else {
        if (val?.ИнвентарныйНомер) {
          await loadOsHistory(val.ИнвентарныйНомер)
        }
      }
    }, { immediate: true })

    watch(selectedInvForHistory, async (inv) => {
      if (!isGrouped.value) return
      if (!inv) {
        osHistory.value = []
        historyError.value = ''
        return
      }
      await loadOsHistory(inv)
    })

    onMounted(() => {
      refreshAuthContext()
      window.addEventListener('auth-changed', onAuthRelatedChange)
      window.addEventListener('storage', onAuthRelatedChange)
    })

    onBeforeUnmount(() => {
      window.removeEventListener('auth-changed', onAuthRelatedChange)
      window.removeEventListener('storage', onAuthRelatedChange)
    })

    return {
      isGrouped,
      canEditCurrentOsByBranch,

      editMode,
      editInoe,
      saving,
      errorMsg,
      startEdit,
      cancelEdit,
      saveInoe,

      osHistory,
      historyLoading,
      historyError,
      selectedInvForHistory,

      groupInvList,
      groupTotalQty,
      groupQtyInContracts,
      groupQtyInOtherPlaces,
      groupQtyUndefined,
      groupRows,
      groupEditValue,
      groupSaving,
      groupErrorMsg,
      isEditingGroupRow,
      startGroupEdit,
      cancelGroupEdit,
      saveGroupRow,

      groupContractNumbers,
      groupDogovors,
      groupDogovorsLoading
    }
  }
}
</script>

<style scoped>
.os-side-panel-backdrop {
  position: fixed;
  z-index: 9999;
  inset: 0;
  background: rgba(0,0,0,0.12);
  display: flex;
  justify-content: flex-end;
}
.os-side-panel {
  background: #fff;
  width: 650px;
  max-width: 100vw;
  height: 100vh;
  box-shadow: -2px 0 24px rgba(0,0,0,0.13);
  position: relative;
  padding: 36px 28px 20px 28px;
  animation: slideInPanel .35s cubic-bezier(.33,.9,.56,1.02);
  display: flex;
  flex-direction: column;
}
.panel-title { margin: 0 0 8px; }

.panel-scroll {
  overflow: auto;
  max-height: calc(100vh - 76px);
  padding-bottom: 4px;
}

@keyframes slideInPanel {
  from { transform: translateX(100%); opacity: 0.3; }
  to   { transform: translateX(0);   opacity: 1; }
}
.close-btn {
  position: absolute; right: 18px; top: 12px; border: none; background: none;
  font-size: 26px; color: #333; cursor: pointer;
}

.preline { white-space: pre-line; }
.muted { color: #7a7a7a; }
.dot { margin-right: 6px; }

.small-spinner {
  display: inline-block;
  width: 18px;
  height: 18px;
  border: 2px solid #b8b8b8;
  border-top: 2px solid #409eff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  margin-right: 8px;
  vertical-align: middle;
}
@keyframes spin { 0% { transform: rotate(0deg) } 100% { transform: rotate(360deg) } }

.edit-btn, .save-btn, .cancel-btn {
  margin: 0 3px;
  padding: 3px 10px;
  font-size: 13px;
  border-radius: 6px;
  border: 1px solid #bbb;
  background: #f7f7f7;
  cursor: pointer;
}
.edit-btn:hover, .save-btn:hover { background: #e9f3ff; border-color: #409eff; }
.cancel-btn:hover { background: #fff2f2; border-color: #ff8888; }
.edit-error { color: #d03a3a; margin-top: 8px; white-space: pre-wrap; word-break: break-word; }

.history-wrap {
  max-height: 50vh;
  overflow: auto;
  border: 1px solid #e7e7e7;
  border-radius: 6px;
}
.history-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.history-table th,
.history-table td {
  border-bottom: 1px solid #eee;
  padding: 6px 8px;
}
.history-table thead th {
  background: #f8f8f8;
  font-weight: 600;
  position: sticky;
  top: 0;
  z-index: 1;
  border-bottom: 1px solid #ddd;
}

.history-select {
  margin: 8px 0 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.history-select select {
  max-width: 320px;
  padding: 6px 8px;
  border: 1px solid #ced4da;
  border-radius: 6px;
}

.group-hint {
  color: #555;
  font-size: 13px;
  margin: 6px 0 10px;
}

.group-table-wrap {
  border: 1px solid #e7e7e7;
  border-radius: 8px;
  overflow: hidden;
}
.group-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.group-table th, .group-table td {
  border-bottom: 1px solid #eee;
  padding: 8px 8px;
  vertical-align: top;
}
.group-table thead th {
  background: #f8f8f8;
  font-weight: 600;
}
.undef-row {
  background: rgba(255, 224, 230, 0.45);
}
.actions { text-align: right; }
.row-edit-actions {
  margin-top: 6px;
  display: flex;
  gap: 6px;
  justify-content: flex-end;
}

.contract-cards {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
  margin-top: 8px;
}
.contract-card {
  border: 1px solid #e7e7e7;
  border-radius: 8px;
  padding: 10px 12px;
  background: #fff;
}
</style>