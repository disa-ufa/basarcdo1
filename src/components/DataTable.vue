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
              @click="sortBy(col.key)"
              :class="{ active: sortKey === col.key }"
            >
              {{ col.label }}
              <span class="sort-indicator" v-if="sortKey === col.key">
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
            <td v-for="col in columns" :key="col.key">
              {{ row[col.key] }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
import { ref, computed } from 'vue';

export default {
  name: 'DataTable',
  
  props: {
    /**
     * Массив данных для отображения в таблице
     * Пример: [{ id: 1, name: 'Иван', age: 30 }, ...]
     */
    tableData: {
      type: Array,
      required: true
    },
    
    /**
     * Конфигурация колонок таблицы
     * Пример: [{ key: 'id', label: 'ID' }, { key: 'name', label: 'Имя' }, ...]
     */
    tableColumns: {
      type: Array,
      required: true
    },
    
    /**
     * Начальная колонка для сортировки
     */
    initialSortKey: {
      type: String,
      default: ''
    },
    
    /**
     * Начальный порядок сортировки ('asc' или 'desc')
     */
    initialSortOrder: {
      type: String,
      default: 'asc',
      validator: (value) => ['asc', 'desc'].includes(value)
    }
  },
  
  emits: ['sort-changed'],
  
  setup(props, { emit }) {
    // Данные и колонки
    const data = ref(props.tableData);
    const columns = ref(props.tableColumns);
    
    // Состояние сортировки и поиска
    const searchQuery = ref('');
    const sortKey = ref(props.initialSortKey);
    const sortOrder = ref(props.initialSortOrder);
    
    // Фильтрация и сортировка данных
    const filteredData = computed(() => {
      let result = [...data.value];
      
      // Фильтрация по поисковому запросу
      if (searchQuery.value) {
        const search = searchQuery.value.toLowerCase();
        result = result.filter(row => {
          return Object.values(row).some(value => {
            if (value === null || value === undefined) return false;
            return String(value).toLowerCase().includes(search);
          });
        });
      }
      
      // Сортировка
      if (sortKey.value) {
        result.sort((a, b) => {
          let valueA = a[sortKey.value];
          let valueB = b[sortKey.value];
          
          // Конвертируем значения в нижний регистр для строк
          if (typeof valueA === 'string') valueA = valueA.toLowerCase();
          if (typeof valueB === 'string') valueB = valueB.toLowerCase();
          
          if (valueA < valueB) return sortOrder.value === 'asc' ? -1 : 1;
          if (valueA > valueB) return sortOrder.value === 'asc' ? 1 : -1;
          return 0;
        });
      }
      
      return result;
    });
    
    // Функция для изменения сортировки
    const sortBy = (key) => {
      if (sortKey.value === key) {
        // Если нажата та же колонка, меняем порядок сортировки
        sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
      } else {
        // Если нажата новая колонка, устанавливаем ее и порядок по умолчанию
        sortKey.value = key;
        sortOrder.value = 'asc';
      }
      
      // Уведомляем родителя об изменении сортировки
      emit('sort-changed', { key: sortKey.value, order: sortOrder.value });
    };
    
    // Обработчик поиска с небольшой задержкой для производительности
    let searchTimeout;
    const handleSearch = () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        // Дополнительная логика для сложного поиска может быть здесь
      }, 300);
    };
    
    return {
      columns,
      data,
      searchQuery,
      sortKey,
      sortOrder,
      filteredData,
      sortBy,
      handleSearch
    };
  },
  
  // Обновляем данные при изменении props
  watch: {
    tableData: {
      handler(newValue) {
        this.data = newValue;
      },
      deep: true
    },
    
    tableColumns: {
      handler(newValue) {
        this.columns = newValue;
      },
      deep: true
    }
  }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
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
