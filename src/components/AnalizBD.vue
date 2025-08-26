<template>
  <div>
    <h2>Список основных средств (Сравнение БГУ и РЦДО)</h2>
    <!-- Показываем ОС из БГУ, которых НЕТ в РЦДО, или у которых есть расхождения -->

    <div class="meta-info" v-if="!loading && !error && metaInfoBGU">
      <span class="item-count">Всего элементов (БГУ): {{ metaInfoBGU.количество }}</span>
      <span class="date">Дата формирования (БГУ): {{ formatDate(metaInfoBGU.датаФормирования) }}</span>
      <span class="item-count" v-if="!loading && !error && newOsItems.length > 0" style="margin-left: 15px;">К добавлению: {{ newOsItems.length }}</span>
      <span class="item-count" v-if="!loading && !error && discrepancyMolItems.length > 0" style="margin-left: 15px; color: orange;">Расхождений МОЛ: {{ discrepancyMolItems.length }}</span>
    </div>

    <div v-if="loading" class="loading-indicator">
      <span class="spinner"></span> Загрузка и сравнение данных...
    </div>
    <div v-if="error" class="error-container">
      <p class="error-message">{{ error }}</p>
      <p class="error-details" v-if="errorDetails">Техническая информация: {{ errorDetails }}</p>
      <button @click="fetchAllData" class="retry-button">Попробовать снова</button>
    </div>

    <div v-if="!loading && !error && newOsItems.length > 0" class="add-new-container">
       <button @click="addAllNewItems" :disabled="addingItems" class="add-button">
         <span v-if="addingItems" class="spinner"></span>
         {{ addingItems ? 'Добавление...' : `Добавить ${newOsItems.length} новых ОС в РЦДО` }}
       </button>
       
       <div v-if="addError" class="error-message add-error">{{ addError }}</div>
       <div v-if="addSuccessMessage" class="success-message">{{ addSuccessMessage }}</div>
    </div>

    <DataTable
      v-if="!loading && !error && displayedOsItems.length > 0"
      :tableData="displayedOsItems"
      :tableColumns="columns"
      initialSortKey="ИнвентарныйНомер"
      initialSortOrder="asc"
      @sort-changed="onSortChanged"
      rowClassField="rowClass"
    />
    <p v-else-if="!loading && !error && displayedOsItems.length === 0">
       Данные для отображения отсутствуют (все ОС из БГУ уже есть в РЦДО и МОЛ совпадают, либо исходный список БГУ пуст).
    </p>
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue';
import DataTable from '@/components/DataTable.vue';
import axios from 'axios';

export default {
  name: 'AnalizBD',
  components: {
    DataTable
  },

  setup() {
    const API_BGU_URL = '/api/BGU/hs/inv/os';
    const API_RCDO_URL = '/api/RCDO/hs/rcdo/OS';
    const API_ADD_RCDO_URL = '/api/RCDO/hs/rcdo/addOS';

    const USERNAME_BGU = 'Администратор';
    const PASSWORD_BGU = '159753';
    const USERNAME_RCDO = 'admin';
    const PASSWORD_RCDO = '10028585mM';

    const osItemsBGU = ref([]);
    const metaInfoBGU = ref(null);
    // Используем Map для хранения данных РЦДО: { ИнвентарныйНомер: объектОС_РЦДО }
    const rcdoDataMap = ref(new Map());

    const loading = ref(true);
    const error = ref(null);
    const errorDetails = ref(null);
    const addingItems = ref(false);
    const addError = ref(null);
    const addSuccessMessage = ref(null);

    const columns = ref([
      { key: 'Наименование', label: 'Наименование' },
      { key: 'ИнвентарныйНомер', label: 'Инвентарный номер' },
      { key: 'СтоимостьFormatted', label: 'Стоимость (БГУ)' },
      { key: 'МатериальноОтветственный', label: 'Ответственный (БГУ)' },
      // Новая колонка для отображения МОЛ из РЦДО
      { key: 'МатериальноОтветственныйРЦДО', label: 'Ответственный (РЦДО)' },
      { key: 'Статус', label: 'Статус/Сравнение' }
    ]);

    function encodeBasicAuth(username, password) {
      try {
        const userStr = String(username || '');
        const passStr = String(password || '');
        const encoder = new TextEncoder();
        const data = encoder.encode(`${userStr}:${passStr}`);
        return btoa(Array.from(new Uint8Array(data))
          .map(byte => String.fromCharCode(byte))
          .join(''));
      } catch (e) {
        console.error('Ошибка кодирования Basic Auth (TextEncoder):', e);
        try {
           const userStr = String(username || '');
           const passStr = String(password || '');
           return btoa(unescape(encodeURIComponent(`${userStr}:${passStr}`)));
        } catch (fallbackError) {
           console.error('Ошибка кодирования Basic Auth (fallback):', fallbackError);
           return '';
        }
      }
    }

    const AUTH_HEADER_BGU = 'Basic ' + encodeBasicAuth(USERNAME_BGU, PASSWORD_BGU);
    const AUTH_HEADER_RCDO = 'Basic ' + encodeBasicAuth(USERNAME_RCDO, PASSWORD_RCDO);

    const formatDate = (dateString) => {
      if (!dateString) return '';
       try {
         const date = new Date(dateString);
         if (isNaN(date.getTime())) {
            console.warn("Невалидная строка даты получена:", dateString);
            return dateString;
         }
         return new Intl.DateTimeFormat('ru-RU', {
           day: '2-digit',
           month: '2-digit',
           year: 'numeric',
           hour: '2-digit',
           minute: '2-digit'
         }).format(date);
       } catch (e) {
         console.warn("Ошибка форматирования даты:", e);
         return dateString;
       }
    };

    const formatCurrency = (value) => {
       if (value === null || value === undefined) return '0,00 ₽';
       const numValue = Number(value);
       if (isNaN(numValue)) {
           console.warn("Нечисловое значение для форматирования валюты:", value);
           return 'Не число';
       }
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB',
            minimumFractionDigits: 2
        }).format(numValue);
    };

   const fetchBGUData = async () => {
        console.log('Запрос данных БГУ:', API_BGU_URL);
        const response = await axios.get(API_BGU_URL, {
            timeout: 45000,
            headers: { 'Authorization': AUTH_HEADER_BGU, 'Accept': 'application/json' }
        });
        console.log('Ответ БГУ получен, статус:', response.status);

        let responseData = response.data;
        if (typeof responseData === 'string') {
            try { responseData = JSON.parse(responseData); }
            catch (parseError) { throw new Error(`Ошибка обработки JSON от БГУ: ${parseError.message}`); }
        }

        if (responseData?.данные && Array.isArray(responseData.данные)) {
          // ---------------- ФИЛЬТРАЦИЯ -----------------
          const filteredBGU = responseData.данные.filter(item => {
            const cost = Number(item.Стоимость) || 0;
            const mol = (item.МатериальноОтветственный || '').trim();
            return cost > 0 && mol.length > 0;
          });

          metaInfoBGU.value = {
              количество: filteredBGU.length,
              датаФормирования: responseData.датаФормирования
          };
          osItemsBGU.value = filteredBGU.map(item => ({
              ...item,
              СтоимостьFormatted: formatCurrency(item.Стоимость),
              МатериальноОтветственныйРЦДО: '-', // Инициализируем поле для МОЛ РЦДО
              Статус: 'Проверка...',
              isNew: null,
              hasMolDiscrepancy: false, // Флаг расхождения МОЛ
              rowClass: ''
          }));
          console.log('Загружено из БГУ (после фильтрации):', osItemsBGU.value.length);
        } else {
            throw new Error('Некорректная структура данных в ответе сервера БГУ');
        }
    };



    const fetchRCDOData = async () => {
        console.log('Запрос данных РЦДО:', API_RCDO_URL);
        const response = await axios.get(API_RCDO_URL, {
            timeout: 30000,
            headers: { 'Authorization': AUTH_HEADER_RCDO, 'Accept': 'application/json' }
        });
        console.log('Ответ РЦДО получен, статус:', response.status);

        let responseData = response.data;
        if (typeof responseData === 'string') {
             try { responseData = JSON.parse(responseData); }
             catch (parseError) { throw new Error(`Ошибка обработки JSON от РЦДО: ${parseError.message}`); }
        }

        if (responseData?.osnovnye_sredstva && Array.isArray(responseData.osnovnye_sredstva)) {
            rcdoDataMap.value.clear(); // Очищаем Map перед заполнением
            responseData.osnovnye_sredstva.forEach(item => {
                if (item?.ИнвентарныйНомер) {
                    // Ключ: инвентарный номер, Значение: весь объект ОС из РЦДО
                    rcdoDataMap.value.set(String(item.ИнвентарныйНомер).trim(), item);
                } else {
                   console.warn("Элемент РЦДО без Инвентарного Номера:", item);
                }
            });
            console.log('Загружено объектов из РЦДО в Map:', rcdoDataMap.value.size);
         } else {
            console.error('Некорректная структура от РЦДО (ожидался объект с полем "osnovnye_sredstva"):', responseData);
            throw new Error('Некорректная структура ответа РЦДО (ожидался объект с полем "osnovnye_sredstva")');
         }
    };

    const compareData = () => {
        console.log('Сравнение данных с учетом МОЛ...');
        osItemsBGU.value.forEach(itemBGU => {
            const invNumBGU = String(itemBGU.ИнвентарныйНомер || '').trim();
            itemBGU.isNew = null;
            itemBGU.hasMolDiscrepancy = false;

            if (!invNumBGU) {
                 itemBGU.Статус = 'Нет инв. номера в БГУ';
                 itemBGU.rowClass = 'row-warning';
                 return;
            }

            if (rcdoDataMap.value.has(invNumBGU)) {
                const itemRCDO = rcdoDataMap.value.get(invNumBGU);
                // ВАЖНО: Замените 'МатериальноОтветственныйЛицо' или 'Ответственный'
                // на актуальное имя поля МОЛ из вашего API РЦДО.
                const molRCDO_raw = itemRCDO?.МатериальноОтветственный || itemRCDO?.МатериальноОтветственныйЛицо || itemRCDO?.Ответственный || itemRCDO?.МОЛ || '';
                itemBGU.МатериальноОтветственныйРЦДО = molRCDO_raw || '-';

                const molBGU_norm = (itemBGU.МатериальноОтветственный || '').trim().toLowerCase();
                const molRCDO_norm = (molRCDO_raw || '').trim().toLowerCase();

                if (molBGU_norm !== molRCDO_norm) {
                    itemBGU.Статус = 'Расхождение МОЛ';
                    itemBGU.hasMolDiscrepancy = true;
                    itemBGU.rowClass = 'row-discrepancy-mol';
                } else {
                    itemBGU.Статус = 'Есть в РЦДО (МОЛ совпадает)';
                    itemBGU.rowClass = 'row-exists'; // Эти строки будут отфильтрованы из displayedOsItems
                }
                itemBGU.isNew = false;
            } else {
                itemBGU.Статус = 'НОВЫЙ (нет в РЦДО)';
                itemBGU.isNew = true;
                itemBGU.rowClass = 'row-new';
                itemBGU.МатериальноОтветственныйРЦДО = 'Нет в РЦДО'; // или оставить '-'
            }
        });
        console.log('Сравнение завершено.');
    };

    const fetchAllData = async () => {
        loading.value = true;
        error.value = null;
        errorDetails.value = null;
        addError.value = null;
        addSuccessMessage.value = null;
        osItemsBGU.value = [];
        metaInfoBGU.value = null;
        rcdoDataMap.value.clear(); // Используем rcdoDataMap

        try {
            console.log('Начало загрузки данных...');
            await Promise.all([fetchBGUData(), fetchRCDOData()]);
            console.log('Данные из БГУ и РЦДО загружены, начинаем сравнение...');
            compareData();
             console.log('Количество новых ОС для добавления:', newOsItems.value.length);
             console.log('Количество ОС с расхождением МОЛ:', discrepancyMolItems.value.length);
             console.log('Количество ОС для отображения в таблице:', displayedOsItems.value.length);
        } catch (err) {
             console.error('Ошибка при загрузке или обработке данных:', err);
             if (err.response) {
                 error.value = `Ошибка сервера: ${err.response.status}`;
                 let details = '';
                 try {
                     details = typeof err.response.data === 'object' ? JSON.stringify(err.response.data) : err.response.data;
                 } catch (e) { details = 'Не удалось обработать ответ сервера'; }
                 errorDetails.value = `URL: ${err.config?.url}. Ответ сервера: ${details}`;
                 if (err.response.status === 401 || err.response.status === 403) {
                     error.value = `Ошибка авторизации (${err.response.status}) при доступе к ${err.config?.url}.`;
                     errorDetails.value = `Проверьте логин/пароль и права в 1С.`;
                 }
             } else if (err.code === 'ECONNABORTED') {
                  error.value = 'Превышено время ожидания ответа от сервера.';
                  errorDetails.value = `Сервер (${err.config?.url}) не ответил вовремя.`;
             } else if (err.request) {
                 error.value = 'Сервер не отвечает.';
                 errorDetails.value = `Нет ответа от ${err.config?.url}. Проверьте доступность.`;
             } else if (err.message?.includes('Network Error')) {
                  error.value = 'Ошибка сети или CORS.';
                  errorDetails.value = `Не удалось подключиться к ${err.config?.url}.`;
             } else {
                 error.value = 'Не удалось загрузить/обработать данные.';
                 errorDetails.value = err.message || 'Неизвестная ошибка.';
             }
             osItemsBGU.value = [];
             rcdoDataMap.value.clear();
        } finally {
            loading.value = false;
            console.log('Загрузка и обработка завершены.');
        }
    };

    const newOsItems = computed(() => {
      return osItemsBGU.value.filter(item => item.isNew === true);
    });

    // Новое вычисляемое свойство для элементов с расхождением МОЛ (для статистики)
    const discrepancyMolItems = computed(() => {
      return osItemsBGU.value.filter(item => item.hasMolDiscrepancy === true);
    });

    const displayedOsItems = computed(() => {
      // Отображаем: новые, с ошибками в БГУ, с расхождением МОЛ.
      // Не отображаем: только те, что 'row-exists' (полностью совпадают).
      return osItemsBGU.value.filter(item => item.rowClass !== 'row-exists');
    });

    const addAllNewItems = async () => {
      if (newOsItems.value.length === 0 || addingItems.value) {
        return;
      }

      addingItems.value = true;
      addError.value = null;
      addSuccessMessage.value = null;

      const itemsToAdd = newOsItems.value.map(item => ({
        ИнвентарныйНомер: item.ИнвентарныйНомер,
        НаименованиеОС: item.Наименование,
        СтоимостьПоследняя: item.Стоимость,
        МатериальноОтветственный: item.МатериальноОтветственный
      }));

      console.log(`Отправка ${itemsToAdd.length} новых ОС на ${API_ADD_RCDO_URL}`);

      try {
        const response = await axios.post(API_ADD_RCDO_URL, itemsToAdd, {
          timeout: 60000,
          headers: {
            'Authorization': AUTH_HEADER_RCDO,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        });

        console.log('Ответ от сервиса добавления:', response.status, response.data);
        if (response.status >= 200 && response.status < 300 || response.status === 207) {
           const resultData = typeof response.data === 'string'
                              ? JSON.parse(response.data)
                              : response.data;

           if (resultData && Array.isArray(resultData.errors) && resultData.errors.length > 0) {
               const addedCount = resultData.addedCount ?? (itemsToAdd.length - resultData.errors.length);
               addError.value = `Добавлено ~${addedCount} ОС. Ошибки: ${resultData.errors.map(e => `(${e.item?.ИнвентарныйНомер || '??'}): ${e.error}`).join('; ')}`;
               addSuccessMessage.value = null;
           } else if (resultData) {
              addSuccessMessage.value = resultData.message || `Успешно обработано ${resultData.addedCount ?? itemsToAdd.length} ОС.`;
              addError.value = null;
           } else {
              addSuccessMessage.value = `Запрос выполнен (статус ${response.status}), но ответ сервера не содержит ожидаемых данных.`;
           }
           console.log('Перезагрузка данных после попытки добавления...');
           await fetchAllData();
        } else {
           throw new Error(`Неожиданный статус ответа при добавлении: ${response.status}`);
        }

      } catch (err) {
        console.error('Ошибка при добавлении новых ОС:', err);
        addSuccessMessage.value = null;
        if (err.response) {
          addError.value = `Ошибка сервера (${err.response.status}) при добавлении на ${err.config?.url}.`;
           try {
               const errorData = typeof err.response.data === 'object' ? JSON.stringify(err.response.data) : err.response.data;
               addError.value += ` Ответ: ${errorData}`;
           } catch(e) { /* ignore parse error */ }
           if (err.response.status === 401 || err.response.status === 403) {
               addError.value = `Ошибка авторизации (${err.response.status}) при добавлении ОС на ${err.config?.url}. Проверьте права пользователя '${USERNAME_RCDO}' на запись/изменение в справочнике ОС и доступ к HTTP-сервису.`;
           }
        } else if (err.code === 'ECONNABORTED') {
          addError.value = `Превышено время ожидания при добавлении ОС (${err.config?.url}).`;
        } else if (err.request) {
           addError.value = `Сервер не ответил на запрос добавления ОС (${err.config?.url}).`;
        } else {
          addError.value = `Ошибка при отправке данных на ${err.config?.url}: ${err.message}`;
        }
      } finally {
        addingItems.value = false;
      }
    };

    onMounted(fetchAllData);

    const onSortChanged = (sortInfo) => {
      console.log('Изменена сортировка (не влияет на фильтрацию):', sortInfo);
    };

    return {
      columns,
      metaInfoBGU,
      loading,
      error,
      errorDetails,
      fetchAllData,
      onSortChanged,
      formatDate,
      newOsItems,
      discrepancyMolItems, // Возвращаем для статистики
      addAllNewItems,
      addingItems,
      addError,
      addSuccessMessage,
      displayedOsItems
    };
  }
}
</script>

<style scoped>
/* Стили остаются прежними, добавляем только новый для расхождений МОЛ */
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
:deep(.row-new) { /* Новые ОС, которых нет в РЦДО */
  background-color: #fff3cd !important; /* Светло-желтый фон */
  /* font-weight: bold; */ /* Можно убрать, если будет слишком много жирного */
}
/* :deep(.row-exists) { */ /* Полностью совпадающие - не отображаются */
  /* background-color: #d4edda !important; */
/* } */
:deep(.row-warning) { /* ОС с проблемами (например, нет инв. номера в БГУ) */
   background-color: #f8d7da !important; /* Светло-красный фон */
}
/* Новый стиль для строк с расхождением МОЛ */
:deep(.row-discrepancy-mol) {
  background-color: #ffe0b2 !important; /* Светло-оранжевый фон */
}

</style>