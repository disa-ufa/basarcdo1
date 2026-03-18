<template>
  <div class="page">
    <div class="header">
      <h2>Тех анализ — Количественный отчёт ОС</h2>

      <div class="actions">
        <button class="btn" :disabled="loading" @click="fetchAll">
          {{ loading ? 'Загрузка...' : 'Обновить' }}
        </button>
      </div>
    </div>

    <div v-if="error" class="error">
      <div class="error-title">Ошибка: {{ error }}</div>
      <div v-if="errorDetails" class="error-details">{{ errorDetails }}</div>
      <button class="btn" @click="fetchAll">Повторить</button>
    </div>

    <div v-else>
      <!-- KPI -->
      <div class="kpi-grid" v-if="!loading">
        <div class="kpi">
          <div class="kpi-title">Всего единиц (ОС + ГУ)</div>
          <div class="kpi-value">{{ formatInt(kpi.total) }}</div>
        </div>
        <div class="kpi">
          <div class="kpi-title">В договорах</div>
          <div class="kpi-value">{{ formatInt(kpi.inContract) }}</div>
        </div>
        <div class="kpi">
          <div class="kpi-title">Иное место</div>
          <div class="kpi-value">{{ formatInt(kpi.otherPlace) }}</div>
        </div>
        <div class="kpi warn">
          <div class="kpi-title">Неопределено</div>
          <div class="kpi-value">{{ formatInt(kpi.undefined) }}</div>
        </div>
      </div>

      <!-- Filters -->
      <div class="filters" v-if="!loading">
        <div class="filter">
          <label>Филиал</label>
          <select v-model="selectedFilial">
            <option value="">Все</option>
            <option v-for="f in filialOptions" :key="f" :value="f">{{ f }}</option>
          </select>
        </div>

        <div class="filter">
          <label>Поиск по наименованию</label>
          <input v-model.trim="search" placeholder="Например: Ноутбук, Веб-камера..." />
        </div>

        <div class="filter chk">
          <label class="chkline">
            <input type="checkbox" v-model="hideZeroRows" />
            <span>Скрыть нулевые строки</span>
          </label>
        </div>
      </div>

      <!-- Main layout -->
      <div class="grid" v-if="!loading">
        <!-- LEFT: Filials -->
        <div class="card">
          <div class="card-title">Филиалы (итоги)</div>

          <table class="tbl">
            <thead>
              <tr>
                <th>Филиал</th>
                <th class="num">Всего</th>
                <th class="num">Договор</th>
                <th class="num">Иное</th>
                <th class="num">Неопр.</th>
                <th class="num">Типов</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in filialRowsShown"
                :key="row.filial"
                :class="{ active: row.filial === focusedFilial }"
                @click="focusedFilial = row.filial"
              >
                <td class="name">{{ row.filial }}</td>
                <td class="num">{{ formatInt(row.total) }}</td>
                <td class="num">{{ formatInt(row.inContract) }}</td>
                <td class="num">{{ formatInt(row.otherPlace) }}</td>
                <td class="num warn">{{ formatInt(row.undefined) }}</td>
                <td class="num">{{ formatInt(row.typesCount) }}</td>
              </tr>

              <tr v-if="filialRowsShown.length === 0">
                <td colspan="6" class="empty">Нет данных</td>
              </tr>
            </tbody>
          </table>

          <div class="hint">
            Нажми на филиал — справа появится детализация по видам оборудования.
          </div>
        </div>

        <!-- RIGHT: Types inside filial -->
        <div class="card">
          <div class="card-title">
            Детализация по видам — <span class="accent">{{ focusedFilial }}</span>
          </div>

          <table class="tbl">
            <thead>
              <tr>
                <th class="sortable" @click="toggleTypeSort('name')">
                  Наименование ОС <span class="sort">{{ typeSortArrow('name') }}</span>
                </th>
                <th class="num sortable" @click="toggleTypeSort('unitCost')">
                  Цена/ед. <span class="sort">{{ typeSortArrow('unitCost') }}</span>
                </th>
                <th class="num sortable" @click="toggleTypeSort('total')">
                  Всего <span class="sort">{{ typeSortArrow('total') }}</span>
                </th>
                <th class="num sortable" @click="toggleTypeSort('inContract')">
                  Договор <span class="sort">{{ typeSortArrow('inContract') }}</span>
                </th>
                <th class="num sortable" @click="toggleTypeSort('otherPlace')">
                  Иное <span class="sort">{{ typeSortArrow('otherPlace') }}</span>
                </th>
                <th class="num sortable" @click="toggleTypeSort('undefined')">
                  Неопр. <span class="sort">{{ typeSortArrow('undefined') }}</span>
                </th>
                <th class="num"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="t in typeRowsShown" :key="t.name">
                <td class="name">{{ t.name }}</td>
                <td class="num mono">{{ formatMoney(t.unitCost) }}</td>
                <td class="num">{{ formatInt(t.total) }}</td>
                <td class="num">{{ formatInt(t.inContract) }}</td>
                <td class="num">{{ formatInt(t.otherPlace) }}</td>
                <td class="num warn">{{ formatInt(t.undefined) }}</td>
                <td class="num">
                  <button class="btn-sm" @click="openDetails(focusedFilial, t.name)">Перечень</button>
                </td>
              </tr>

              <tr v-if="typeRowsShown.length === 0">
                <td colspan="7" class="empty">Нет строк по выбранным фильтрам</td>
              </tr>
            </tbody>
          </table>

          <div class="hint">
            Цена/ед. — средневзвешенная (по строкам ОС и ГУ) внутри выбранного филиала.
          </div>
        </div>
      </div>

      <div v-if="loading" class="loading">
        <span class="spinner"></span>
        Загрузка данных...
      </div>
    </div>

    <!-- Side modal details -->
    <div v-if="detailsOpen" class="modal-backdrop" @click.self="closeDetails">
      <div class="modal-panel">
        <div class="modal-head">
          <div class="modal-title">
            {{ detailsTitle }}
          </div>
          <button class="btn-sm" @click="closeDetails">Закрыть</button>
        </div>

        <div class="modal-body">
          <div class="modal-meta">
            <div><b>Всего:</b> {{ formatInt(detailsRows.length) }}</div>
            <div><b>Показано:</b> {{ formatInt(detailsRowsShown.length) }}</div>
          </div>

          <div class="filter-inline">
            <input v-model.trim="detailsSearch" placeholder="Поиск внутри перечня (инв, договор, место, МОЛ)..." />
          </div>

          <table class="tbl">
            <thead>
              <tr>
                <th>Источник</th>
                <th>Инв. №</th>
                <th>Место</th>
                <th class="num">Кол-во</th>
                <th class="num">Цена/ед.</th>
                <th>МОЛ</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, idx) in detailsRowsShown" :key="idx">
                <td>{{ r.source }}</td>
                <td class="mono">{{ r.inv || '' }}</td>
                <td>{{ r.place }}</td>
                <td class="num">{{ formatInt(r.qty) }}</td>
                <td class="num mono">{{ formatMoney(r.unitCost) }}</td>
                <td>{{ r.mol }}</td>
              </tr>
              <tr v-if="detailsRowsShown.length === 0">
                <td colspan="6" class="empty">Ничего не найдено</td>
              </tr>
            </tbody>
          </table>

          <div class="hint">
            Примечание: для ГУ строки строятся из массива “ВДоговорах”; если “Без номера” — это так и будет показано.
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import http from '@/api/http'

const URL_OS  = '/RCDO/hs/rcdo/OS'
const URL_GU  = '/RCDO/hs/rcdo/GruppUchotURL'
const URL_MOL = '/RCDO/hs/rcdo/MOL'
const URL_DOG = '/RCDO/hs/rcdo/DogovoryFull'

const loading = ref(false)
const error = ref('')
const errorDetails = ref('')

const selectedFilial = ref('')
const focusedFilial = ref('Все')
const search = ref('')
const hideZeroRows = ref(false)

// --- сортировка правой таблицы ---
const typeSortKey = ref('total')   // default: как раньше, по "Всего"
const typeSortDir = ref('desc')    // default: убывание

function toggleTypeSort(key) {
  if (typeSortKey.value === key) {
    typeSortDir.value = (typeSortDir.value === 'asc') ? 'desc' : 'asc'
  } else {
    typeSortKey.value = key
    typeSortDir.value = (key === 'name') ? 'asc' : 'desc'
  }
}
function typeSortArrow(key) {
  if (typeSortKey.value !== key) return ''
  return typeSortDir.value === 'asc' ? '▲' : '▼'
}
function sortTypeRows(rows) {
  const key = typeSortKey.value
  const dir = typeSortDir.value === 'asc' ? 1 : -1

  return rows.slice().sort((a, b) => {
    if (key === 'name') {
      return dir * String(a.name).localeCompare(String(b.name), 'ru')
    }
    const av = Number(a[key] ?? 0)
    const bv = Number(b[key] ?? 0)
    if (av === bv) return String(a.name).localeCompare(String(b.name), 'ru')
    return dir * (av - bv)
  })
}

const summary = ref(createEmptySummary())

const detailsOpen = ref(false)
const detailsTitle = ref('')
const detailsRows = ref([])
const detailsSearch = ref('')

function createEmptySummary() {
  return {
    kpi: { total: 0, inContract: 0, otherPlace: 0, undefined: 0 },
    filials: new Map(),
    filialOptions: [],
  }
}

function formatInt(v) {
  const n = Number(v || 0)
  if (!Number.isFinite(n)) return '0'
  return String(Math.round(n))
}

function formatMoney(v) {
  const n = Number(v || 0)
  if (!Number.isFinite(n) || n === 0) return '0'
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(n)
}

function unwrapArray(payload) {
  if (Array.isArray(payload)) return payload

  if (payload && typeof payload === 'object') {
    const knownKeys = [
      'data', 'items', 'result', 'Данные',
      'filialy', 'Филиалы',
      'dogovory', 'Договора', 'Договоры',
      'os', 'OS', 'ОС',
      'rows', 'Массив',
    ]
    for (const k of knownKeys) {
      if (Array.isArray(payload[k])) return payload[k]
    }
    for (const v of Object.values(payload)) {
      if (Array.isArray(v)) return v
    }
  }
  return []
}

function normalizeStr(s) {
  return String(s ?? '').trim()
}

function toNum(v) {
  const n = Number(String(v ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

function buildContractToFilialMap(dogovory) {
  const map = new Map()
  for (const d of dogovory) {
    const no = toNum(d.Номер_Договора ?? d.НомерДоговора ?? d.Dogovor ?? d.Номер)
    const filial = normalizeStr(d.Филиал ?? d.НаименованиеФилиала ?? d.Filial)
    if (no > 0 && filial && !map.has(no)) map.set(no, filial)
  }
  return map
}

function buildMolToFilialMap(molData) {
  const map = new Map()
  for (const f of molData) {
    const filial = normalizeStr(f.НаименованиеФилиала ?? f.Наименование ?? f.Filial)
    const mols = Array.isArray(f.МОЛы) ? f.МОЛы : []
    for (const m of mols) {
      const molName = normalizeStr(m.МОЛ ?? m.MOL)
      if (molName && filial && !map.has(molName)) map.set(molName, filial)
    }
  }
  return map
}

function resolveFilial({ contractNo, mol, contractToFilial, molToFilial }) {
  if (contractNo > 0) return contractToFilial.get(contractNo) || `Не найден договор №${formatInt(contractNo)}`
  return molToFilial.get(mol) || 'Неопределено'
}

function resolvePlaceLabel({ contractNo, otherPlace }) {
  if (contractNo > 0) return `Договор №${formatInt(contractNo)}`
  if (otherPlace) return otherPlace
  return 'Неопределено'
}

function ensureFilialAgg(sum, filial) {
  if (!sum.filials.has(filial)) {
    sum.filials.set(filial, {
      filial,
      total: 0,
      inContract: 0,
      otherPlace: 0,
      undefined: 0,
      types: new Map(),
    })
  }
  return sum.filials.get(filial)
}

function ensureTypeAgg(fAgg, name) {
  if (!fAgg.types.has(name)) {
    // costSum — суммарная стоимость (unitCost * qty) для расчёта средней цены за единицу
    fAgg.types.set(name, { name, total: 0, inContract: 0, otherPlace: 0, undefined: 0, costSum: 0, rows: [] })
  }
  return fAgg.types.get(name)
}

function addCount(agg, kind, qty) {
  agg.total += qty
  if (kind === 'inContract') agg.inContract += qty
  else if (kind === 'otherPlace') agg.otherPlace += qty
  else agg.undefined += qty
}

function addRowToSummary(sum, { filial, name, qty, kind, row, unitCost }) {
  // KPI
  sum.kpi.total += qty
  if (kind === 'inContract') sum.kpi.inContract += qty
  else if (kind === 'otherPlace') sum.kpi.otherPlace += qty
  else sum.kpi.undefined += qty

  // Filial agg
  const fAgg = ensureFilialAgg(sum, filial)
  addCount(fAgg, kind, qty)

  // Type agg
  const tAgg = ensureTypeAgg(fAgg, name)
  addCount(tAgg, kind, qty)

  const u = toNum(unitCost)
  if (u > 0) tAgg.costSum += u * qty

  tAgg.rows.push({ ...row, unitCost: u })
}

function buildSummary({ osRows, guRows, molRows, dogRows }) {
  const sum = createEmptySummary()

  const contractToFilial = buildContractToFilialMap(dogRows)
  const molToFilial = buildMolToFilialMap(molRows)

  const filialSet = new Set()
  for (const f of molRows) {
    const nm = normalizeStr(f.НаименованиеФилиала ?? f.Наименование)
    if (nm) filialSet.add(nm)
  }

  // --- обычные ОС ---
  for (const o of osRows) {
    const name = normalizeStr(o.НаименованиеОС ?? o.Наименование ?? 'Без наименования')
    const inv = normalizeStr(o.ИнвентарныйНомер ?? '')
    const mol = normalizeStr(o.МатериальноОтветственный ?? o.МОЛ ?? '')
    const contractNo = toNum(o.Договор ?? 0)
    const otherPlace = normalizeStr(o.ИноеМестоНахождения ?? '')

    // цена за единицу
    const unitCost = toNum(o.СтоимостьПоследняя ?? o.Стоимость ?? 0)

    let kind = 'undefined'
    if (contractNo > 0) kind = 'inContract'
    else if (otherPlace) kind = 'otherPlace'

    const filial = resolveFilial({ contractNo, mol, contractToFilial, molToFilial })
    filialSet.add(filial)

    const place = resolvePlaceLabel({ contractNo, otherPlace })

    addRowToSummary(sum, {
      filial,
      name,
      qty: 1,
      kind,
      unitCost,
      row: {
        source: 'ОС',
        inv: inv || '(без инв. №)',
        place,
        qty: 1,
        mol,
      }
    })
  }

  // --- групповой учёт ---
  for (const g of guRows) {
    const name = normalizeStr(g.НаименованиеОС ?? g.Наименование ?? 'Без наименования')
    const mol = normalizeStr(g.МатериальноОтветственный ?? g.МОЛ ?? '')
    const list = Array.isArray(g.ВДоговорах) ? g.ВДоговорах : []

    // цена за единицу (по твоей логике)
    const unitCost = toNum(g.СтоимостьПоследняя ?? 0)

    if (list.length === 0) {
      const qty = toNum(g.Количество ?? 0)
      if (qty > 0) {
        const filial = resolveFilial({ contractNo: 0, mol, contractToFilial, molToFilial })
        filialSet.add(filial)

        addRowToSummary(sum, {
          filial,
          name,
          qty,
          kind: 'undefined',
          unitCost,
          row: {
            source: 'ГУ',
            inv: '',
            place: 'Неопределено',
            qty,
            mol,
          }
        })
      }
      continue
    }

    for (const e of list) {
      const contractNo = toNum(e.НомерДоговора ?? e.Номер_Договора ?? 0)
      const otherPlace = normalizeStr(e.ИноеМестоНахождения ?? '')
      const inv = normalizeStr(e.ИнвентарныйНомер ?? '')
      const qty = toNum(e.Количество ?? 0)
      if (qty <= 0) continue

      let kind = 'undefined'
      if (contractNo > 0) kind = 'inContract'
      else if (otherPlace) kind = 'otherPlace'

      const filial = resolveFilial({ contractNo, mol, contractToFilial, molToFilial })
      filialSet.add(filial)

      const place = resolvePlaceLabel({ contractNo, otherPlace })

      addRowToSummary(sum, {
        filial,
        name,
        qty,
        kind,
        unitCost,
        row: {
          source: 'ГУ',
          inv: inv || '',
          place,
          qty,
          mol,
        }
      })
    }
  }

  sum.filialOptions = Array.from(filialSet).filter(Boolean).sort((a, b) => a.localeCompare(b, 'ru'))
  return sum
}

async function fetchAll() {
  loading.value = true
  error.value = ''
  errorDetails.value = ''

  try {
    const [osRes, guRes, molRes, dogRes] = await Promise.all([
      http.get(URL_OS),
      http.get(URL_GU),
      http.get(URL_MOL),
      http.get(URL_DOG),
    ])

    const osRows = unwrapArray(osRes.data)
    const guRows = unwrapArray(guRes.data)
    const molRows = unwrapArray(molRes.data)
    const dogRows = unwrapArray(dogRes.data)

    summary.value = buildSummary({ osRows, guRows, molRows, dogRows })

    const rows = computeFilialRows(summary.value, '')
    focusedFilial.value = rows.length > 0 ? rows[0].filial : 'Все'

  } catch (e) {
    error.value = 'Не удалось загрузить данные'
    errorDetails.value = e?.message ? String(e.message) : String(e)
  } finally {
    loading.value = false
  }
}

function computeFilialRows(sum, filialFilter) {
  const rows = []
  for (const [filial, fAgg] of sum.filials.entries()) {
    if (filialFilter && filial !== filialFilter) continue
    rows.push({
      filial,
      total: fAgg.total,
      inContract: fAgg.inContract,
      otherPlace: fAgg.otherPlace,
      undefined: fAgg.undefined,
      typesCount: fAgg.types.size,
    })
  }
  rows.sort((a, b) => b.total - a.total || a.filial.localeCompare(b.filial, 'ru'))
  return rows
}

function computeTypeRows(sum, filial, searchText) {
  const fAgg = sum.filials.get(filial)
  if (!fAgg) return []

  const rows = []
  for (const [name, tAgg] of fAgg.types.entries()) {
    if (searchText && !name.toLowerCase().includes(searchText.toLowerCase())) continue

    const unitCost = (tAgg.total > 0 && tAgg.costSum > 0) ? (tAgg.costSum / tAgg.total) : 0

    rows.push({
      name,
      unitCost,
      total: tAgg.total,
      inContract: tAgg.inContract,
      otherPlace: tAgg.otherPlace,
      undefined: tAgg.undefined,
    })
  }

  // ВАЖНО: сортировку здесь убрали — теперь сортирует sortTypeRows()
  return rows
}

const kpi = computed(() => summary.value.kpi)

const filialOptions = computed(() => summary.value.filialOptions || [])

const filialRows = computed(() => computeFilialRows(summary.value, selectedFilial.value))

const filialRowsShown = computed(() => {
  const rows = filialRows.value
  if (!hideZeroRows.value) return rows
  return rows.filter(r => (r.total || 0) > 0)
})

const typeRows = computed(() => {
  const filial = focusedFilial.value
  if (!filial || filial === 'Все') return []
  const rows = computeTypeRows(summary.value, filial, search.value)
  return sortTypeRows(rows)
})

const typeRowsShown = computed(() => {
  const rows = typeRows.value
  if (!hideZeroRows.value) return rows
  return rows.filter(r => (r.total || 0) > 0)
})

function openDetails(filial, typeName) {
  const fAgg = summary.value.filials.get(filial)
  if (!fAgg) return
  const tAgg = fAgg.types.get(typeName)
  if (!tAgg) return

  detailsTitle.value = `${filial} — ${typeName}`
  detailsRows.value = Array.isArray(tAgg.rows) ? tAgg.rows : []
  detailsSearch.value = ''
  detailsOpen.value = true
}

function closeDetails() {
  detailsOpen.value = false
  detailsTitle.value = ''
  detailsRows.value = []
  detailsSearch.value = ''
}

const detailsRowsShown = computed(() => {
  const q = detailsSearch.value.toLowerCase()
  const rows = detailsRows.value || []
  if (!q) return rows.slice(0, 800)
  const filtered = rows.filter(r => {
    const s = `${r.source} ${r.inv} ${r.place} ${r.qty} ${r.unitCost} ${r.mol}`.toLowerCase()
    return s.includes(q)
  })
  return filtered.slice(0, 800)
})

onMounted(fetchAll)
</script>

<style scoped>
.page { padding: 16px; }
.header{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap: 12px;
  margin-bottom: 10px;
}
.actions{ display:flex; gap: 8px; }

.btn{
  border: 0;
  background: #2ea3ff;
  color: #fff;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 700;
}
.btn:disabled{ opacity: .7; cursor: default; }
.btn-sm{
  border: 0;
  background: #1f2a38;
  color: #fff;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 700;
}

.error{
  border: 1px solid #ffb1b1;
  background: #fff3f3;
  padding: 12px;
  border-radius: 10px;
}
.error-title{ font-weight: 800; margin-bottom: 6px; }
.error-details{ opacity: .85; margin-bottom: 10px; white-space: pre-wrap; }

.kpi-grid{
  display:grid;
  grid-template-columns: repeat(4, minmax(140px, 1fr));
  gap: 10px;
  margin: 12px 0 14px;
}
.kpi{
  border: 1px solid #e6e8ee;
  background: #fff;
  border-radius: 12px;
  padding: 12px;
}
.kpi.warn{ border-color:#ffe0a6; background:#fff8e8; }
.kpi-title{ font-size: 13px; opacity: .75; margin-bottom: 6px; }
.kpi-value{ font-size: 22px; font-weight: 900; }

.filters{
  display:grid;
  grid-template-columns: 240px 1fr 220px;
  gap: 10px;
  align-items:end;
  margin-bottom: 12px;
}
.filter label{ display:block; font-size: 13px; opacity: .75; margin-bottom: 6px; }
.filter select, .filter input{
  width:100%;
  border: 1px solid #d6dbe5;
  border-radius: 8px;
  padding: 8px 10px;
}
.filter.chk{ display:flex; align-items:center; }
.chkline{ display:flex; gap: 8px; align-items:center; user-select:none; }

.grid{
  display:grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.card{
  border: 1px solid #e6e8ee;
  background:#fff;
  border-radius: 12px;
  padding: 12px;
}
.card-title{
  font-weight: 900;
  margin-bottom: 10px;
}
.accent{ color:#2ea3ff; }

.tbl{
  width:100%;
  border-collapse: collapse;
  font-size: 14px;
}
.tbl th, .tbl td{
  border-bottom: 1px solid #eef1f6;
  padding: 8px 8px;
  vertical-align: top;
}
.tbl th{ text-align:left; font-size: 13px; opacity: .8; }
.tbl .num{ text-align:right; white-space: nowrap; }
.tbl .name{ font-weight: 700; }
.tbl .warn{ color:#b26a00; font-weight: 800; }
.tbl tr.active td{ background:#f4f8ff; }
.tbl tr:hover td{ background:#f7f9fc; cursor: pointer; }
.tbl .empty{ text-align:center; opacity:.7; padding: 14px; }

.hint{
  margin-top: 10px;
  font-size: 12.5px;
  opacity: .75;
}

.loading{
  display:flex;
  align-items:center;
  gap: 10px;
  margin-top: 14px;
  opacity: .85;
}
.spinner{
  width: 18px;
  height: 18px;
  border: 3px solid #d9e7ff;
  border-top-color: #2ea3ff;
  border-radius: 50%;
  display:inline-block;
  animation: spin .8s linear infinite;
}
@keyframes spin{ to{ transform: rotate(360deg);} }

.mono{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }

/* сортировка заголовков */
.sortable{
  cursor: pointer;
  user-select: none;
}
.sort{
  margin-left: 6px;
  font-size: 12px;
  opacity: .65;
}

/* side modal */
.modal-backdrop{
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.35);
  display:flex;
  justify-content:flex-end;
  z-index: 999;
}
.modal-panel{
  width: min(900px, 96vw);
  height: 100%;
  background:#fff;
  box-shadow: -20px 0 60px rgba(0,0,0,.25);
  display:flex;
  flex-direction: column;
}
.modal-head{
  padding: 12px;
  border-bottom: 1px solid #eef1f6;
  display:flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}
.modal-title{ font-weight: 900; }
.modal-body{
  padding: 12px;
  overflow:auto;
}
.modal-meta{
  display:flex;
  gap: 16px;
  margin-bottom: 10px;
  opacity:.85;
}
.filter-inline input{
  width:100%;
  border: 1px solid #d6dbe5;
  border-radius: 8px;
  padding: 8px 10px;
  margin-bottom: 10px;
}
</style>
