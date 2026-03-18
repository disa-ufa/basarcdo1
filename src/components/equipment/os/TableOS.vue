<template>
  <div>
    <h2>Список основных средств</h2>

    <div v-if="loading" class="loading-indicator">
      <span class="spinner"></span> Загрузка данных...
    </div>

    <div v-if="error" class="error-container">
      <p class="error-message">{{ error }}</p>
      <p class="error-details" v-if="errorDetails">Техническая информация: {{ errorDetails }}</p>
      <button @click="fetchAll" class="retry-button">Попробовать снова</button>
    </div>

    <div
      class="filter-row"
      v-if="!loading && !error && (filteredResponsiblePersonsList.length > 1 || filterFilialList.length > 0)"
    >
      <div class="filter-inline" v-if="filteredResponsiblePersonsList.length > 1">
        <label for="responsible-filter">Ответственный:</label>
        <select id="responsible-filter" v-model="selectedResponsiblePerson">
          <option v-for="person in filteredResponsiblePersonsList" :key="person" :value="person">
            {{ person }}
          </option>
        </select>
      </div>

      <div class="filter-inline" v-if="filterFilialList.length > 0">
        <label for="filial-filter">Филиал:</label>
        <select
          id="filial-filter"
          v-model="selectedFilial"
          :disabled="!canEditOtherFilialData"
        >
          <option v-for="filial in filterFilialList" :key="filial" :value="filial">
            {{ filial }}
          </option>
        </select>
      </div>
    </div>

    <DataTable
      v-if="!loading && !error"
      :tableData="filteredOsItemsWithIndex"
      :tableColumns="columns"
      initialSortKey="ИнвентарныйНомер"
      initialSortOrder="asc"
      @row-click="handleRowClick"
    />

    <OSDetailsModal
      v-if="showModal"
      :osData="selectedOS"
      :dogovorData="selectedDogovor"
      :dogovorLoading="dogovorLoading"
      @close="closeModal"
      @inoe-updated="handleInoeUpdated"
      @gu-updated="handleGuUpdated"
    />
  </div>
</template>

<script>
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue'
import DataTable from '@/components/shared/DataTable.vue'
import OSDetailsModal from '@/components/equipment/os/OSDetailsModal.vue'
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

function normalizeBranchName(v) {
  return typeof v === 'string' ? v.trim() : ''
}

export default {
  components: { DataTable, OSDetailsModal },
  setup() {
    const columns = ref([
      { key: 'Index', label: '№' },
      { key: 'ТипУчета', label: 'Учёт' },
      { key: 'НаименованиеОС', label: 'НаименованиеОС' },
      { key: 'ИнвентарныйНомер', label: 'Инвентарный номер' },
      { key: 'СтоимостьПоследняя', label: 'Стоимость' },
      { key: 'МатериальноОтветственный', label: 'Ответственный' },
      { key: 'Филиал', label: 'Филиал' },
      { key: 'Местонахождение', label: 'Местонахождение' }
    ])

    const osItems = ref([])
    const filialyData = ref([])
    const loading = ref(true)
    const error = ref(null)
    const errorDetails = ref(null)

    const selectedResponsiblePerson = ref('Все')
    const responsiblePersonsList = ref(['Все'])
    const selectedFilial = ref('Все')
    const filialList = ref(['Все'])

    const rights = ref(readRights())
    const userFilial = ref(normalizeBranchName(readUserFilial()))
    const canEditOtherFilialData = computed(() => !!rights.value['РедактированиеДанныхЧужогоФилиала'])

    const moneyFormatter = new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 2
    })
    const formatMoney = (val) => moneyFormatter.format(Number(val || 0))

    const safeTrim = (v) => (v == null ? '' : String(v)).trim()

    const refreshAuthContext = () => {
      rights.value = readRights()
      userFilial.value = normalizeBranchName(readUserFilial())
    }

    const applyDefaultFilial = () => {
      const own = normalizeBranchName(userFilial.value || readUserFilial())

      if (!canEditOtherFilialData.value) {
        selectedFilial.value = own || 'Все'
        return
      }

      if (own && filialList.value.includes(own)) {
        selectedFilial.value = own
        return
      }

      if (!selectedFilial.value || !filialList.value.includes(selectedFilial.value)) {
        selectedFilial.value = 'Все'
      }
    }

    const activeFilialFilter = computed(() => {
      if (!canEditOtherFilialData.value) {
        return userFilial.value || 'Все'
      }
      return (selectedFilial.value || '').trim() || 'Все'
    })

    const filterFilialList = computed(() => {
      if (!canEditOtherFilialData.value && userFilial.value) {
        return [userFilial.value]
      }
      return filialList.value
    })

    const filteredResponsiblePersonsList = computed(() => {
      const set = new Set()

      for (const item of osItems.value) {
        const filial = normalizeBranchName(item?.Филиал)
        const resp = item?.МатериальноОтветственный ? String(item.МатериальноОтветственный).trim() : ''

        if (!resp) continue
        if (activeFilialFilter.value !== 'Все' && filial !== activeFilialFilter.value) continue

        set.add(resp)
      }

      return ['Все', ...Array.from(set).sort((a, b) => a.localeCompare(b, 'ru'))]
    })

    watch(selectedFilial, (newVal) => {
      if (!canEditOtherFilialData.value) {
        const forced = userFilial.value || 'Все'
        if (newVal !== forced) {
          selectedFilial.value = forced
        }
      }
    })

    watch(filteredResponsiblePersonsList, (list) => {
      if (!list.includes(selectedResponsiblePerson.value)) {
        selectedResponsiblePerson.value = 'Все'
      }
    }, { deep: true })

    function onAuthRelatedChange() {
      refreshAuthContext()
      applyDefaultFilial()
    }

    const fetchFilialy = async () => {
      try {
        const { data } = await http.get('/RCDO/hs/rcdo/MOL')
        const parsed = typeof data === 'string' ? JSON.parse(data) : data
        const filialy = parsed?.filialy ?? parsed?.Filialy ?? parsed?.filials ?? []
        filialyData.value = Array.isArray(filialy) ? filialy : []
      } catch {
        filialyData.value = []
      }
    }

    const resolveFilial = (otvetstvenny) => {
      const resp = safeTrim(otvetstvenny) || 'Не указан'
      for (const f of filialyData.value) {
        if (
          Array.isArray(f.МОЛы) &&
          f.МОЛы.some((mol) => mol?.МОЛ && safeTrim(mol.МОЛ) === resp)
        ) {
          return f.Наименование || f.НаименованиеФилиала || 'Неизвестно'
        }
      }
      return 'Неизвестно'
    }

    const normalizeGuVDogovorah = (arr) => {
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

    const buildGroupedInvAndLocation = (groupItem) => {
      let invList = []

      if (Array.isArray(groupItem?.ИнвентарныйНомера) && groupItem.ИнвентарныйНомера.length > 0) {
        invList = groupItem.ИнвентарныйНомера
          .map((n) => safeTrim(n?.ИнвентарныйНомер || n?.Номер || ''))
          .filter(Boolean)
      } else if (safeTrim(groupItem?.ИнвентарныйНомер)) {
        invList = [safeTrim(groupItem.ИнвентарныйНомер)]
      }

      if (invList.length === 0 && Array.isArray(groupItem?.ВДоговорах)) {
        invList = groupItem.ВДоговорах
          .map((r) => safeTrim(r?.ИнвентарныйНомер || ''))
          .filter(Boolean)
      }

      if (invList.length === 0) invList = ['Без номера']

      const seen = new Set()
      invList = invList.filter((x) => {
        const key = safeTrim(x)
        if (!key) return false
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })

      const vdog = normalizeGuVDogovorah(groupItem?.ВДоговорах || [])
      const contractByInv = new Map()
      const inoeByInv = new Map()

      for (const r of vdog) {
        const inv = safeTrim(r?.ИнвентарныйНомер)
        const nd = safeTrim(r?.НомерДоговора)
        const inoe = safeTrim(r?.ИноеМестоНахождения)

        if (!inv) continue

        if (nd && nd !== '0') {
          if (!contractByInv.has(inv)) contractByInv.set(inv, nd)
        } else if (inoe) {
          if (!inoeByInv.has(inv)) inoeByInv.set(inv, inoe)
        }
      }

      const rows = invList.map((inv) => {
        const nd = contractByInv.get(inv)
        const inoe = inoeByInv.get(inv)

        if (nd) return { inv, mesto: `Договор №${nd}`, undef: false }
        if (inoe) return { inv, mesto: inoe, undef: false }

        return { inv, mesto: 'Не определено', undef: true }
      })

      const allUndef = rows.length > 0 && rows.every((r) => r.undef)

      const invDisplay = rows.map((r) => (r.undef ? `${r.inv} 🔴` : r.inv)).join('\n')
      const mestoDisplay = rows.map((r) => (r.undef ? `🔴 ${r.mesto}` : r.mesto)).join('\n')

      return { invList, invDisplay, mestoDisplay, allUndef }
    }

    const fetchOS = async () => {
      try {
        loading.value = true
        error.value = null
        errorDetails.value = null
        osItems.value = []
        responsiblePersonsList.value = ['Все']
        filialList.value = ['Все']
        selectedResponsiblePerson.value = 'Все'
        selectedFilial.value = 'Все'

        const { data: respRaw } = await http.get('/RCDO/hs/rcdo/OS')
        const responseData = typeof respRaw === 'string' ? JSON.parse(respRaw) : respRaw

        if (!responseData || typeof responseData !== 'object' || !Array.isArray(responseData.osnovnye_sredstva)) {
          throw new Error(
            'Некорректная структура данных в ответе сервера (ожидался объект с массивом "osnovnye_sredstva")'
          )
        }

        const dataArray = responseData.osnovnye_sredstva
        const uniqueResponsible = new Set()
        const uniqueFilials = new Set()

        const baseItems = dataArray.map((item) => {
          const responsible = safeTrim(item.МатериальноОтветственный) || 'Не указан'
          const filial = resolveFilial(responsible)

          uniqueResponsible.add(responsible)
          uniqueFilials.add(filial)

          const invRaw = safeTrim(item.ИнвентарныйНомер)

          let mesto = '—'
          if (item.Договор && safeTrim(item.Договор) !== '' && String(item.Договор) !== '0') {
            mesto = `Договор №${item.Договор}`
          } else if (item.ИноеМестоНахождения && safeTrim(item.ИноеМестоНахождения) !== '') {
            mesto = item.ИноеМестоНахождения
          }

          const noDogovor = !item.Договор || Number(item.Договор) === 0
          const noInoe = !item.ИноеМестоНахождения || safeTrim(item.ИноеМестоНахождения) === ''
          const rowClass = noDogovor && noInoe ? 'os-missing-row' : ''

          return {
            ...item,
            НаименованиеОС: safeTrim(item.НаименованиеОС) || safeTrim(item.Наименование) || 'Без наименования',
            ИнвентарныйНомер: invRaw || 'Нет номера',
            _invRaw: invRaw,
            СтоимостьПоследняя: formatMoney(item.СтоимостьПоследняя),
            МатериальноОтветственный: responsible,
            Филиал: filial,
            Местонахождение: mesto,
            ТипУчета: 'Обычный',
            rowClass
          }
        })

        let groupedItems = []
        const groupedInvSet = new Set()

        try {
          const { data: gruppRaw } = await http.get('/RCDO/hs/rcdo/GruppUchotURL')
          const gruppResp = typeof gruppRaw === 'string' ? JSON.parse(gruppRaw) : gruppRaw

          let gruppArray = []
          if (gruppResp && typeof gruppResp === 'object') {
            if (Array.isArray(gruppResp.gruppovoy_uchot)) gruppArray = gruppResp.gruppovoy_uchot
            else if (Array.isArray(gruppResp.ГрупповойУчёт)) gruppArray = gruppResp.ГрупповойУчёт
            else if (Array.isArray(gruppResp.ГрупповойУчот)) gruppArray = gruppResp.ГрупповойУчот
          }

          groupedItems = gruppArray.map((item) => {
            const responsible = safeTrim(item.МатериальноОтветственный) || 'Не указан'
            const filial = resolveFilial(responsible)

            uniqueResponsible.add(responsible)
            uniqueFilials.add(filial)

            const built = buildGroupedInvAndLocation(item)

            built.invList
              .map((x) => safeTrim(x))
              .filter((x) => x && x !== 'Без номера' && x !== 'Нет номера')
              .forEach((n) => groupedInvSet.add(n))

            const rowClass = `os-group-row${built.allUndef ? ' os-missing-row' : ''}`

            return {
              ...item,
              ВДоговорах: normalizeGuVDogovorah(item?.ВДоговорах || []),
              НаименованиеОС: safeTrim(item.НаименованиеОС) || safeTrim(item.Наименование) || 'Без наименования',
              ИнвентарныйНомер: built.invDisplay,
              Местонахождение: built.mestoDisplay,
              _invList: built.invList,
              СтоимостьПоследняя: formatMoney(item.СтоимостьПоследняя),
              МатериальноОтветственный: responsible,
              Филиал: filial,
              ТипУчета: 'Групповой',
              rowClass,
              Договор: 0
            }
          })
        } catch (e) {
          console.error('Ошибка загрузки данных группового учёта ОС', e)
        }

        const baseItemsNoDup = baseItems.filter((os) => {
          const inv = safeTrim(os._invRaw)
          if (!inv) return true
          return !groupedInvSet.has(inv)
        })

        osItems.value = [...baseItemsNoDup, ...groupedItems]

        if (userFilial.value) {
          uniqueFilials.add(userFilial.value)
        }

        responsiblePersonsList.value = ['Все', ...Array.from(uniqueResponsible).sort((a, b) => a.localeCompare(b, 'ru'))]
        filialList.value = ['Все', ...Array.from(uniqueFilials).sort((a, b) => a.localeCompare(b, 'ru'))]

        applyDefaultFilial()
      } catch (err) {
        if (err.response) {
          error.value = `Ошибка сервера: ${err.response.status}`
          let details = ''
          try {
            details = typeof err.response.data === 'object' ? JSON.stringify(err.response.data) : String(err.response.data)
          } catch {
            details = 'Не удалось обработать ответ сервера'
          }
          errorDetails.value = `Сервер вернул: ${details}`
        } else if (err.code === 'ECONNABORTED' || (err.message && err.message.toLowerCase().includes('timeout'))) {
          error.value = 'Превышено время ожидания ответа от сервера'
          errorDetails.value =
            'Сервер не успел обработать запрос в установленное время (таймаут). Возможно, сервер 1С перегружен, выполняется долгий запрос или недоступен.'
        } else if (err.request) {
          error.value = 'Сервер не отвечает или ошибка сети'
          errorDetails.value =
            'Не удалось получить ответ от сервера. Проверьте доступность сервера 1С, сетевое соединение и настройки прокси (если используется). Ошибка: ' +
            (err.message || 'Нет ответа')
        } else if (err.message && err.message.includes('Network Error')) {
          error.value = 'Ошибка сети или CORS'
          errorDetails.value =
            'Не удалось выполнить запрос из-за сетевой проблемы или ограничений CORS. Проверьте настройки CORS на сервере 1С и сетевую доступность.'
        } else {
          error.value = err.message || 'Не удалось загрузить данные'
          errorDetails.value = err.message ? `Техническая информация: ${err.message}` : 'Неизвестная ошибка'
        }
      } finally {
        loading.value = false
      }
    }

    const fetchAll = async () => {
      loading.value = true
      await fetchFilialy()
      await fetchOS()
    }

    onMounted(() => {
      refreshAuthContext()
      fetchAll()
      window.addEventListener('auth-changed', onAuthRelatedChange)
      window.addEventListener('storage', onAuthRelatedChange)
    })

    onBeforeUnmount(() => {
      window.removeEventListener('auth-changed', onAuthRelatedChange)
      window.removeEventListener('storage', onAuthRelatedChange)
    })

    const filteredOsItems = computed(() => {
      return osItems.value.filter((item) => {
        const byResp =
          selectedResponsiblePerson.value === 'Все' ||
          item.МатериальноОтветственный === selectedResponsiblePerson.value

        const byFilial =
          activeFilialFilter.value === 'Все' ||
          item.Филиал === activeFilialFilter.value

        return byResp && byFilial
      })
    })

    const filteredOsItemsWithIndex = computed(() =>
      filteredOsItems.value.map((item, idx) => ({
        ...item,
        Index: idx + 1
      }))
    )

    const showModal = ref(false)
    const selectedOS = ref(null)
    const selectedDogovor = ref(null)
    const dogovorLoading = ref(false)

    const handleRowClick = async (row) => {
      selectedOS.value = row
      showModal.value = true
      selectedDogovor.value = null

      if (!row.Договор || Number(row.Договор) === 0) return

      dogovorLoading.value = true
      try {
        const { data } = await http.get('/RCDO/hs/rcdo/ucenicidogovora')
        const parsed = typeof data === 'string' ? JSON.parse(data) : data
        const dogovoraArr = Array.isArray(parsed.договоры) ? parsed.договоры : []
        selectedDogovor.value =
          dogovoraArr.find((d) => String(d.Номер_Договора) === String(row.Договор)) || null
      } catch {
        selectedDogovor.value = null
      } finally {
        dogovorLoading.value = false
      }
    }

    const handleInoeUpdated = ({ Код, ИноеМестоНахождения }) => {
      const idx = osItems.value.findIndex((os) => os.Код === Код)
      if (idx !== -1) {
        const cur = { ...osItems.value[idx] }
        cur.ИноеМестоНахождения = ИноеМестоНахождения

        let mesto = '—'
        if (cur.Договор && String(cur.Договор).trim() !== '' && String(cur.Договор) !== '0') {
          mesto = `Договор №${cur.Договор}`
        } else if (ИноеМестоНахождения && String(ИноеМестоНахождения).trim() !== '') {
          mesto = ИноеМестоНахождения
        }
        cur.Местонахождение = mesto

        const noDogovor = !cur.Договор || Number(cur.Договор) === 0
        const noInoe = !ИноеМестоНахождения || String(ИноеМестоНахождения).trim() === ''
        cur.rowClass = noDogovor && noInoe ? 'os-missing-row' : ''

        osItems.value.splice(idx, 1, cur)

        if (selectedOS.value && selectedOS.value.Код === Код) {
          selectedOS.value = { ...selectedOS.value, ...cur }
        }
      }
    }

    const handleGuUpdated = ({ Код, ВДоговорах }) => {
      const idx = osItems.value.findIndex((os) => os.Код === Код)
      if (idx === -1) return

      const cur = { ...osItems.value[idx] }
      cur.ВДоговорах = normalizeGuVDogovorah(ВДоговорах)

      const built = buildGroupedInvAndLocation(cur)
      cur.ИнвентарныйНомер = built.invDisplay
      cur.Местонахождение = built.mestoDisplay
      cur._invList = built.invList
      cur.rowClass = `os-group-row${built.allUndef ? ' os-missing-row' : ''}`

      osItems.value.splice(idx, 1, cur)

      if (selectedOS.value && selectedOS.value.Код === Код) {
        selectedOS.value = { ...selectedOS.value, ...cur }
      }
    }

    const closeModal = () => {
      showModal.value = false
    }

    return {
      columns,
      loading,
      error,
      errorDetails,
      fetchAll,
      selectedResponsiblePerson,
      selectedFilial,
      filteredResponsiblePersonsList,
      filterFilialList,
      filteredOsItemsWithIndex,
      showModal,
      selectedOS,
      selectedDogovor,
      handleRowClick,
      closeModal,
      dogovorLoading,
      handleInoeUpdated,
      handleGuUpdated,
      canEditOtherFilialData
    }
  }
}
</script>

<style scoped>
.loading-indicator {
  text-align: center;
  padding: 20px;
  color: #666;
}
.spinner {
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 3px solid rgba(0, 0, 0, 0.1);
  border-radius: 50%;
  border-top-color: #3498db;
  animation: spin 1s ease-in-out infinite;
  margin-right: 10px;
  vertical-align: middle;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.error-container {
  margin: 20px 0;
  padding: 15px;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
  background-color: #f8d7da;
  color: #721c24;
}
.error-message {
  font-weight: bold;
  margin-bottom: 10px;
}
.error-details {
  font-family: monospace;
  white-space: pre-wrap;
  word-break: break-all;
  margin-bottom: 15px;
  padding: 10px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 3px;
  max-height: 200px;
  overflow-y: auto;
}
.retry-button {
  background-color: #007bff;
  color: white;
  border: none;
  padding: 8px 15px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}
.retry-button:hover {
  background-color: #0056b3;
}
.filter-row {
  display: flex;
  gap: 30px;
  align-items: center;
  margin-bottom: 15px;
  padding: 10px;
  background-color: #e9ecef;
  border-radius: 4px;
}
.filter-inline {
  display: flex;
  align-items: center;
  gap: 10px;
}
.filter-inline label {
  font-weight: bold;
  color: #495057;
}
.filter-inline select {
  padding: 5px 8px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  min-width: 180px;
}
h2 {
  margin-bottom: 20px;
  color: #333;
}
.os-missing-row {
  background-color: #ffe0e6 !important;
}
.os-group-row {
  background-color: #e7f5ff !important;
}
.os-group-row.os-missing-row {
  background-color: #ffe0e6 !important;
}

:deep(table td),
:deep(table th) {
  vertical-align: top;
}
:deep(table td:nth-child(4)),
:deep(table th:nth-child(4)),
:deep(table td:nth-child(8)),
:deep(table th:nth-child(8)) {
  white-space: pre-line !important;
  line-height: 1.25;
}
</style>