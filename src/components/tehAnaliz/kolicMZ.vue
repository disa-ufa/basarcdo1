<template>
  <div class="page">
    <div class="header">
      <h2>Тех анализ — Количественный отчёт МЗ</h2>

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
          <div class="kpi-title">Всего единиц (МЗ)</div>
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
          <input v-model.trim="search" placeholder="Например: Кабель, Веб-камера, Колонки..." />
        </div>

        <div class="filter chk">
          <label class="chkline">
            <input type="checkbox" v-model="hideZeroRows" />
            <span>Скрыть нулевые строки</span>
          </label>
        </div>
      </div>

      <!-- STACK: Filials -> Types (сразу ниже) -->
      <div class="stack" v-if="!loading">
        <!-- Filials -->
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
            Нажми на филиал — ниже появится детализация по видам МЗ.
          </div>
        </div>

        <!-- Types inside filial (сразу после филиалов) -->
        <div class="card">
          <div class="card-title">
            Детализация по видам — <span class="accent">{{ focusedFilial }}</span>
          </div>

          <table class="tbl">
            <thead>
              <tr>
                <th class="sortable" @click="toggleTypeSort('name')">
                  Наименование МЗ <span class="sort">{{ typeSortArrow('name') }}</span>
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
            Цена/ед. считается как СтоимостьПоследняя / Количество (если Количество &gt; 0).
          </div>
        </div>
      </div>

      <!-- Summary pivot table -->
      <div class="card full-card" v-if="!loading">
        <div class="card-title">Сводная таблица по видам и филиалам</div>

        <div class="table-scroll">
          <table class="tbl">
            <thead>
              <tr>
                <th class="sortable" @click="toggleMatrixSort('name')">
                  Наименование МЗ <span class="sort">{{ matrixSortArrow('name') }}</span>
                </th>
                <th class="num sortable" @click="toggleMatrixSort('unitCost')">
                  Цена/ед. <span class="sort">{{ matrixSortArrow('unitCost') }}</span>
                </th>
                <th class="num sortable" @click="toggleMatrixSort('total')">
                  Всего <span class="sort">{{ matrixSortArrow('total') }}</span>
                </th>

                <!-- ВАЖНО: здесь порядок уже "филиалы..., затем Не найден договор, затем Неопределено" -->
                <th
                  v-for="f in matrixFilials"
                  :key="f"
                  class="num sortable"
                  @click="toggleMatrixSort('f:' + f)"
                >
                  {{ f }} <span class="sort">{{ matrixSortArrow('f:' + f) }}</span>
                </th>
              </tr>
            </thead>

            <tbody>
              <tr v-for="r in matrixRowsShown" :key="r.name">
                <td class="name">{{ r.name }}</td>
                <td class="num mono">{{ formatMoney(r.unitCost) }}</td>
                <td class="num">{{ formatInt(r.total) }}</td>

                <td v-for="f in matrixFilials" :key="f" class="num">
                  {{ formatInt(r.byFilial[f] || 0) }}
                </td>
              </tr>

              <tr v-if="matrixRowsShown.length === 0">
                <td :colspan="3 + matrixFilials.length" class="empty">Нет данных</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="hint">
          В таблице показано общее количество по каждому виду МЗ и распределение по филиалам.
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
          <div class="modal-title">{{ detailsTitle }}</div>
          <button class="btn-sm" @click="closeDetails">Закрыть</button>
        </div>

        <div class="modal-body">
          <div class="modal-meta">
            <div><b>Всего строк:</b> {{ formatInt(detailsRows.length) }}</div>
            <div><b>Показано:</b> {{ formatInt(detailsRowsShown.length) }}</div>
          </div>

          <div class="filter-inline">
            <input v-model.trim="detailsSearch" placeholder="Поиск (договор, место, МОЛ, код)..." />
          </div>

          <table class="tbl">
            <thead>
              <tr>
                <th>КодПоБГУ</th>
                <th>Место</th>
                <th class="num">Кол-во</th>
                <th class="num">Цена/ед.</th>
                <th>МОЛ</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, idx) in detailsRowsShown" :key="idx">
                <td class="mono">{{ r.code || '' }}</td>
                <td>{{ r.place }}</td>
                <td class="num">{{ formatInt(r.qty) }}</td>
                <td class="num mono">{{ formatMoney(r.unitCost) }}</td>
                <td>{{ r.mol }}</td>
              </tr>
              <tr v-if="detailsRowsShown.length === 0">
                <td colspan="5" class="empty">Ничего не найдено</td>
              </tr>
            </tbody>
          </table>

          <div class="hint">
            Перечень строится из “Договоры” (распределение по договорам) + остаток (Иное / Неопределено).
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import http from '@/api/http'

const URL_MZ  = '/RCDO/hs/rcdo/MZ'
const URL_MOL = '/RCDO/hs/rcdo/MOL'
const URL_DOG = '/RCDO/hs/rcdo/DogovoryFull'

const loading = ref(false)
const error = ref('')
const errorDetails = ref('')

const selectedFilial = ref('')
const focusedFilial = ref('Все')
const search = ref('')
const hideZeroRows = ref(false)

// --- сортировка правой (детализация) ---
const typeSortKey = ref('total')
const typeSortDir = ref('desc')

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
    if (key === 'name') return dir * String(a.name).localeCompare(String(b.name), 'ru')
    const av = Number(a[key] ?? 0)
    const bv = Number(b[key] ?? 0)
    if (av === bv) return String(a.name).localeCompare(String(b.name), 'ru')
    return dir * (av - bv)
  })
}

// --- сортировка сводной таблицы ---
const matrixSortKey = ref('total')
const matrixSortDir = ref('desc')

function toggleMatrixSort(key) {
  if (matrixSortKey.value === key) {
    matrixSortDir.value = (matrixSortDir.value === 'asc') ? 'desc' : 'asc'
  } else {
    matrixSortKey.value = key
    matrixSortDir.value = (key === 'name') ? 'asc' : 'desc'
  }
}
function matrixSortArrow(key) {
  if (matrixSortKey.value !== key) return ''
  return matrixSortDir.value === 'asc' ? '▲' : '▼'
}
function sortMatrixRows(rows) {
  const key = matrixSortKey.value
  const dir = matrixSortDir.value === 'asc' ? 1 : -1

  return rows.slice().sort((a, b) => {
    if (key === 'name') return dir * String(a.name).localeCompare(String(b.name), 'ru')

    if (key.startsWith('f:')) {
      const filial = key.slice(2)
      const av = Number(a.byFilial?.[filial] ?? 0)
      const bv = Number(b.byFilial?.[filial] ?? 0)
      if (av === bv) return String(a.name).localeCompare(String(b.name), 'ru')
      return dir * (av - bv)
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
    const knownKeys = ['data', 'items', 'result', 'Данные', 'mz', 'MZ', 'МЗ', 'rows', 'Массив']
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
  if (contractNo > 0) return contractToFilial.get(contractNo) || 'Не найден договор'
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
  sum.kpi.total += qty
  if (kind === 'inContract') sum.kpi.inContract += qty
  else if (kind === 'otherPlace') sum.kpi.otherPlace += qty
  else sum.kpi.undefined += qty

  const fAgg = ensureFilialAgg(sum, filial)
  addCount(fAgg, kind, qty)

  const tAgg = ensureTypeAgg(fAgg, name)
  addCount(tAgg, kind, qty)

  const u = toNum(unitCost)
  if (u > 0) tAgg.costSum += u * qty

  tAgg.rows.push({ ...row, unitCost: u })
}

function calcUnitCost(totalCost, qty) {
  const c = toNum(totalCost)
  const q = toNum(qty)
  if (q <= 0) return 0
  return c / q
}

function buildSummary({ mzRows, molRows, dogRows }) {
  const sum = createEmptySummary()

  const contractToFilial = buildContractToFilialMap(dogRows)
  const molToFilial = buildMolToFilialMap(molRows)

  const filialSet = new Set()
  for (const f of molRows) {
    const nm = normalizeStr(f.НаименованиеФилиала ?? f.Наименование)
    if (nm) filialSet.add(nm)
  }
  for (const filial of contractToFilial.values()) {
    if (filial) filialSet.add(filial)
  }
  filialSet.add('Не найден договор')
  filialSet.add('Неопределено')

  for (const m of mzRows) {
    const name = normalizeStr(m.НаименованиеМЗ ?? m.Наименование ?? 'Без наименования')
    const mol = normalizeStr(m.МатериальноОтветственный ?? m.МОЛ ?? '')
    const code = normalizeStr(m.КодПоБгу ?? m.КодПоБГУ ?? m.КодПоBгу ?? '')
    const totalQty = toNum(m.Количество ?? 0)
    if (totalQty <= 0) continue

    const otherPlace = normalizeStr(m.ИноеМестоНахождения ?? '')
    const contractsList = Array.isArray(m.Договоры) ? m.Договоры : (Array.isArray(m.ВДоговорах) ? m.ВДоговорах : [])

    const unitCost = calcUnitCost(m.СтоимостьПоследняя ?? 0, totalQty)

    let sumContractQty = 0
    for (const e of contractsList) {
      const contractNo = toNum(e.НомерДоговора ?? e.Номер_Договора ?? e.Номер ?? 0)
      const qty = toNum(e.Количество ?? 0)
      if (qty <= 0) continue

      sumContractQty += qty
      const filial = resolveFilial({ contractNo, mol, contractToFilial, molToFilial })

      addRowToSummary(sum, {
        filial,
        name,
        qty,
        kind: (contractNo > 0) ? 'inContract' : 'undefined',
        unitCost,
        row: {
          code,
          place: resolvePlaceLabel({ contractNo, otherPlace: '' }),
          qty,
          mol,
        }
      })
    }

    const remaining = Math.max(0, totalQty - sumContractQty)
    if (remaining > 0) {
      const filial = resolveFilial({ contractNo: 0, mol, contractToFilial, molToFilial })
      const kind = otherPlace ? 'otherPlace' : 'undefined'
      const place = resolvePlaceLabel({ contractNo: 0, otherPlace })

      addRowToSummary(sum, {
        filial,
        name,
        qty: remaining,
        kind,
        unitCost,
        row: {
          code,
          place,
          qty: remaining,
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
    const [mzRes, molRes, dogRes] = await Promise.all([
      http.get(URL_MZ),
      http.get(URL_MOL),
      http.get(URL_DOG),
    ])

    const mzRows  = unwrapArray(mzRes.data)
    const molRows = unwrapArray(molRes.data)
    const dogRows = unwrapArray(dogRes.data)

    summary.value = buildSummary({ mzRows, molRows, dogRows })

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

// --- порядок колонок в сводной: сначала филиалы, потом спец-колонки в конце ---
const matrixFilials = computed(() => {
  const arr = (filialOptions.value || []).slice()
  const specials = ['Не найден договор', 'Неопределено']
  const base = arr.filter(x => !specials.includes(x))
  const tail = specials.filter(s => arr.includes(s))
  return [...base, ...tail]
})

function computeMatrixRows(sum) {
  const map = new Map()

  for (const [filial, fAgg] of sum.filials.entries()) {
    for (const [name, tAgg] of fAgg.types.entries()) {
      if (!map.has(name)) {
        map.set(name, { name, total: 0, costSum: 0, byFilial: {} })
      }
      const row = map.get(name)
      row.total += toNum(tAgg.total)
      row.costSum += toNum(tAgg.costSum)
      row.byFilial[filial] = (row.byFilial[filial] || 0) + toNum(tAgg.total)
    }
  }

  let rows = Array.from(map.values()).map(r => ({
    name: r.name,
    total: r.total,
    unitCost: (r.total > 0 && r.costSum > 0) ? (r.costSum / r.total) : 0,
    byFilial: r.byFilial || {}
  }))

  const q = (search.value || '').toLowerCase()
  if (q) rows = rows.filter(r => String(r.name).toLowerCase().includes(q))
  if (hideZeroRows.value) rows = rows.filter(r => (r.total || 0) > 0)

  return sortMatrixRows(rows)
}

const matrixRows = computed(() => computeMatrixRows(summary.value))
const matrixRowsShown = computed(() => (matrixRows.value || []).slice(0, 400))

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
    const s = `${r.code} ${r.place} ${r.qty} ${r.unitCost} ${r.mol}`.toLowerCase()
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

/* NEW: вертикальный стек вместо 2 колонок */
.stack{
  display:flex;
  flex-direction: column;
  gap: 12px;
}

.card{
  border: 1px solid #e6e8ee;
  background:#fff;
  border-radius: 12px;
  padding: 12px;
}
.full-card{
  margin-top: 12px;
}

.card-title{
  font-weight: 900;
  margin-bottom: 10px;
}
.accent{ color:#2ea3ff; }

.table-scroll{
  overflow-x: auto;
  border-radius: 10px;
}

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
