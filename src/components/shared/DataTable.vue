<template>
  <div class="data-table-component">
    <div class="search-container">
      <input
        type="text"
        v-model="searchQuery"
        @input="handleSearch"
        placeholder="Поиск..."
        class="search-input"
      />
    </div>

    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th
              v-for="col in columnsLocal"
              :key="col.key"
              @click="col.key !== 'actions' ? sortBy(col.key) : null"
              :class="{ active: sortKey === col.key, 'non-sortable': col.key === 'actions' }"
              :style="{ cursor: col.key === 'actions' ? 'default' : 'pointer' }"
            >
              {{ col.label }}
              <span class="sort-indicator" v-if="sortKey === col.key && col.key !== 'actions'">
                {{ sortOrder === 'asc' ? '▲' : '▼' }}
              </span>
            </th>
          </tr>
        </thead>

        <tbody>
          <tr v-if="filteredData.length === 0">
            <td :colspan="columnsLocal.length" class="no-results">Ничего не найдено</td>
          </tr>

          <tr
            v-for="(row, index) in filteredData"
            :key="index"
            :class="['data-row', getRowClass(row)]"
            @click="handleRowClick($event, row)"
            style="cursor: pointer;"
          >
            <td v-for="col in columnsLocal" :key="col.key">
              <slot
                :name="`cell-${col.key}`"
                :row="row"
                :value="row[col.key]"
                :column="col"
              >
                <template v-if="col.key === 'actions'">
                  <div v-if="showActionButton(row)">
                    <button
                      @click.stop="handleActionClick(row, 'default')"
                      class="action-button"
                      :disabled="row?.adding"
                    >
                      {{ row?.adding ? 'Добавление...' : getActionButtonText(row, 'default') }}
                    </button>

                    <button
                      v-if="showHozButton(row)"
                      @click.stop="handleActionClick(row, 'hoz')"
                      class="action-button action-button-green"
                      :disabled="row?.adding"
                      style="margin-left: 6px;"
                    >
                      {{ row?.adding ? 'Добавление...' : getActionButtonText(row, 'hoz') }}
                    </button>
                  </div>
                </template>

                <template v-else>
                  {{ row[col.key] }}
                </template>
              </slot>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  tableData: { type: Array, default: () => [] },
  tableColumns: { type: Array, default: () => [] },

  items: { type: Array, default: () => [] },
  columns: { type: Array, default: () => [] },

  initialSortKey: { type: String, default: '' },
  initialSortOrder: {
    type: String,
    default: 'asc',
    validator: (v) => ['asc', 'desc'].includes(v)
  },

  actionButtonText: { type: Function, default: null },
  showActionButton: { type: Function, default: () => true },
  showHozButton: { type: Function, default: () => true },
  rowClassField: { type: String, default: 'rowClass' }
})

const emit = defineEmits(['sort-changed', 'action-triggered', 'row-click'])

const columnsLocal = ref([...(props.tableColumns.length ? props.tableColumns : props.columns)])
const dataLocal = ref([...(props.tableData.length ? props.tableData : props.items)])

watch(
  () => props.tableColumns,
  (v) => {
    if (v?.length) columnsLocal.value = [...v]
  },
  { deep: true }
)

watch(
  () => props.columns,
  (v) => {
    if (!props.tableColumns.length && v) columnsLocal.value = [...v]
  },
  { deep: true }
)

watch(
  () => props.tableData,
  (v) => {
    if (v) dataLocal.value = [...v]
  },
  { deep: true }
)

watch(
  () => props.items,
  (v) => {
    if (!props.tableData.length && v) dataLocal.value = [...v]
  },
  { deep: true }
)

const searchQuery = ref('')
const sortKey = ref(props.initialSortKey)
const sortOrder = ref(props.initialSortOrder)

const filteredData = computed(() => {
  let result = [...dataLocal.value]

  if (searchQuery.value) {
    const search = searchQuery.value.toLowerCase()
    result = result.filter((row) =>
      columnsLocal.value
        .filter((col) => col.key !== 'actions')
        .some((col) => {
          const value = row[col.key]
          return value != null && String(value).toLowerCase().includes(search)
        })
    )
  }

  if (sortKey.value && columnsLocal.value.find((c) => c.key === sortKey.value && c.key !== 'actions')) {
    result.sort((a, b) => {
      let valueA = a[sortKey.value]
      let valueB = b[sortKey.value]

      if (typeof valueA === 'string') valueA = valueA.toLowerCase()
      if (typeof valueB === 'string') valueB = valueB.toLowerCase()

      if (valueA < valueB) return sortOrder.value === 'asc' ? -1 : 1
      if (valueA > valueB) return sortOrder.value === 'asc' ? 1 : -1
      return 0
    })
  }

  return result
})

function sortBy(key) {
  if (key === 'actions') return

  if (sortKey.value === key) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortOrder.value = 'asc'
  }

  emit('sort-changed', { key: sortKey.value, order: sortOrder.value })
}

function getRowClass(row) {
  if (!row) return ''

  const field = props.rowClassField || 'rowClass'
  const rowClass = row?.[field]

  if (rowClass) {
    if (typeof rowClass === 'string') return rowClass
    if (Array.isArray(rowClass)) return rowClass.filter(Boolean).join(' ')
    if (typeof rowClass === 'object') {
      return Object.entries(rowClass)
        .filter(([, enabled]) => !!enabled)
        .map(([className]) => className)
        .join(' ')
    }
  }

  if (Object.prototype.hasOwnProperty.call(row, '_workActive')) {
    return row._workActive ? '' : 'row-inactive'
  }

  const st = row?.Обучение_Статус
  if (
    st === false ||
    st === 0 ||
    (typeof st === 'string' &&
      ['неактивен', 'нет', 'false', 'ложь', '0'].includes(st.toLowerCase()))
  ) {
    return 'row-inactive'
  }

  return ''
}

function handleRowClick(event, row) {
  if (event?.target?.closest('button')) return
  emit('row-click', row)
}

function getActionButtonText(row, type) {
  if (typeof props.actionButtonText === 'function') {
    return props.actionButtonText(row, type)
  }

  if (type === 'hoz') return 'Добавить Хоз'
  return 'Добавить'
}

let t
function handleSearch() {
  clearTimeout(t)
  t = setTimeout(() => {}, 300)
}

function handleActionClick(row, type = 'default') {
  emit('action-triggered', { row, type })
}
</script>

<style scoped>
.data-table th.non-sortable {
  cursor: default;
}
.data-table th.non-sortable:hover {
  background-color: #f8f9fa;
}

.action-button {
  padding: 5px 10px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: background-color 0.2s;
}
.action-button:hover {
  background-color: #0056b3;
}
.action-button-green {
  background-color: #28a745;
}
.action-button-green:hover {
  background-color: #218838;
}

.data-table-component {
  font-family: Arial, sans-serif;
  width: 100%;
  max-width: 100%;
}

.search-container {
  margin-bottom: 15px;
}

.search-input {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  width: 100%;
  max-width: 300px;
  font-size: 14px;
  transition: border-color 0.2s;
}
.search-input:focus {
  outline: none;
  border-color: #0077ff;
  box-shadow: 0 0 0 2px rgba(0, 119, 255, 0.1);
}

.table-container {
  overflow-x: auto;
  max-width: 100%;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  border: 1px solid #eee;
}

.data-table th {
  background-color: #f8f9fa;
  padding: 12px 15px;
  text-align: left;
  font-weight: 600;
  color: #333;
  border-bottom: 2px solid #ddd;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s;
}
.data-table th:hover {
  background-color: #f0f0f0;
}
.data-table th.active {
  background-color: #e9ecef;
}

.data-table td {
  padding: 10px 15px;
  border-bottom: 1px solid #eee;
  color: #333;
  vertical-align: top;
}

.data-table tbody tr.data-row:hover td {
  background-color: #f5f5f5;
}

/* Договоры */
.data-table tbody tr.contract-writtenoff-row td {
  background-color: #f8d7da !important;
}
.data-table tbody tr.contract-writtenoff-row:hover td {
  background-color: #f1bcc3 !important;
}

/* Основные средства */
.data-table tbody tr.os-missing-row td {
  background-color: #ffe0e6 !important;
}
.data-table tbody tr.os-group-row td {
  background-color: #e7f5ff !important;
}
.data-table tbody tr.os-group-row.os-missing-row td {
  background-color: #ffe0e6 !important;
}
.data-table tbody tr.os-writtenoff-row td {
  background-color: #f8d7da !important;
}
.data-table tbody tr.os-group-row.os-writtenoff-row td {
  background-color: #f8d7da !important;
}
.data-table tbody tr.os-missing-row.os-writtenoff-row td,
.data-table tbody tr.os-group-row.os-missing-row.os-writtenoff-row td {
  background-color: #f1bcc3 !important;
}

/* Неактивные строки */
.row-inactive {
  opacity: 0.43;
  background: #f7f7f7 !important;
}

.data-table .no-results {
  text-align: center;
  padding: 20px;
  color: #666;
  font-style: italic;
}

.sort-indicator {
  display: inline-block;
  margin-left: 5px;
  font-size: 0.8em;
}

@media (max-width: 767px) {
  .data-table th,
  .data-table td {
    padding: 8px 10px;
    font-size: 14px;
  }
}
</style>