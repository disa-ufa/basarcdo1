<script setup>
import axios from 'axios';
import { ref, onMounted, computed } from 'vue';
import DataTable from '@/components/shared/DataTable.vue'

const formatCurrency = (value) => {
  const num = Number(value);
  return isNaN(num)
    ? '—'
    : new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB',
        minimumFractionDigits: 2
      }).format(num);
};

const API_BGU = '/api/BGU/hs/inv/mz';
const API_RCDO = '/api/RCDO/hs/rcdo/MZ';
const API_ADD = '/api/RCDO/hs/rcdo/addMZ';

const USER_BGU = 'Администратор';
const PASS_BGU = '159753';
const USER_RCDO = 'admin';
const PASS_RCDO = '10028585mM';

const mzBGU = ref([]);
const mzRCDO = ref([]);
const loading = ref(true);
const error = ref(null);
const adding = ref(false);
const addError = ref(null);
const addSuccess = ref(null);

const columns = [
  { key: 'Наименование', label: 'Наименование' },
  { key: 'Количество', label: 'Количество (БГУ)' },
  { key: 'СтоимостьFormatted', label: 'Стоимость (БГУ)' },
  { key: 'КоличествоРЦДО', label: 'Количество (РЦДО)' },
  { key: 'СтоимостьРЦДОFormatted', label: 'Стоимость (РЦДО)' },
  { key: 'МатериальноОтветственный', label: 'Ответственный (БГУ)' },
  { key: 'МатериальноОтветственныйРЦДО', label: 'Ответственный (РЦДО)' },
  { key: 'Статус', label: 'Статус' },
  { key: 'actions', label: 'Действия' }
];

const encodeAuth = (u, p) =>
  'Basic ' + btoa(unescape(encodeURIComponent(`${u}:${p}`)));

const AUTH_BGU = encodeAuth(USER_BGU, PASS_BGU);
const AUTH_RCDO = encodeAuth(USER_RCDO, PASS_RCDO);

const fetchBGU = async () => {
  const res = await axios.get(API_BGU, {
    headers: { Authorization: AUTH_BGU },
  });
  mzBGU.value = res.data.данные
    .filter(item => Number(item.Стоимость) > 0)
    .map(item => ({
      ...item,
      СтоимостьFormatted: formatCurrency(item.Стоимость),
      КоличествоРЦДО: '-',
      СтоимостьРЦДО: '-',
      СтоимостьРЦДОFormatted: '-',
      МатериальноОтветственныйРЦДО: '-',
      Статус: 'Проверка...',
      isNew: false,
      hasDiscrepancy: false,
      rowClass: '',
      adding: false,
      uniqueKey: `${item.Код}|${item.Наименование}|${item.МатериальноОтветственный}`.trim()
    }));
};

const fetchRCDO = async () => {
  const res = await axios.get(API_RCDO, {
    headers: { Authorization: AUTH_RCDO },
  });
  mzRCDO.value = res.data.materialnye_zapasy || [];
};

const compare = () => {
  mzBGU.value.forEach(item => {
    const match = mzRCDO.value.find(mz =>
      (mz.КодПоБгу || '').trim() === item.uniqueKey
    );

    if (!match) {
      item.Статус = 'НОВЫЙ';
      item.isNew = true;
      item.hasDiscrepancy = false;
      item.rowClass = 'row-new';
      item.КоличествоРЦДО = '-';
      item.СтоимостьРЦДО = '-';
      item.СтоимостьРЦДОFormatted = '-';
      item.МатериальноОтветственныйРЦДО = '-';
    } else {
      // Запоминаем данные из РЦДО
      item.КоличествоРЦДО = match.Количество;
      item.СтоимостьРЦДО = match.СтоимостьПоследняя;
      item.СтоимостьРЦДОFormatted = formatCurrency(match.СтоимостьПоследняя);
      item.МатериальноОтветственныйРЦДО = match.МатериальноОтветственный;

      // Проверка на расхождения
      const qtyDiff = Number(item.Количество) !== Number(match.Количество);
      const molDiff = (item.МатериальноОтветственный || '').trim() !== (match.МатериальноОтветственный || '').trim();
      const priceDiff = Math.round(Number(item.Стоимость) * 100) !== Math.round(Number(match.СтоимостьПоследняя) * 100);

      if (qtyDiff || molDiff || priceDiff) {
        item.hasDiscrepancy = true;
        item.isNew = false;
        item.rowClass = 'row-discrepancy-mol';

        const diffs = [];
        if (qtyDiff) diffs.push('Кол-во');
        if (molDiff) diffs.push('МОЛ');
        if (priceDiff) diffs.push('Цена');
        item.Статус = 'Расхождение: ' + diffs.join(', ');
      } else {
        item.hasDiscrepancy = false;
        item.isNew = false;
        item.rowClass = 'row-exists';
        item.Статус = 'Есть в РЦДО (совпадает)';
      }
    }
  });
};

const newItems = computed(() => mzBGU.value.filter(i => i.isNew));
const discrepantItems = computed(() => mzBGU.value.filter(i => i.hasDiscrepancy));
const displayedItems = computed(() =>
  mzBGU.value.filter(i => i.isNew || i.hasDiscrepancy)
);

const addNewItems = async (isHoz = false) => {
  if (!newItems.value.length) return;

  adding.value = true;
  addError.value = null;
  addSuccess.value = null;

  const payload = newItems.value.map(item => ({
    Код: item.Код,
    НаименованиеМЗ: item.Наименование,
    Количество: item.Количество,
    Стоимость: item.Стоимость,
    МатериальноОтветственный: item.МатериальноОтветственный,
    Хоз: isHoz
  }));

  try {
    await axios.post(API_ADD, payload, {
      headers: {
        Authorization: AUTH_RCDO,
        'Content-Type': 'application/json',
      },
    });

    addSuccess.value = `Добавлено ${payload.length} МЗ (${isHoz ? 'хоз.' : 'нехоз.'}).`;
    await fetchAll();
  } catch (err) {
    addError.value = 'Ошибка при добавлении: ' + (err.message || '');
  } finally {
    adding.value = false;
  }
};

const addSingleItem = async (item, isHoz = false) => {
  if (!item?.isNew || item.adding) return;
  item.adding = true;

  try {
    await axios.post(API_ADD, [{
      Код: item.Код,
      НаименованиеМЗ: item.Наименование,
      Количество: item.Количество,
      Стоимость: item.Стоимость,
      МатериальноОтветственный: item.МатериальноОтветственный,
      Хоз: isHoz
    }], {
      headers: {
        Authorization: AUTH_RCDO,
        'Content-Type': 'application/json',
      },
    });

    item.Статус = `Добавлен${isHoz ? ' (хоз)' : ''}`;
    item.isNew = false;
    item.rowClass = 'row-added';
  } catch (err) {
    item.Статус = 'Ошибка добавления';
    console.error('Ошибка при добавлении одного МЗ:', err);
  } finally {
    item.adding = false;
  }
};

const handleRowAction = ({ row, type }) => {
  const isHoz = type === 'hoz';
  addSingleItem(row, isHoz);
};

const fetchAll = async () => {
  loading.value = true;
  error.value = null;
  mzRCDO.value = [];

  try {
    await fetchBGU();
    await fetchRCDO();
    compare();
  } catch (err) {
    error.value = 'Ошибка при загрузке: ' + (err.message || '');
  } finally {
    loading.value = false;
  }
};

onMounted(fetchAll);
</script>

<template>
  <div>
    <h2>Сравнение материальных запасов (БГУ ↔ РЦДО)</h2>

    <div class="meta-info" v-if="!loading && !error && mzBGU.length">
      <span>Всего (БГУ): {{ mzBGU.length }}</span>
      <span v-if="newItems.length" style="margin-left: 15px;">К добавлению: {{ newItems.length }}</span>
      <span v-if="discrepantItems.length" style="margin-left: 15px; color: orange;">Расхождений: {{ discrepantItems.length }}</span>
    </div>

    <div v-if="loading" class="loading-indicator">Загрузка...</div>
    <div v-if="error" class="error-message">{{ error }}</div>

    <div v-if="!loading && !error && newItems.length" class="add-new-container">
      <button @click="addNewItems(false)" :disabled="adding" class="add-button">
        {{ adding ? 'Добавление...' : `Добавить ${newItems.length} новых МЗ` }}
      </button>
      <button @click="addNewItems(true)" :disabled="adding" class="add-button" style="margin-left: 10px;">
        {{ adding ? 'Добавление...' : `Добавить ${newItems.length} новых МЗ Хоз` }}
      </button>
      <div v-if="addError" class="error-message">{{ addError }}</div>
      <div v-if="addSuccess" class="success-message">{{ addSuccess }}</div>
    </div>

    <DataTable
      :tableData="displayedItems"
      :tableColumns="columns"
      initialSortKey="Наименование"
      initialSortOrder="asc"
      :showActionButton="row => row.isNew"
      @action-triggered="handleRowAction"
    />
  </div>
</template>

<style scoped>
.loading-indicator, .error-container, .meta-info, .add-new-container {
  margin-bottom: 15px;
  padding: 10px;
  border-radius: 4px;
}
.loading-indicator {
  background-color: #e0e0e0;
  display: flex;
  align-items: center;
}
.error-container {
  background-color: #f8d7da;
  border: 1px solid #f5c6cb;
  color: #721c24;
}
.error-message {
  font-weight: bold;
  margin-bottom: 5px;
}
.error-details {
  font-size: 0.9em;
  color: #58151c;
  word-break: break-all;
}
.retry-button, .add-button {
  padding: 8px 15px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.retry-button:hover, .add-button:hover {
  background-color: #0056b3;
}
.add-button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}
.meta-info {
  background-color: #f0f0f0;
  border: 1px solid #ddd;
  font-size: 0.9em;
}
.meta-info .item-count {
  margin-right: 15px;
}
.add-new-container {
   background-color: #e9f5ff;
   border: 1px solid #b3d7ff;
}
.add-error {
  color: #721c24;
  margin-top: 10px;
  word-break: break-word;
}
.success-message {
  color: #155724;
  background-color: #d4edda;
  border-color: #c3e6cb;
  padding: 5px 10px;
  margin-top: 10px;
  border-radius: 4px;
}
.spinner {
  display: inline-block;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: #fff;
  width: 16px;
  height: 16px;
  animation: spin 1s ease-in-out infinite;
  margin-right: 5px;
}
.loading-indicator .spinner {
   border-top-color: #333;
   margin-right: 8px;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
/* Стили для строк таблицы */
:deep(.row-new) {
  background-color: #fff3cd !important;
}
:deep(.row-warning) {
   background-color: #f8d7da !important;
}
:deep(.row-discrepancy-mol) {
  background-color: #ffe0b2 !important;
}
</style>
