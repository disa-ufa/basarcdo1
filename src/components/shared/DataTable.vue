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
              v-for="col in columns"
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
            <td :colspan="columns.length" class="no-results">Ничего не найдено</td>
          </tr>

          <tr
            v-for="(row, index) in filteredData"
            :key="index"
            :class="getRowClass(row)"
            @click="$event.target.closest('button') ? null : $emit('row-click', row)"
            style="cursor: pointer;"
          >
            <td v-for="col in columns" :key="col.key">
              <!-- Кастомная ячейка через слот -->
              <slot
                :name="`cell-${col.key}`"
                :row="row"
                :value="row[col.key]"
                :column="col"
              >
                <!-- Стандартная отрисовка -->
                <template v-if="col.key === 'actions'">
                  <div v-if="showActionButton(row)">
                    <button
                      @click.stop="() => handleActionClick(row, 'default')"
                      class="action-button"
                      :disabled="row.adding"
                    >
                      {{ row.adding ? 'Добавление...' : 'Добавить' }}
                    </button>
                    <button
                      @click.stop="() => handleActionClick(row, 'hoz')"
                      class="action-button"
                      :disabled="row.adding"
                      style="margin-left: 6px; background-color: #28a745"
                    >
                      {{ row.adding ? 'Добавление...' : 'Добавить Хоз' }}
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

<script>
import { ref, computed, watch } from 'vue';

export default {
  name: 'DataTable',
  props: {
    tableData: { type: Array, required: true },
    tableColumns: { type: Array, required: true },
    initialSortKey: { type: String, default: '' },
    initialSortOrder: {
      type: String,
      default: 'asc',
      validator: value => ['asc', 'desc'].includes(value)
    },
    actionButtonText: { type: Function, default: () => 'Открыть' },
    showActionButton: { type: Function, default: () => true }
  },
  emits: ['sort-changed', 'action-triggered', 'row-click'],
  setup(props, { emit }) {
    const data = ref([...props.tableData]);
    const columns = ref([...props.tableColumns]);

    const searchQuery = ref('');
    const sortKey = ref(props.initialSortKey);
    const sortOrder = ref(props.initialSortOrder);

    const filteredData = computed(() => {
      let result = [...data.value];

      if (searchQuery.value) {
        const search = searchQuery.value.toLowerCase();
        result = result.filter(row =>
          columns.value
            .filter(col => col.key !== 'actions')
            .some(col => {
              const value = row[col.key];
              return value && String(value).toLowerCase().includes(search);
            })
        );
      }

      if (sortKey.value && sortKey.value !== 'actions') {
        result.sort((a, b) => {
          let valueA = a[sortKey.value];
          let valueB = b[sortKey.value];
          if (typeof valueA === 'string') valueA = valueA.toLowerCase();
          if (typeof valueB === 'string') valueB = valueB.toLowerCase();

          if (valueA < valueB) return sortOrder.value === 'asc' ? -1 : 1;
          if (valueA > valueB) return sortOrder.value === 'asc' ? 1 : -1;
          return 0;
        });
      }

      return result;
    });

    const sortBy = key => {
      if (key === 'actions') return;
      if (sortKey.value === key) {
        sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
      } else {
        sortKey.value = key;
        sortOrder.value = 'asc';
      }
      emit('sort-changed', { key: sortKey.value, order: sortOrder.value });
    };

    const handleSearch = () => {
      clearTimeout(window._searchTimeout);
      window._searchTimeout = setTimeout(() => {}, 300);
    };

    const handleActionClick = (row, type) => {
      emit('action-triggered', { row, type });
    };

    function getRowClass(row) {
      if (row && row.rowClass) return row.rowClass;

      if (Object.prototype.hasOwnProperty.call(row, '_workActive')) {
        return row._workActive ? '' : 'row-inactive';
      }

      const st = row && row.Обучение_Статус;
      if (
        st === false || st === 0 ||
        (typeof st === 'string' && ['неактивен', 'нет', 'false', 'ложь', '0'].includes(st.toLowerCase()))
      ) {
        return 'row-inactive';
      }
      return '';
    }

    watch(() => props.tableData, newVal => {
      data.value = [...newVal];
    }, { deep: true });

    watch(() => props.tableColumns, newVal => {
      columns.value = [...newVal];
    }, { deep: true });

    return {
      columns,
      searchQuery,
      sortKey,
      sortOrder,
      filteredData,
      sortBy,
      handleSearch,
      handleActionClick,
      getRowClass,
    };
  }
};
</script>

<style scoped>
.data-table th.non-sortable { cursor: default; }
.data-table th.non-sortable:hover { background-color: #f8f9fa; }
.action-button {
  padding: 5px 10px; background-color: #007bff; color: white; border: none;
  border-radius: 4px; cursor: pointer; font-size: 13px; transition: background-color 0.2s;
}
.action-button:hover { background-color: #0056b3; }
.data-table-component { font-family: Arial, sans-serif; width: 100%; max-width: 100%; }
.search-container { margin-bottom: 15px; }
.search-input {
  padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; width: 100%; max-width: 300px; font-size: 14px; transition: border-color 0.2s;
}
.search-input:focus { outline: none; border-color: #0077ff; box-shadow: 0 0 0 2px rgba(0,119,255,.1); }
.table-container { overflow-x: auto; max-width: 100%; }
.data-table { width: 100%; border-collapse: collapse; border: 1px solid #eee; }
.data-table th {
  background-color: #f8f9fa; padding: 12px 15px; text-align: left; font-weight: 600;
  color: #333; border-bottom: 2px solid #ddd; cursor: pointer; user-select: none; position: relative; transition: background-color 0.2s;
}
.data-table th:hover { background-color: #f0f0f0; }
.data-table th.active { background-color: #e9ecef; }
.data-table td { padding: 10px 15px; border-bottom: 1px solid #eee; color: #333; }
.data-table tr:hover { background-color: #f5f5f5; }
.data-table .no-results { text-align: center; padding: 20px; color: #666; font-style: italic; }
.sort-indicator { display: inline-block; margin-left: 5px; font-size: .8em; }
.row-inactive { opacity: .43; background: #f7f7f7 !important; }
@media screen and (max-width: 767px) {
  .data-table th, .data-table td { padding: 8px 10px; font-size: 14px; }
}
.os-missing-row { background-color: #ffe0e6 !important; }
</style>
