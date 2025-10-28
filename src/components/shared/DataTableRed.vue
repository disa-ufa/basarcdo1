<template>
  <div class="data-table-component">
    <!-- Поле поиска -->
    <div class="search-container">
      <input
        type="text"
        v-model="searchQuery"
        @input="handleSearch"
        placeholder="Поиск..."
        class="search-input"
      />
    </div>

    <!-- Таблица -->
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
            <td :colspan="columns.length" class="no-results">
              Ничего не найдено
            </td>
          </tr>
          <tr v-for="(row, index) in filteredData" :key="index">
            <!-- Итерация по колонкам для каждой строки -->
            <td v-for="col in columns" :key="col.key">
              <!-- Если это колонка "Действия" (проверяем по ключу) -->
              <template v-if="col.key === 'actions'">
                <button @click="handleActionClick(row)" class="action-button">
                  Открыть
                </button>
              </template>
              <!-- Иначе отображаем обычное значение ячейки -->
              <template v-else>
                {{ row[col.key] }}
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch } from 'vue'; // Добавляем watch

export default {
  name: 'DataTable',

  props: {
    tableData: {
      type: Array,
      required: true
    },
    tableColumns: {
      type: Array,
      required: true
    },
    initialSortKey: {
      type: String,
      default: ''
    },
    initialSortOrder: {
      type: String,
      default: 'asc',
      validator: (value) => ['asc', 'desc'].includes(value)
    }
  },

  // Добавляем новое событие 'action-triggered'
  emits: ['sort-changed', 'action-triggered'],

  setup(props, { emit }) {
    // Используем ref для props, чтобы отслеживать их изменения
    const data = ref([...props.tableData]); // Создаем копию, чтобы не мутировать props
    const columns = ref([...props.tableColumns]);

    const searchQuery = ref('');
    const sortKey = ref(props.initialSortKey);
    const sortOrder = ref(props.initialSortOrder);

    const filteredData = computed(() => {
      let result = [...data.value]; // Работаем с внутренней копией данных

      if (searchQuery.value) {
        const search = searchQuery.value.toLowerCase();
        result = result.filter(row => {
          // Исключаем колонку 'actions' из поиска
          return columns.value
            .filter(col => col.key !== 'actions') // Фильтруем колонки
            .some(col => {
              const value = row[col.key];
              if (value === null || value === undefined) return false;
              return String(value).toLowerCase().includes(search);
            });
        });
      }

      if (sortKey.value && columns.value.find(col => col.key === sortKey.value && col.key !== 'actions')) {
        result.sort((a, b) => {
          let valueA = a[sortKey.value];
          let valueB = b[sortKey.value];

          if (typeof valueA === 'string') valueA = valueA.toLowerCase();
          if (typeof valueB === 'string') valueB = valueB.toLowerCase();

          // Простая проверка для чисел и строк
          if (valueA < valueB) return sortOrder.value === 'asc' ? -1 : 1;
          if (valueA > valueB) return sortOrder.value === 'asc' ? 1 : -1;
          return 0;
        });
      }

      return result;
    });

    const sortBy = (key) => {
      // Запрещаем сортировку по колонке 'actions'
      if (key === 'actions') {
        return;
      }
      if (sortKey.value === key) {
        sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
      } else {
        sortKey.value = key;
        sortOrder.value = 'asc';
      }
      emit('sort-changed', { key: sortKey.value, order: sortOrder.value });
    };

    let searchTimeout;
    const handleSearch = () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        // Логика поиска уже в computed свойстве filteredData
      }, 300);
    };

    // Функция для обработки клика по кнопке "Открыть"
    const handleActionClick = (row) => {
      console.log('Action clicked for row:', row);
      // Генерируем событие и передаем всю строку данных
      emit('action-triggered', row);
    };

    // Следим за изменениями входных данных и обновляем внутреннее состояние
    watch(() => props.tableData, (newValue) => {
        console.log('DataTable: tableData prop changed');
        data.value = [...newValue]; // Обновляем копию данных
    }, { deep: true });

    watch(() => props.tableColumns, (newValue) => {
        console.log('DataTable: tableColumns prop changed');
        columns.value = [...newValue]; // Обновляем колонки
    }, { deep: true });


    return {
      columns, // Возвращаем ref
      // data, // Не возвращаем data, используем filteredData
      searchQuery,
      sortKey,
      sortOrder,
      filteredData,
      sortBy,
      handleSearch,
      handleActionClick // Делаем доступной в шаблоне
    };
  },

  // Убираем блок watch, так как теперь используем ref и watch внутри setup
  // watch: { ... }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>

.data-table th.non-sortable {
  cursor: default; /* Убираем курсор-указатель для не сортируемых колонок */
}

.data-table th.non-sortable:hover {
  background-color: #f8f9fa; /* Убираем эффект ховера для не сортируемых */
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
  position: relative;
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
}

.data-table tr:hover {
  background-color: #f5f5f5;
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

@media screen and (max-width: 767px) {
  .data-table th,
  .data-table td {
    padding: 8px 10px;
    font-size: 14px;
  }
}
</style>
