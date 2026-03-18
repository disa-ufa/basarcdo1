```vue
<!-- src/components/analysis/raskhozhdeniye.vue -->
<template>
  <div class="page">
    <div class="header">
      <h2>Тех анализ — Расхождения / Контроль данных</h2>

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
      <div class="kpi-grid" v-if="!loading">
        <div class="kpi">
          <div class="kpi-title">Всего расхождений</div>
          <div class="kpi-value">{{ formatInt(kpi.total) }}</div>
        </div>
        <div class="kpi danger">
          <div class="kpi-title">Критичные</div>
          <div class="kpi-value">{{ formatInt(kpi.critical) }}</div>
        </div>
        <div class="kpi warn">
          <div class="kpi-title">Предупреждения</div>
          <div class="kpi-value">{{ formatInt(kpi.warn) }}</div>
        </div>
        <div class="kpi">
          <div class="kpi-title">Инфо</div>
          <div class="kpi-value">{{ formatInt(kpi.info) }}</div>
        </div>
      </div>

      <div class="filters" v-if="!loading">
        <div class="filter">
          <label>Серьёзность</label>
          <select v-model="fSeverity">
            <option value="">Все</option>
            <option value="critical">Критично</option>
            <option value="warn">Предупреждение</option>
            <option value="info">Инфо</option>
          </select>
        </div>

        <div class="filter">
          <label>Тип проверки</label>
          <select v-model="fType">
            <option value="">Все</option>
            <option v-for="t in typeOptions" :key="t" :value="t">{{ typeLabel(t) }}</option>
          </select>
        </div>

        <div class="filter">
          <label>Филиал</label>
          <select v-model="fFilial">
            <option value="">Все</option>
            <option v-for="f in filialOptions" :key="f" :value="f">{{ f }}</option>
          </select>
        </div>

        <div class="filter">
          <label>Поиск</label>
          <input v-model.trim="search" placeholder="Инв/код/договор/МОЛ/наименование..." />
        </div>

        <div class="filter chk">
          <label class="chkline">
            <input type="checkbox" v-model="hideInfo" />
            <span>Скрыть «Инфо»</span>
          </label>
        </div>
      </div>

      <div class="card" v-if="!loading">
        <div class="card-title">
          Список расхождений
          <span class="muted">— показано {{ formatInt(shownIssues.length) }} из {{ formatInt(filteredIssues.length) }}</span>
        </div>

        <div class="table-scroll">
          <table class="tbl">
            <thead>
              <tr>
                <th class="sortable" @click="toggleSort('severity')">
                  Серьёзность <span class="sort">{{ sortArrow('severity') }}</span>
                </th>
                <th class="sortable" @click="toggleSort('type')">
                  Тип <span class="sort">{{ sortArrow('type') }}</span>
                </th>
                <th class="sortable" @click="toggleSort('entity')">
                  Источник <span class="sort">{{ sortArrow('entity') }}</span>
                </th>
                <th class="sortable" @click="toggleSort('name')">
                  Наименование <span class="sort">{{ sortArrow('name') }}</span>
                </th>
                <th class="sortable" @click="toggleSort('inv')">
                  Инв/Код <span class="sort">{{ sortArrow('inv') }}</span>
                </th>
                <th class="num sortable" @click="toggleSort('contractNo')">
                  Договор <span class="sort">{{ sortArrow('contractNo') }}</span>
                </th>
                <th class="sortable" @click="toggleSort('filial')">
                  Филиал <span class="sort">{{ sortArrow('filial') }}</span>
                </th>
                <th>Описание</th>
                <th class="num"></th>
              </tr>
            </thead>

            <tbody>
              <tr v-for="it in shownIssues" :key="it.id">
                <td>
                  <span class="badge" :class="badgeClass(it.severity)">{{ severityLabel(it.severity) }}</span>
                </td>
                <td class="mono">{{ typeLabel(it.type) }}</td>
                <td>{{ it.entity }}</td>
                <td class="name">{{ it.name || '' }}</td>
                <td class="mono">{{ it.inv || it.code || '' }}</td>
                <td class="num mono">{{ it.contractNo ? formatInt(it.contractNo) : '' }}</td>
                <td>{{ it.filial || '' }}</td>
                <td>{{ it.message }}</td>
                <td class="num">
                  <button class="btn-sm" @click="openDetails(it)">Детали</button>
                </td>
              </tr>

              <tr v-if="shownIssues.length === 0">
                <td colspan="9" class="empty">Нет расхождений по выбранным фильтрам</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="hint">
          Примечание по инв. номерам: сравнение идёт по строке (обрезаем пробелы по краям, приводим к верхнему регистру),
          <b>ведущие нули и символы (точки, дефисы и т.п.) не удаляются</b>.
        </div>
      </div>

      <div v-if="loading" class="loading">
        <span class="spinner"></span>
        Загрузка данных...
      </div>
    </div>

    <!-- Side modal -->
    <div v-if="detailsOpen" class="modal-backdrop" @click.self="closeDetails">
      <div class="modal-panel">
        <div class="modal-head">
          <div class="modal-title">{{ detailsTitle }}</div>
          <button class="btn-sm" @click="closeDetails">Закрыть</button>
        </div>

        <div class="modal-body">
          <div class="modal-meta">
            <div><b>Серьёзность:</b> {{ severityLabel(detailsIssue?.severity) }}</div>
            <div><b>Тип:</b> {{ typeLabel(detailsIssue?.type) }}</div>
            <div v-if="detailsIssue?.contractNo"><b>Договор:</b> {{ formatInt(detailsIssue.contractNo) }}</div>
            <div v-if="detailsIssue?.filial"><b>Филиал:</b> {{ detailsIssue.filial }}</div>
          </div>

          <div class="modal-msg">
            <b>Описание:</b> {{ detailsIssue?.message }}
          </div>

          <div class="filter-inline">
            <input v-model.trim="detailsSearch" placeholder="Поиск в деталях..." />
          </div>

          <pre class="json">{{ prettyDetails }}</pre>

          <div class="hint">
            Здесь показаны исходные данные (ОС/ГУ/МЗ/договор) и индексы/совпадения.
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
const URL_MZ  = '/RCDO/hs/rcdo/MZ'
const URL_MOL = '/RCDO/hs/rcdo/MOL'
const URL_DOG = '/RCDO/hs/rcdo/DogovoryFull'

const loading = ref(false)
const error = ref('')
const errorDetails = ref('')

const issues = ref([])

const fSeverity = ref('')
const fType = ref('')
const fFilial = ref('')
const search = ref('')
const hideInfo = ref(false)

const sortKey = ref('severity')
const sortDir = ref('desc')

// modal
const detailsOpen = ref(false)
const detailsIssue = ref(null)
const detailsTitle = ref('')
const detailsSearch = ref('')

function formatInt(v) {
  const n = Number(v || 0)
  if (!Number.isFinite(n)) return '0'
  return String(Math.round(n))
}

function unwrapArray(payload) {
  if (Array.isArray(payload)) return payload
  if (payload && typeof payload === 'object') {
    const knownKeys = [
      'data','items','result','Данные','rows','Массив',
      'os','OS','ОС','mz','MZ','МЗ',
      'dogovory','Договора','Договоры',
      'filialy','Филиалы',
    ]
    for (const k of knownKeys) if (Array.isArray(payload[k])) return payload[k]
    for (const v of Object.values(payload)) if (Array.isArray(v)) return v
  }
  return []
}

function normalizeStr(s) {
  return String(s ?? '').replace(/\u00A0/g, ' ').trim()
}

function toNum(v) {
  const n = Number(String(v ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

/**
 * Инв номер: НЕ удаляем ведущие нули и символы.
 * Минимальная нормализация: trim + сжатие пробелов + верхний регистр.
 */
function normalizeInv(raw) {
  let s = normalizeStr(raw)
  if (!s) return ''
  s = s.replace(/\s+/g, ' ')
  return s.toUpperCase()
}

function normalizeName(raw) {
  return normalizeStr(raw).replace(/\s+/g, ' ').trim().toLowerCase()
}

function severityLabel(s) {
  if (s === 'critical') return 'Критично'
  if (s === 'warn') return 'Предупр.'
  return 'Инфо'
}

function badgeClass(s) {
  return s === 'critical' ? 'b-danger' : (s === 'warn' ? 'b-warn' : 'b-info')
}

function typeLabel(t) {
  const map = {
    // ОС / договоры
    OS_CONTRACT_NOT_FOUND: 'ОС: договор не найден',
    OS_INV_NOT_IN_CONTRACT: 'ОС: инв. не найден в составе договора',
    OS_NOT_LINKED_BUT_IN_DOG: 'ОС: в справочнике без договора, но найдено в договорах',
    CONTRACT_OS_NOT_IN_OS_OR_GU: 'Договор: ОС/ГУ не найдено ни в ОС, ни в ГУ',
    CONTRACT_OS_IN_GU_BUT_NOT_LINKED: 'Договор: инв найден в ГУ, но нет привязки к этому договору',
    CONTRACT_OS_IN_GU_WRONG_CONTRACT: 'Договор: инв найден в ГУ, но привязан к другому договору',
    CONTRACT_OS_WRONG_LINK: 'Договор: ОС привязано к другому договору',
    CONTRACT_OS_EMPTY_INV: 'Договор: ОС без инв. номера',
    DOG_INV_IN_MULTIPLE_CONTRACTS: 'Договоры: один инв. номер встречается в разных договорах',
    OS_DUP_INV: 'ОС: дубль инв. номера',
    OS_EMPTY_INV: 'ОС: пустой инв. номер',
    OS_CONTRACT_AND_OTHER_PLACE: 'ОС: указан договор и “Иное место”',
    OS_UNDEFINED_PLACE: 'ОС: местонахождение неопределено',
    OS_MOL_FILIAL_MISMATCH: 'ОС: филиал договора ≠ филиал МОЛ',

    // МОЛ
    MOL_MULTI_FILIAL: 'МОЛ: в нескольких филиалах',

    // ГУ
    GU_CONTRACT_NOT_FOUND: 'ГУ: договор не найден',
    GU_SUM_MISMATCH_COLVD: 'ГУ: сумма ВДоговорах ≠ КолВДоговорах',
    GU_SUM_MISMATCH_COLOTHER: 'ГУ: сумма “иное место” ≠ КолИноеМестоНахождения',
    GU_COLVD_GT_TOTAL: 'ГУ: КолВДоговорах > Количество',
    GU_INV_NOT_IN_LIST: 'ГУ: инв. в ВДоговорах отсутствует в ИнвентарныйНомера',
    GU_INV_IN_MULTIPLE_GROUPS: 'ГУ: инв. встречается в нескольких группах',
    GU_INV_IN_MULTIPLE_CONTRACTS: 'ГУ: один инв. номер указан в разных договорах',
    GU_INV_CONTRACT_NOT_IN_DOG: 'ГУ: инв/договор есть в ВДоговорах, но не найдено в DogovoryFull',
    GU_VD_EMPTY_BUT_IN_DOG: 'ГУ: ВДоговорах пусто, но инв номера найдены в DogovoryFull',
    GU_INV_IN_LIST_NOT_IN_VD_BUT_IN_DOG: 'ГУ: инв есть в ИнвентарныйНомера, но нет в ВДоговорах, хотя есть в договоре',
    INV_IN_OS_AND_GU: 'Инв: одновременно в ОС и ГУ',
    GU_UNDEFINED_PLACE_ROW: 'ГУ: строка с договором=0 без “Иное место”',
    GU_NO_DISTRIBUTION: 'ГУ: нет распределения (ВДоговорах пуст)',

    // МЗ
    MZ_CONTRACT_NOT_FOUND: 'МЗ: договор не найден',
    MZ_SUM_MISMATCH_COLVD: 'МЗ: сумма договоров ≠ КолВДоговорах',
    MZ_COLVD_GT_TOTAL: 'МЗ: КолВДоговорах > Количество',
    MZ_UNDEFINED_REMAINDER: 'МЗ: остаток неопределён (нет “Иное место”)',
    MZ_MOL_FILIAL_MISMATCH: 'МЗ: филиал договора ≠ филиал МОЛ',
    CONTRACT_MZ_NOT_IN_MZ_REF: 'Договор: МЗ не найдено в справочнике МЗ',
    MZ_NOT_IN_CONTRACT_COMPOSITION: 'МЗ: есть ссылка на договор, но МЗ не найдено в составе договора (по имени)',

    // Стоимость
    COST_OS_DIFFERS: 'Стоимость ОС: договор ≠ справочник',
    COST_MZ_DIFFERS: 'Стоимость МЗ: договор ≠ справочник',
  }
  return map[t] || String(t || '')
}

function relDiff(a, b) {
  const A = Math.abs(toNum(a))
  const B = Math.abs(toNum(b))
  const denom = Math.max(1, Math.min(A, B))
  return Math.abs(A - B) / denom
}

function pickContractNo(d) {
  return toNum(d?.Номер_Договора ?? d?.НомерДоговора ?? d?.Dogovor ?? d?.Номер ?? 0)
}
function pickContractFilial(d) {
  return normalizeStr(d?.Филиал ?? d?.НаименованиеФилиала ?? d?.Filial ?? '')
}
function pickContractName(d) {
  return normalizeStr(d?.ФИО ?? d?.ФИО_Код ?? d?.Наименование ?? '')
}

let issueSeq = 1
function makeIssue(severity, type, message, payload = {}) {
  return {
    id: String(issueSeq++).padStart(6, '0'),
    severity,
    type,
    message,
    entity: payload.entity || '',
    name: payload.name || '',
    inv: payload.inv || '',
    code: payload.code || '',
    contractNo: payload.contractNo || 0,
    filial: payload.filial || '',
    mol: payload.mol || '',
    details: payload.details || payload || {},
  }
}

function buildMolMaps(molRows) {
  const molToFilial = new Map()
  const molToSet = new Map() // mol -> Set(filial)

  for (const f of molRows) {
    const filial = normalizeStr(f.НаименованиеФилиала ?? f.Наименование ?? f.Filial ?? '')
    const mols = Array.isArray(f.МОЛы) ? f.МОЛы : []
    for (const m of mols) {
      const mol = normalizeStr(m.МОЛ ?? m.MOL ?? '')
      if (!mol) continue

      if (!molToSet.has(mol)) molToSet.set(mol, new Set())
      molToSet.get(mol).add(filial || 'Неопределено')

      if (!molToFilial.has(mol)) molToFilial.set(mol, filial || 'Неопределено')
    }
  }

  return { molToFilial, molToSet }
}

function buildContractMaps(dogRows) {
  const contractsByNo = new Map()
  const contractNoToFilial = new Map()

  // ОС: номер договора -> Set(invKey)
  const contractOsInvSet = new Map()
  const contractOsLinesByInv = new Map() // contractNo -> Map(invKey -> lines[])

  // МЗ: номер договора -> Map(nameNorm -> {qtySum, lines[]})
  const contractMzByName = new Map()

  for (const d of dogRows) {
    const no = pickContractNo(d)
    if (no <= 0) continue
    if (!contractsByNo.has(no)) contractsByNo.set(no, d)

    const filial = pickContractFilial(d)
    if (filial && !contractNoToFilial.has(no)) contractNoToFilial.set(no, filial)

    const rows = Array.isArray(d.СоставОборудования) ? d.СоставОборудования : []

    for (const r of rows) {
      const typ = normalizeStr(r.Тип ?? '').toUpperCase()

      // ОС (в т.ч. может быть ГУ)
      if (typ === 'ОС') {
        const invKey = normalizeInv(r.ИнвентарныйНомер ?? '')
        if (!invKey) continue

        if (!contractOsInvSet.has(no)) contractOsInvSet.set(no, new Set())
        contractOsInvSet.get(no).add(invKey)

        if (!contractOsLinesByInv.has(no)) contractOsLinesByInv.set(no, new Map())
        const m = contractOsLinesByInv.get(no)
        if (!m.has(invKey)) m.set(invKey, [])
        m.get(invKey).push(r)
      }

      // МЗ
      if (typ.includes('МЗ')) {
        const nm = normalizeStr(r.НаименованиеМЗ ?? r.НаименованиеОС ?? r.Наименование ?? '')
        const nameNorm = normalizeName(nm || 'без_наименования')
        const qty = toNum(r.Количество ?? 0)

        if (!contractMzByName.has(no)) contractMzByName.set(no, new Map())
        const mp = contractMzByName.get(no)
        if (!mp.has(nameNorm)) mp.set(nameNorm, { qtySum: 0, lines: [] })
        mp.get(nameNorm).qtySum += qty
        mp.get(nameNorm).lines.push(r)
      }
    }
  }

  return {
    contractsByNo,
    contractNoToFilial,
    contractOsInvSet,
    contractOsLinesByInv,
    contractMzByName,
  }
}

/**
 * invKey -> { contractNos:Set, byContract: Map(contractNo -> {contractNo, filial, contract, lines}) }
 */
function buildDogInvIndex({ contractsByNo, contractNoToFilial, contractOsLinesByInv }) {
  const invTo = new Map()

  for (const [contractNo, mp] of contractOsLinesByInv.entries()) {
    const c = contractsByNo.get(contractNo)
    const filial = pickContractFilial(c) || contractNoToFilial.get(contractNo) || ''
    for (const [invKey, lines] of mp.entries()) {
      if (!invTo.has(invKey)) invTo.set(invKey, { contractNos: new Set(), byContract: new Map() })
      const rec = invTo.get(invKey)
      rec.contractNos.add(contractNo)
      rec.byContract.set(contractNo, { contractNo, filial, contract: c, lines })
    }
  }

  return invTo
}

/**
 * ГУ индексы:
 * invToGroup: invKey -> { groupCode, name, mol, group }
 * invToGroups: invKey -> Set(groupCode)
 * invToContractsSet: invKey -> Set(contractNo) (по ВДоговорах, только contractNo>0)
 * invToContractsMap: invKey -> Map(contractNo -> {qtySum, rows:[{groupCode, row, qty}]} )
 */
function buildGuInvMaps(guRows) {
  const invToGroup = new Map()
  const invToGroups = new Map()

  const invToContractsSet = new Map()
  const invToContractsMap = new Map()

  for (const g of guRows) {
    const groupCode = normalizeStr(g.Код ?? g.КодПоБгу ?? g.Наименование ?? 'ГУ')
    const name = normalizeStr(g.НаименованиеОС ?? g.Наименование ?? '')
    const mol = normalizeStr(g.МатериальноОтветственный ?? g.МОЛ ?? '')

    // 1) из ИнвентарныйНомера
    const invList = Array.isArray(g.ИнвентарныйНомера) ? g.ИнвентарныйНомера : []
    for (const it of invList) {
      const invKey = normalizeInv(it?.ИнвентарныйНомер ?? it)
      if (!invKey) continue

      if (!invToGroup.has(invKey)) invToGroup.set(invKey, { groupCode, name, mol, group: g })
      if (!invToGroups.has(invKey)) invToGroups.set(invKey, new Set())
      invToGroups.get(invKey).add(groupCode)
    }

    // 2) из ВДоговорах (привязка инв -> договор)
    const rows = Array.isArray(g.ВДоговорах) ? g.ВДоговорах : []
    for (const r of rows) {
      const invRaw = normalizeStr(r.ИнвентарныйНомер ?? '')
      if (!invRaw) continue
      if (invRaw.toLowerCase() === 'без номера') continue

      const invKey = normalizeInv(invRaw)
      if (!invKey) continue

      const contractNo = toNum(r.НомерДоговора ?? r.Номер_Договора ?? 0)
      const qty = toNum(r.Количество ?? 0)

      if (!invToGroup.has(invKey)) invToGroup.set(invKey, { groupCode, name, mol, group: g })

      if (!invToGroups.has(invKey)) invToGroups.set(invKey, new Set())
      invToGroups.get(invKey).add(groupCode)

      if (contractNo > 0) {
        if (!invToContractsSet.has(invKey)) invToContractsSet.set(invKey, new Set())
        invToContractsSet.get(invKey).add(contractNo)

        if (!invToContractsMap.has(invKey)) invToContractsMap.set(invKey, new Map())
        const cm = invToContractsMap.get(invKey)
        if (!cm.has(contractNo)) cm.set(contractNo, { qtySum: 0, rows: [] })
        cm.get(contractNo).qtySum += qty
        cm.get(contractNo).rows.push({ groupCode, qty, row: r, group: g })
      }
    }
  }

  return { invToGroup, invToGroups, invToContractsSet, invToContractsMap }
}

function runChecks({ osRows, guRows, mzRows, molRows, dogRows }) {
  issueSeq = 1
  const out = []

  const { molToFilial, molToSet } = buildMolMaps(molRows)
  const contractMaps = buildContractMaps(dogRows)
  const {
    contractsByNo,
    contractNoToFilial,
    contractOsInvSet,
    contractOsLinesByInv,
    contractMzByName,
  } = contractMaps

  const dogInvIndex = buildDogInvIndex(contractMaps)

  const {
    invToGroup: guInvToGroup,
    invToGroups: guInvToGroupsDbg,
    invToContractsSet: guInvToContractsSet,
    invToContractsMap: guInvToContractsMap
  } = buildGuInvMaps(guRows)

  // 0) Инв номер встречается в нескольких договорах (по данным DogovoryFull)
  for (const [invKey, rec] of dogInvIndex.entries()) {
    if (rec.contractNos.size > 1) {
      const list = Array.from(rec.contractNos).sort((a, b) => a - b)
      out.push(makeIssue('critical', 'DOG_INV_IN_MULTIPLE_CONTRACTS',
        `Инв. № ${invKey} встречается в разных договорах: ${list.map(formatInt).join(', ')}`, {
          entity: 'Договоры',
          inv: invKey,
          details: {
            inv: invKey,
            contractNos: list,
            byContract: list.map(no => {
              const x = rec.byContract.get(no)
              return {
                contractNo: no,
                filial: x?.filial || '',
                contract: x?.contract || null,
                lines: x?.lines || []
              }
            })
          }
        }
      ))
    }
  }

  // 1) МОЛ в нескольких филиалах
  for (const [mol, set] of molToSet.entries()) {
    if (set.size > 1) {
      out.push(makeIssue('warn', 'MOL_MULTI_FILIAL', `МОЛ встречается в нескольких филиалах: ${Array.from(set).join(', ')}`, {
        entity: 'МОЛ',
        mol,
        filial: Array.from(set).join(', '),
        details: { mol, filials: Array.from(set) }
      }))
    }
  }

  // 2) ОС индексы
  const osByInv = new Map() // invKey -> osRow
  const osInvList = new Map() // invKey -> osRow[]
  for (const o of osRows) {
    const invKey = normalizeInv(o.ИнвентарныйНомер ?? '')
    if (!invKey) {
      out.push(makeIssue('warn', 'OS_EMPTY_INV', 'В справочнике ОС есть запись без инвентарного номера', {
        entity: 'ОС',
        name: normalizeStr(o.НаименованиеОС ?? o.Наименование ?? ''),
        inv: '',
        contractNo: toNum(o.Договор ?? 0),
        mol: normalizeStr(o.МатериальноОтветственный ?? ''),
        filial: molToFilial.get(normalizeStr(o.МатериальноОтветственный ?? '')) || 'Неопределено',
        details: { os: o }
      }))
      continue
    }

    if (!osInvList.has(invKey)) osInvList.set(invKey, [])
    osInvList.get(invKey).push(o)
    if (!osByInv.has(invKey)) osByInv.set(invKey, o)
  }

  for (const [invKey, list] of osInvList.entries()) {
    if (list.length > 1) {
      out.push(makeIssue('critical', 'OS_DUP_INV', `Дубли инв. номера в справочнике ОС: ${invKey} (шт. ${list.length})`, {
        entity: 'ОС',
        inv: invKey,
        details: { inv: invKey, rows: list }
      }))
    }
  }

  // 3) ОС -> договоры
  for (const o of osRows) {
    const invRaw = normalizeStr(o.ИнвентарныйНомер ?? '')
    const invKey = normalizeInv(invRaw)
    const contractNo = toNum(o.Договор ?? 0)
    const otherPlace = normalizeStr(o.ИноеМестоНахождения ?? '')
    const mol = normalizeStr(o.МатериальноОтветственный ?? '')
    const filialMol = molToFilial.get(mol) || 'Неопределено'
    const name = normalizeStr(o.НаименованиеОС ?? o.Наименование ?? '')

    if (contractNo > 0) {
      const c = contractsByNo.get(contractNo)
      if (!c) {
        out.push(makeIssue('critical', 'OS_CONTRACT_NOT_FOUND', `ОС ссылается на договор №${formatInt(contractNo)}, но такого договора нет в DogovoryFull`, {
          entity: 'ОС',
          name,
          inv: invKey || invRaw,
          contractNo,
          mol,
          filial: filialMol,
          details: { os: o }
        }))
      } else {
        if (otherPlace) {
          out.push(makeIssue('warn', 'OS_CONTRACT_AND_OTHER_PLACE', `У ОС указан договор №${formatInt(contractNo)} и заполнено "Иное место": "${otherPlace}"`, {
            entity: 'ОС',
            name,
            inv: invKey || invRaw,
            contractNo,
            mol,
            filial: pickContractFilial(c) || filialMol,
            details: { os: o, contract: c }
          }))
        }

        if (invKey) {
          const set = contractOsInvSet.get(contractNo)
          if (!set || !set.has(invKey)) {
            // ДОБАВЛЕНО: покажем, где этот инв реально встречается (если встречается)
            const rec = dogInvIndex.get(invKey)
            const foundList = rec && rec.contractNos && rec.contractNos.size > 0
              ? Array.from(rec.contractNos).sort((a, b) => a - b)
              : []

            const foundLabel = foundList.length
              ? ` Найдено в договорах: ${foundList
                  .slice(0, 10)
                  .map(no => {
                    const x = rec?.byContract?.get(no)
                    const fil = x?.filial ? ` (${x.filial})` : ''
                    return `№${formatInt(no)}${fil}`
                  })
                  .join(', ')}${foundList.length > 10 ? ' …' : ''}`
              : ''

            out.push(makeIssue('critical', 'OS_INV_NOT_IN_CONTRACT', `ОС привязано к договору №${formatInt(contractNo)}, но инв. № отсутствует в составе договора.${foundLabel}`, {
              entity: 'ОС',
              name,
              inv: invKey,
              contractNo,
              mol,
              filial: pickContractFilial(c) || filialMol,
              details: {
                os: o,
                contract: c,
                inv: invKey,
                contractOsInv: set ? Array.from(set).slice(0, 200) : [],
                foundInContracts: foundList.map(no => {
                  const x = rec?.byContract?.get(no)
                  return {
                    contractNo: no,
                    filial: x?.filial || '',
                    contract: x?.contract || null,
                    lines: x?.lines || []
                  }
                })
              }
            }))
          }
        }

        const filialContract = pickContractFilial(c)
        if (filialContract && filialMol && filialMol !== 'Неопределено' && filialContract !== filialMol) {
          out.push(makeIssue('warn', 'OS_MOL_FILIAL_MISMATCH',
            `Филиал договора (${filialContract}) не совпадает с филиалом МОЛ (${filialMol})`, {
              entity: 'ОС',
              name,
              inv: invKey || invRaw,
              contractNo,
              mol,
              filial: filialContract,
              details: { os: o, contract: c, filialContract, filialMol }
            }
          ))
        }
      }
    } else {
      if (!otherPlace) {
        out.push(makeIssue('info', 'OS_UNDEFINED_PLACE', 'ОС без договора и без "Иного места" — местонахождение неопределено', {
          entity: 'ОС',
          name,
          inv: invKey || invRaw,
          contractNo: 0,
          mol,
          filial: filialMol,
          details: { os: o }
        }))
      }
    }
  }

  // 3.1) ОС без договора, но инв найден в DogovoryFull
  for (const o of osRows) {
    const invKey = normalizeInv(o.ИнвентарныйНомер ?? '')
    if (!invKey) continue

    const contractNo = toNum(o.Договор ?? 0)
    if (contractNo > 0) continue

    // если этот инв ещё и в ГУ — тут отдельно ловится INV_IN_OS_AND_GU
    if (guInvToGroupsDbg.has(invKey)) continue

    const rec = dogInvIndex.get(invKey)
    if (!rec || rec.contractNos.size === 0) continue

    const list = Array.from(rec.contractNos).sort((a, b) => a - b)
    const name = normalizeStr(o.НаименованиеОС ?? o.Наименование ?? '')
    const mol = normalizeStr(o.МатериальноОтветственный ?? '')
    const filialMol = molToFilial.get(mol) || 'Неопределено'

    out.push(makeIssue('warn', 'OS_NOT_LINKED_BUT_IN_DOG',
      `ОС (инв ${invKey}) в справочнике без договора, но найдено в договорах: ${list
        .slice(0, 12)
        .map(no => {
          const x = rec.byContract.get(no)
          const fil = x?.filial ? ` (${x.filial})` : ''
          return `№${formatInt(no)}${fil}`
        })
        .join(', ')}${list.length > 12 ? '…' : ''}`, {
        entity: 'ОС',
        name,
        inv: invKey,
        mol,
        filial: filialMol,
        details: {
          os: o,
          inv: invKey,
          foundInContracts: list.map(no => {
            const x = rec.byContract.get(no)
            return {
              contractNo: no,
              filial: x?.filial || '',
              contract: x?.contract || null,
              lines: x?.lines || []
            }
          })
        }
      }
    ))
  }

  // 4) Договор -> ОС/ГУ
  for (const [contractNo, invSet] of contractOsInvSet.entries()) {
    const c = contractsByNo.get(contractNo)
    const filial = pickContractFilial(c) || contractNoToFilial.get(contractNo) || ''

    for (const invKey of invSet.values()) {
      const os = osByInv.get(invKey)

      if (!os) {
        const guInfo = guInvToGroup.get(invKey)
        if (!guInfo) {
          out.push(makeIssue('critical', 'CONTRACT_OS_NOT_IN_OS_OR_GU',
            `В договоре №${formatInt(contractNo)} есть ОС/ГУ (инв ${invKey}), но такого инв нет ни в справочнике ОС, ни в ГУ`, {
              entity: 'Договор',
              name: pickContractName(c),
              inv: invKey,
              contractNo,
              filial,
              details: {
                contract: c,
                inv: invKey,
                lines: contractOsLinesByInv.get(contractNo)?.get(invKey) || []
              }
            }
          ))
        } else {
          const setContracts = guInvToContractsSet.get(invKey)
          if (!setContracts || setContracts.size === 0) {
            out.push(makeIssue('warn', 'CONTRACT_OS_IN_GU_BUT_NOT_LINKED',
              `Инв ${invKey} найден в ГУ (${guInfo.groupCode}), но в ГУ.ВДоговорах нет явной привязки к договору №${formatInt(contractNo)}`, {
                entity: 'Договор',
                name: pickContractName(c),
                inv: invKey,
                contractNo,
                filial,
                details: {
                  contract: c,
                  inv: invKey,
                  guGroup: guInfo.group,
                  guGroupCode: guInfo.groupCode,
                  guContractsForInv: setContracts ? Array.from(setContracts) : []
                }
              }
            ))
          } else if (!setContracts.has(contractNo)) {
            out.push(makeIssue('critical', 'CONTRACT_OS_IN_GU_WRONG_CONTRACT',
              `Инв ${invKey} найден в ГУ (${guInfo.groupCode}), но привязан к другим договорам: ${Array.from(setContracts).map(formatInt).join(', ')} (а в договоре стоит №${formatInt(contractNo)})`, {
                entity: 'Договор',
                name: pickContractName(c),
                inv: invKey,
                contractNo,
                filial,
                details: {
                  contract: c,
                  inv: invKey,
                  guGroup: guInfo.group,
                  guGroupCode: guInfo.groupCode,
                  guContractsForInv: Array.from(setContracts)
                }
              }
            ))
          }
        }

        continue
      }

      const osContractNo = toNum(os.Договор ?? 0)
      if (osContractNo !== contractNo) {
        out.push(makeIssue('critical', 'CONTRACT_OS_WRONG_LINK',
          `В договоре №${formatInt(contractNo)} есть ОС (инв ${invKey}), но в справочнике ОС.Договор = ${formatInt(osContractNo)}`, {
            entity: 'Договор',
            name: pickContractName(c),
            inv: invKey,
            contractNo,
            filial,
            details: {
              contract: c,
              os,
              inv: invKey,
              contractLines: contractOsLinesByInv.get(contractNo)?.get(invKey) || []
            }
          }
        ))
      }
    }

    const rows = Array.isArray(c?.СоставОборудования) ? c.СоставОборудования : []
    for (const r of rows) {
      const typ = normalizeStr(r.Тип ?? '').toUpperCase()
      if (typ === 'ОС') {
        const invKey = normalizeInv(r.ИнвентарныйНомер ?? '')
        if (!invKey) {
          out.push(makeIssue('info', 'CONTRACT_OS_EMPTY_INV',
            `В договоре №${formatInt(contractNo)} есть строка "ОС" без инвентарного номера (возможно ГУ без номеров)`, {
              entity: 'Договор',
              name: pickContractName(c),
              inv: '',
              contractNo,
              filial,
              details: { contract: c, row: r }
            }
          ))
        }
      }
    }
  }

  // 5) ГУ проверки + ОТЛОВ "инв есть в ИнвентарныйНомера, но нет в ВДоговорах, хотя в договоре он есть" (с подробным выводом)
  for (const g of guRows) {
    const groupCode = normalizeStr(g.Код ?? g.КодПоБгу ?? g.Наименование ?? 'ГУ')
    const name = normalizeStr(g.НаименованиеОС ?? g.Наименование ?? '')
    const mol = normalizeStr(g.МатериальноОтветственный ?? g.МОЛ ?? '')
    const filialMol = molToFilial.get(mol) || 'Неопределено'

    const totalQty = toNum(g.Количество ?? 0)
    const colVD = toNum(g.КолВДоговорах ?? 0)
    const colOther = toNum(g.КолИноеМестоНахождения ?? 0)

    const invList = Array.isArray(g.ИнвентарныйНомера) ? g.ИнвентарныйНомера : []
    const invSetList = new Set(invList.map(x => normalizeInv(x.ИнвентарныйНомер ?? x)).filter(Boolean))

    const list = Array.isArray(g.ВДоговорах) ? g.ВДоговорах : []

    if (list.length === 0 && totalQty > 0) {
      out.push(makeIssue('info', 'GU_NO_DISTRIBUTION', 'В ГУ нет распределения по договорам (ВДоговорах пуст), но количество > 0', {
        entity: 'ГУ',
        name,
        code: groupCode,
        mol,
        filial: filialMol,
        details: { group: g }
      }))
    }

    let sumVD = 0
    let sumOtherByRows = 0

    // какие инв присутствуют в ВДоговорах
    const vdInvSet = new Set()

    // для проверки “один и тот же номер в разных договорах” внутри группы
    const invToContractsInThisGroup = new Map() // invKey -> Set(contractNo>0)

    for (const e of list) {
      const contractNo = toNum(e.НомерДоговора ?? e.Номер_Договора ?? 0)
      const otherPlace = normalizeStr(e.ИноеМестоНахождения ?? '')
      const invRaw = normalizeStr(e.ИнвентарныйНомер ?? '')
      const qty = toNum(e.Количество ?? 0)
      if (qty <= 0) continue
      sumVD += qty

      const isBezNomera = invRaw.toLowerCase() === 'без номера'
      const invKey = isBezNomera ? '' : normalizeInv(invRaw)

      if (invKey) vdInvSet.add(invKey)

      if (contractNo > 0 && !contractsByNo.has(contractNo)) {
        out.push(makeIssue('critical', 'GU_CONTRACT_NOT_FOUND', `ГУ ссылается на договор №${formatInt(contractNo)}, но такого договора нет`, {
          entity: 'ГУ',
          name,
          code: groupCode,
          contractNo,
          mol,
          filial: filialMol,
          details: { group: g, row: e }
        }))
      }

      if (contractNo === 0 && !otherPlace) {
        out.push(makeIssue('warn', 'GU_UNDEFINED_PLACE_ROW', 'В ГУ есть строка с НомерДоговора=0, но ИноеМестоНахождения пустое', {
          entity: 'ГУ',
          name,
          code: groupCode,
          mol,
          filial: filialMol,
          details: { group: g, row: e }
        }))
      }

      if (contractNo === 0 && otherPlace) sumOtherByRows += qty

      if (invKey) {
        if (!invSetList.has(invKey)) {
          out.push(makeIssue('warn', 'GU_INV_NOT_IN_LIST', `Инв. № "${invKey}" используется в ВДоговорах, но отсутствует в ИнвентарныйНомера группы`, {
            entity: 'ГУ',
            name,
            inv: invKey,
            code: groupCode,
            contractNo,
            mol,
            filial: contractNo > 0 ? (contractNoToFilial.get(contractNo) || filialMol) : filialMol,
            details: { group: g, row: e, invSetList: Array.from(invSetList).slice(0, 200) }
          }))
        }

        if (contractNo > 0) {
          if (!invToContractsInThisGroup.has(invKey)) invToContractsInThisGroup.set(invKey, new Set())
          invToContractsInThisGroup.get(invKey).add(contractNo)

          // проверяем, что (инв, договор) реально присутствует в DogovoryFull
          const rec = dogInvIndex.get(invKey)
          const ok = rec && rec.contractNos && rec.contractNos.has(contractNo)
          if (!ok) {
            out.push(makeIssue('warn', 'GU_INV_CONTRACT_NOT_IN_DOG',
              `ГУ: инв "${invKey}" указан в ВДоговорах для договора №${formatInt(contractNo)}, но в DogovoryFull этот инв в составе договора не найден`, {
                entity: 'ГУ',
                name,
                inv: invKey,
                code: groupCode,
                contractNo,
                mol,
                filial: contractNoToFilial.get(contractNo) || filialMol,
                details: {
                  group: g,
                  row: e,
                  inv: invKey,
                  contractNo,
                  dogHint: rec ? { contractNosFound: Array.from(rec.contractNos) } : null
                }
              }
            ))
          }
        }
      }
    }

    // ✅ ИСПРАВЛЕНО: вместо "например" — отдельная строка на каждый инв. номер
    // инв есть в ИнвентарныйНомера, но НЕТ в ВДоговорах, хотя в DogovoryFull он присутствует (например: 41013403247)
    for (const invKey of invSetList.values()) {
      if (vdInvSet.has(invKey)) continue

      const rec = dogInvIndex.get(invKey)
      if (!rec || !rec.contractNos || rec.contractNos.size === 0) continue

      const contractNos = Array.from(rec.contractNos).sort((a, b) => a - b)
      const byContract = contractNos.slice(0, 50).map(no => {
        const x = rec.byContract.get(no)
        return {
          contractNo: no,
          filial: x?.filial || '',
          contract: x?.contract || null,
          lines: x?.lines || []
        }
      })

      const label = contractNos
        .slice(0, 10)
        .map(no => {
          const x = rec.byContract.get(no)
          const fil = x?.filial ? ` (${x.filial})` : ''
          return `№${formatInt(no)}${fil}`
        })
        .join(', ') + (contractNos.length > 10 ? ' …' : '')

      const singleContract = contractNos.length === 1 ? contractNos[0] : 0

      // если филиал один и тот же по найденным договорам — покажем его, иначе оставим филиал МОЛ
      const filialSet = new Set(byContract.map(x => x.filial).filter(Boolean))
      const filialOut = filialSet.size === 1 ? Array.from(filialSet)[0] : filialMol

      out.push(makeIssue(
        'critical',
        'GU_INV_IN_LIST_NOT_IN_VD_BUT_IN_DOG',
        `Инв. № ${invKey} есть в договоре(ах) ${label}, но отсутствует в ГУ.ВДоговорах (не отражён/не распределён)`,
        {
          entity: 'ГУ',
          name,
          inv: invKey,          // ВАЖНО: в колонке "Инв/Код" будет сам инв. номер
          code: groupCode,      // код группы остаётся в "code" и в details
          contractNo: singleContract, // если один договор — покажем в колонке "Договор"
          mol,
          filial: singleContract ? (rec.byContract.get(singleContract)?.filial || filialOut) : filialOut,
          details: {
            group: g,
            groupCode,
            inv: invKey,
            note: 'Инв. номер найден в составе договора (DogovoryFull), но отсутствует в распределении этой группы (ГУ.ВДоговорах).',
            foundInContracts: byContract
          }
        }
      ))
    }

    // внутри группы один и тот же инв числится в разных договорах
    for (const [invKey, setC] of invToContractsInThisGroup.entries()) {
      if (setC.size > 1) {
        const listC = Array.from(setC).sort((a, b) => a - b)
        out.push(makeIssue('critical', 'GU_INV_IN_MULTIPLE_CONTRACTS',
          `Инв. № "${invKey}" в группе ГУ (${groupCode}) указан в разных договорах: ${listC.map(formatInt).join(', ')}`, {
            entity: 'ГУ',
            inv: invKey,
            code: groupCode,
            name,
            mol,
            filial: filialMol,
            details: {
              group: g,
              inv: invKey,
              contracts: listC,
              guRowsByContract: (() => {
                const cm = guInvToContractsMap.get(invKey)
                if (!cm) return []
                return listC.map(no => ({
                  contractNo: no,
                  qtySum: cm.get(no)?.qtySum ?? 0,
                  rows: (cm.get(no)?.rows ?? []).slice(0, 20)
                }))
              })()
            }
          }
        ))
      }
    }

    if (colVD > 0 && sumVD !== colVD) {
      out.push(makeIssue('warn', 'GU_SUM_MISMATCH_COLVD', `Сумма ВДоговорах (${formatInt(sumVD)}) не равна КолВДоговорах (${formatInt(colVD)})`, {
        entity: 'ГУ',
        name,
        code: groupCode,
        mol,
        filial: filialMol,
        details: { group: g, sumVD, colVD }
      }))
    }

    if (colOther > 0 && sumOtherByRows !== colOther) {
      out.push(makeIssue('warn', 'GU_SUM_MISMATCH_COLOTHER', `Сумма "Иное место" по строкам (${formatInt(sumOtherByRows)}) не равна КолИноеМестоНахождения (${formatInt(colOther)})`, {
        entity: 'ГУ',
        name,
        code: groupCode,
        mol,
        filial: filialMol,
        details: { group: g, sumOtherByRows, colOther }
      }))
    }

    if (totalQty > 0 && colVD > totalQty) {
      out.push(makeIssue('critical', 'GU_COLVD_GT_TOTAL', `КолВДоговорах (${formatInt(colVD)}) больше общего Количество (${formatInt(totalQty)})`, {
        entity: 'ГУ',
        name,
        code: groupCode,
        mol,
        filial: filialMol,
        details: { group: g, totalQty, colVD }
      }))
    }
  }

  // дубль инв по нескольким группам ГУ
  for (const [invKey, set] of guInvToGroupsDbg.entries()) {
    if (set.size > 1) {
      out.push(makeIssue('critical', 'GU_INV_IN_MULTIPLE_GROUPS', `Инв. № ${invKey} встречается в нескольких группах ГУ: ${Array.from(set).join(', ')}`, {
        entity: 'ГУ',
        inv: invKey,
        details: { inv: invKey, groups: Array.from(set) }
      }))
    }
  }

  // инв одновременно в ОС и ГУ
  for (const invKey of guInvToGroupsDbg.keys()) {
    if (osByInv.has(invKey)) {
      out.push(makeIssue('critical', 'INV_IN_OS_AND_GU', `Инв. № ${invKey} одновременно учтён как обычное ОС и в ГУ`, {
        entity: 'Инв',
        inv: invKey,
        details: { os: osByInv.get(invKey), guGroups: Array.from(guInvToGroupsDbg.get(invKey) || []) }
      }))
    }
  }

  // 6) МЗ проверки (как было)
  const mzByNameNorm = new Map()
  for (const m of mzRows) {
    const name = normalizeStr(m.НаименованиеМЗ ?? m.Наименование ?? '')
    const nameNorm = normalizeName(name || 'без_наименования')
    if (!mzByNameNorm.has(nameNorm)) mzByNameNorm.set(nameNorm, [])
    mzByNameNorm.get(nameNorm).push(m)
  }

  for (const m of mzRows) {
    const name = normalizeStr(m.НаименованиеМЗ ?? m.Наименование ?? '')
    const nameNorm = normalizeName(name || 'без_наименования')
    const mol = normalizeStr(m.МатериальноОтветственный ?? m.МОЛ ?? '')
    const filialMol = molToFilial.get(mol) || 'Неопределено'

    const totalQty = toNum(m.Количество ?? 0)
    const colVD = toNum(m.КолВДоговорах ?? 0)
    const otherPlace = normalizeStr(m.ИноеМестоНахождения ?? '')
    const code = normalizeStr(m.КодПоБгу ?? m.КодПоБГУ ?? '')

    const contractsList = Array.isArray(m.Договоры) ? m.Договоры : (Array.isArray(m.ВДоговорах) ? m.ВДоговорах : [])
    let sumContractQty = 0

    for (const e of contractsList) {
      const contractNo = toNum(e.НомерДоговора ?? e.Номер_Договора ?? e.Номер ?? 0)
      const qty = toNum(e.Количество ?? 0)
      if (qty <= 0) continue
      sumContractQty += qty

      if (contractNo > 0 && !contractsByNo.has(contractNo)) {
        out.push(makeIssue('critical', 'MZ_CONTRACT_NOT_FOUND', `МЗ ссылается на договор №${formatInt(contractNo)}, но такого договора нет`, {
          entity: 'МЗ',
          name,
          code,
          contractNo,
          mol,
          filial: filialMol,
          details: { mz: m, row: e }
        }))
      }

      if (contractNo > 0 && contractsByNo.has(contractNo)) {
        const mp = contractMzByName.get(contractNo)
        if (mp && !mp.has(nameNorm)) {
          out.push(makeIssue('warn', 'MZ_NOT_IN_CONTRACT_COMPOSITION', `МЗ связано с договором №${formatInt(contractNo)}, но МЗ с таким названием не найдено в составе договора (сверка по имени)`, {
            entity: 'МЗ',
            name,
            code,
            contractNo,
            mol,
            filial: contractNoToFilial.get(contractNo) || filialMol,
            details: {
              mz: m,
              contract: contractsByNo.get(contractNo),
              mzNameNorm: nameNorm,
              contractMzNames: mp ? Array.from(mp.keys()).slice(0, 80) : []
            }
          }))
        }
      }

      if (contractNo > 0 && contractsByNo.has(contractNo)) {
        const filialContract = contractNoToFilial.get(contractNo) || pickContractFilial(contractsByNo.get(contractNo))
        if (filialContract && filialMol && filialMol !== 'Неопределено' && filialContract !== filialMol) {
          out.push(makeIssue('warn', 'MZ_MOL_FILIAL_MISMATCH', `Филиал договора (${filialContract}) не совпадает с филиалом МОЛ (${filialMol})`, {
            entity: 'МЗ',
            name,
            code,
            contractNo,
            mol,
            filial: filialContract,
            details: { mz: m, contract: contractsByNo.get(contractNo), filialContract, filialMol }
          }))
        }
      }
    }

    if (colVD > 0 && sumContractQty !== colVD) {
      out.push(makeIssue('warn', 'MZ_SUM_MISMATCH_COLVD', `Сумма по договорам (${formatInt(sumContractQty)}) не равна КолВДоговорах (${formatInt(colVD)})`, {
        entity: 'МЗ',
        name,
        code,
        mol,
        filial: filialMol,
        details: { mz: m, sumContractQty, colVD }
      }))
    }

    if (totalQty > 0 && colVD > totalQty) {
      out.push(makeIssue('critical', 'MZ_COLVD_GT_TOTAL', `КолВДоговорах (${formatInt(colVD)}) больше общего Количество (${formatInt(totalQty)})`, {
        entity: 'МЗ',
        name,
        code,
        mol,
        filial: filialMol,
        details: { mz: m, totalQty, colVD }
      }))
    }

    const remaining = Math.max(0, totalQty - sumContractQty)
    if (remaining > 0 && !otherPlace) {
      out.push(makeIssue('info', 'MZ_UNDEFINED_REMAINDER', `Остаток (${formatInt(remaining)}) не распределён по договорам и “Иное место” не заполнено — местонахождение неопределено`, {
        entity: 'МЗ',
        name,
        code,
        mol,
        filial: filialMol,
        details: { mz: m, remaining, sumContractQty, totalQty }
      }))
    }
  }

  // 7) Договор -> МЗ (эвристика по имени)
  for (const d of dogRows) {
    const contractNo = pickContractNo(d)
    if (contractNo <= 0) continue
    const filial = pickContractFilial(d)
    const rows = Array.isArray(d.СоставОборудования) ? d.СоставОборудования : []

    for (const r of rows) {
      const typ = normalizeStr(r.Тип ?? '').toUpperCase()
      if (!typ.includes('МЗ')) continue

      const nm = normalizeStr(r.НаименованиеМЗ ?? r.НаименованиеОС ?? r.Наименование ?? '')
      const nameNorm = normalizeName(nm || 'без_наименования')

      if (!mzByNameNorm.has(nameNorm)) {
        out.push(makeIssue('warn', 'CONTRACT_MZ_NOT_IN_MZ_REF', `В договоре №${formatInt(contractNo)} есть МЗ "${nm}", но в справочнике МЗ не найдено (сверка по имени)`, {
          entity: 'Договор',
          name: nm,
          contractNo,
          filial,
          details: { contract: d, row: r, nameNorm }
        }))
      }
    }
  }

  // 8) Стоимость
  for (const d of dogRows) {
    const contractNo = pickContractNo(d)
    if (contractNo <= 0) continue
    const filial = pickContractFilial(d)
    const rows = Array.isArray(d.СоставОборудования) ? d.СоставОборудования : []

    for (const r of rows) {
      const typ = normalizeStr(r.Тип ?? '').toUpperCase()

      if (typ === 'ОС') {
        const invKey = normalizeInv(r.ИнвентарныйНомер ?? '')
        if (!invKey) continue
        const os = osByInv.get(invKey)
        if (!os && guInvToGroup.has(invKey)) continue
        if (!os) continue

        const cUnit = toNum(r.Стоимость ?? 0)
        const osUnit = toNum(os.СтоимостьПоследняя ?? os.Стоимость ?? 0)

        if (cUnit > 0 && osUnit > 0 && relDiff(cUnit, osUnit) > 0.2) {
          out.push(makeIssue('warn', 'COST_OS_DIFFERS',
            `Стоимость ОС отличается: договор ${cUnit} vs справочник ${osUnit} (inv ${invKey})`, {
              entity: 'Стоимость',
              name: normalizeStr(os.НаименованиеОС ?? os.Наименование ?? ''),
              inv: invKey,
              contractNo,
              filial,
              details: { contract: d, contractRow: r, os, contractUnit: cUnit, osUnit }
            }
          ))
        }
      }

      if (typ.includes('МЗ')) {
        const nm = normalizeStr(r.НаименованиеМЗ ?? r.НаименованиеОС ?? r.Наименование ?? '')
        const nameNorm = normalizeName(nm || 'без_наименования')
        const list = mzByNameNorm.get(nameNorm) || []
        if (list.length === 0) continue

        const cUnit = toNum(r.Стоимость ?? 0)
        if (cUnit <= 0) continue

        const mzUnits = list
          .map(m => {
            const q = toNum(m.Количество ?? 0)
            const s = toNum(m.СтоимостьПоследняя ?? 0)
            return (q > 0) ? (s / q) : 0
          })
          .filter(x => x > 0)

        if (mzUnits.length === 0) continue
        const avg = mzUnits.reduce((a, b) => a + b, 0) / mzUnits.length

        if (avg > 0 && relDiff(cUnit, avg) > 0.2) {
          out.push(makeIssue('warn', 'COST_MZ_DIFFERS',
            `Стоимость МЗ отличается: договор ${cUnit} vs справочник ~${avg.toFixed(2)} (по названию)`, {
              entity: 'Стоимость',
              name: nm,
              contractNo,
              filial,
              details: { contract: d, contractRow: r, mzMatches: list.slice(0, 20), avgUnit: avg, contractUnit: cUnit }
            }
          ))
        }
      }
    }
  }

  return out
}

async function fetchAll() {
  loading.value = true
  error.value = ''
  errorDetails.value = ''
  issues.value = []

  try {
    const [osRes, guRes, mzRes, molRes, dogRes] = await Promise.all([
      http.get(URL_OS),
      http.get(URL_GU),
      http.get(URL_MZ),
      http.get(URL_MOL),
      http.get(URL_DOG),
    ])

    const osRows  = unwrapArray(osRes.data)
    const guRows  = unwrapArray(guRes.data)
    const mzRows  = unwrapArray(mzRes.data)
    const molRows = unwrapArray(molRes.data)
    const dogRows = unwrapArray(dogRes.data)

    issues.value = runChecks({ osRows, guRows, mzRows, molRows, dogRows })
  } catch (e) {
    error.value = 'Не удалось загрузить данные'
    errorDetails.value = e?.message ? String(e.message) : String(e)
  } finally {
    loading.value = false
  }
}

// options
const typeOptions = computed(() => {
  const set = new Set(issues.value.map(x => x.type).filter(Boolean))
  return Array.from(set).sort((a, b) => String(typeLabel(a)).localeCompare(String(typeLabel(b)), 'ru'))
})

const filialOptions = computed(() => {
  const set = new Set()
  for (const it of issues.value) if (it.filial) set.add(it.filial)
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'ru'))
})

const kpi = computed(() => {
  const total = issues.value.length
  const critical = issues.value.filter(x => x.severity === 'critical').length
  const warn = issues.value.filter(x => x.severity === 'warn').length
  const info = issues.value.filter(x => x.severity === 'info').length
  return { total, critical, warn, info }
})

const filteredIssues = computed(() => {
  const q = (search.value || '').toLowerCase()
  return issues.value.filter(it => {
    if (hideInfo.value && it.severity === 'info') return false
    if (fSeverity.value && it.severity !== fSeverity.value) return false
    if (fType.value && it.type !== fType.value) return false
    if (fFilial.value && (it.filial || '') !== fFilial.value) return false

    if (!q) return true
    const hay = `${it.severity} ${it.type} ${it.entity} ${it.name} ${it.inv} ${it.code} ${it.contractNo} ${it.filial} ${it.mol} ${it.message}`.toLowerCase()
    return hay.includes(q)
  })
})

function toggleSort(key) {
  if (sortKey.value === key) {
    sortDir.value = (sortDir.value === 'asc') ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = (key === 'severity' || key === 'contractNo') ? 'desc' : 'asc'
  }
}
function sortArrow(key) {
  if (sortKey.value !== key) return ''
  return sortDir.value === 'asc' ? '▲' : '▼'
}

function severityRank(s) {
  if (s === 'critical') return 3
  if (s === 'warn') return 2
  return 1
}

const sortedIssues = computed(() => {
  const key = sortKey.value
  const dir = sortDir.value === 'asc' ? 1 : -1

  const rows = filteredIssues.value.slice()
  rows.sort((a, b) => {
    if (key === 'severity') {
      const av = severityRank(a.severity)
      const bv = severityRank(b.severity)
      if (av === bv) return String(typeLabel(a.type)).localeCompare(String(typeLabel(b.type)), 'ru')
      return dir * (av - bv)
    }

    if (key === 'contractNo') {
      const av = Number(a.contractNo || 0)
      const bv = Number(b.contractNo || 0)
      if (av === bv) return String(a.name || '').localeCompare(String(b.name || ''), 'ru')
      return dir * (av - bv)
    }

    const av = String(a[key] ?? '')
    const bv = String(b[key] ?? '')
    const cmp = av.localeCompare(bv, 'ru')
    if (cmp !== 0) return dir * cmp
    return String(a.id).localeCompare(String(b.id))
  })
  return rows
})

const shownIssues = computed(() => sortedIssues.value.slice(0, 900))

function openDetails(it) {
  detailsIssue.value = it
  detailsTitle.value = `${severityLabel(it.severity)} — ${typeLabel(it.type)}`
  detailsSearch.value = ''
  detailsOpen.value = true
}

function closeDetails() {
  detailsOpen.value = false
  detailsIssue.value = null
  detailsTitle.value = ''
  detailsSearch.value = ''
}

const prettyDetails = computed(() => {
  const it = detailsIssue.value
  if (!it) return ''
  const obj = it.details ?? {}
  const q = (detailsSearch.value || '').toLowerCase().trim()
  if (!q) return JSON.stringify(obj, null, 2)

  const txt = JSON.stringify(obj, null, 2)
  const lines = txt.split('\n')
  const kept = lines.filter(l => l.toLowerCase().includes(q))
  return kept.length ? kept.join('\n') : '(нет совпадений в details)'
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
  grid-template-columns: repeat(4, minmax(160px, 1fr));
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
.kpi.danger{ border-color:#ffb1b1; background:#fff3f3; }
.kpi-title{ font-size: 13px; opacity: .75; margin-bottom: 6px; }
.kpi-value{ font-size: 22px; font-weight: 900; }

.filters{
  display:grid;
  grid-template-columns: 220px 420px 220px 1fr 220px;
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
.muted{ opacity: .6; font-weight: 600; margin-left: 6px; }

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
.tbl .empty{ text-align:center; opacity:.7; padding: 14px; }

.sortable{ cursor: pointer; user-select: none; }
.sort{ margin-left: 6px; font-size: 12px; opacity: .65; }

.badge{
  display:inline-block;
  padding: 3px 8px;
  border-radius: 999px;
  font-weight: 900;
  font-size: 12px;
}
.b-danger{ background:#ffd7d7; color:#7b0d0d; }
.b-warn{ background:#ffe8b8; color:#7a4d00; }
.b-info{ background:#e7f1ff; color:#1b4f9b; }

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
  width: min(980px, 96vw);
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
  flex-wrap: wrap;
}
.modal-msg{
  margin-bottom: 10px;
}
.filter-inline input{
  width:100%;
  border: 1px solid #d6dbe5;
  border-radius: 8px;
  padding: 8px 10px;
  margin-bottom: 10px;
}
.json{
  background:#0b1020;
  color:#e6edf3;
  border-radius: 10px;
  padding: 12px;
  overflow:auto;
  font-size: 12.5px;
  line-height: 1.35;
}
</style>

