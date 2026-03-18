<template>
  <div>
    <h2>Список основных средств (Сравнение БГУ и РЦДО)</h2>

    <div class="meta-info" v-if="!loading && !error && metaInfoBGU">
      <span class="item-count">Всего элементов (БГУ): {{ metaInfoBGU.количество }}</span>
      <span class="date">Дата формирования (БГУ): {{ formatDate(metaInfoBGU.датаФормирования) }}</span>

      <span
        class="item-count"
        v-if="!loading && !error && newOsItems.length > 0"
        style="margin-left: 15px;"
      >
        К добавлению (обычные ОС): {{ newOsItems.length }}
      </span>

      <span
        class="item-count"
        v-if="!loading && !error && newGroupedOsItems.length > 0"
        style="margin-left: 15px; color: #336699;"
      >
        К добавлению (групповой учёт): {{ newGroupedOsItems.length }}
      </span>

      <span
        class="item-count"
        v-if="!loading && !error && discrepancyMolItems.length > 0"
        style="margin-left: 15px; color: orange;"
      >
        Расхождений МОЛ: {{ discrepancyMolItems.length }}
      </span>

      <span
        class="item-count"
        v-if="!loading && !error && missingInvTotal > 0"
        style="margin-left: 15px; color: #1e88e5;"
      >
        Инв.№ к добавлению (ГУ): {{ missingInvTotal }}
      </span>
    </div>

    <div v-if="loading" class="loading-indicator">
      <span class="spinner"></span> Загрузка и сравнение данных...
    </div>

    <div v-if="error" class="error-container">
      <p class="error-message">{{ error }}</p>
      <p class="error-details" v-if="errorDetails">Техническая информация: {{ errorDetails }}</p>
      <button @click="fetchAllData" class="retry-button">Попробовать снова</button>
    </div>

    <!-- Обычные ОС -->
    <div v-if="!loading && !error && newOsItems.length > 0" class="add-new-container">
      <button @click="addAllNewItems" :disabled="addingItems" class="add-button">
        <span v-if="addingItems" class="spinner"></span>
        {{ addingItems ? 'Добавление...' : `Добавить ${newOsItems.length} новых ОС в РЦДО` }}
      </button>

      <div v-if="addError" class="error-message add-error">{{ addError }}</div>
      <div v-if="addSuccessMessage" class="success-message">{{ addSuccessMessage }}</div>
    </div>

    <!-- Групповой учёт (новые позиции ГУ) -->
    <div v-if="!loading && !error && newGroupedOsItems.length > 0" class="add-new-container">
      <button @click="addAllNewGroupedItems" :disabled="addingGroupedItems" class="add-button">
        <span v-if="addingGroupedItems" class="spinner"></span>
        {{
          addingGroupedItems
            ? 'Добавление...'
            : `Добавить ${newGroupedOsItems.length} групповых ОС в РЦДО`
        }}
      </button>

      <div v-if="addGroupedError" class="error-message add-error">{{ addGroupedError }}</div>
      <div v-if="addGroupedSuccessMessage" class="success-message">
        {{ addGroupedSuccessMessage }}
      </div>
    </div>

    <!-- ГУ: добавить отсутствующие инв.№ в уже существующие записи -->
    <div v-if="!loading && !error && missingInvTotal > 0" class="add-new-container">
      <button @click="addAllMissingInvNumbers" :disabled="addingInvNumbers" class="add-button">
        <span v-if="addingInvNumbers" class="spinner"></span>
        {{
          addingInvNumbers
            ? 'Добавление...'
            : `Добавить ${missingInvTotal} инв.№ в групповой учёт (РЦДО)`
        }}
      </button>

      <div v-if="addInvError" class="error-message add-error">{{ addInvError }}</div>
      <div v-if="addInvSuccessMessage" class="success-message">{{ addInvSuccessMessage }}</div>
    </div>

    <DataTableTransfer
      v-if="!loading && !error && displayedOsItems.length > 0"
      :tableData="displayedOsItems"
      :tableColumns="columns"
      initialSortKey="ИнвентарныйНомер"
      initialSortOrder="asc"
      :actionButtonText="actionButtonText"
      :showActionButton="showTransferButton"
      @action-triggered="onActionTriggered"
      @sort-changed="onSortChanged"
      rowClassField="rowClass"
    />

    <p v-else-if="!loading && !error && displayedOsItems.length === 0">
      Данные для отображения отсутствуют (все ОС из БГУ уже есть в РЦДО и МОЛ совпадают, либо
      исходный список БГУ пуст).
    </p>

    <!-- Модалка должна иметь кнопку "Провести" и эмитить @conduct -->
    <AnalizDetailsModal
      :visible="detailsVisible"
      :item="selectedRow"
      :loading="transferring"
      :error="transferError"
      :success="transferSuccessMessage"
      @close="detailsVisible = false"
      @conduct="conductTransfer"
    />
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue';
import DataTableTransfer from '@/components/shared/DataTableTransfer.vue';
import AnalizDetailsModal from '@/components/contracts/AnalizDetailsModal.vue';
import axios from 'axios';

export default {
  name: 'AnalizBD',
  components: { DataTableTransfer, AnalizDetailsModal },

  setup() {
    const API_BGU_URL = '/api/BGU/hs/inv/os';
    const API_RCDO_URL = '/api/RCDO/hs/rcdo/OS';
    const API_RCDO_GRUPP_URL = '/api/RCDO/hs/rcdo/GruppUchotURL';

    const API_ADD_RCDO_URL = '/api/RCDO/hs/rcdo/addOS';
    const API_ADD_RCDO_GRUPP_URL = '/api/RCDO/hs/rcdo/addGruppUchot';

    const API_ADD_RCDO_GRUPP_INV_URL = '/api/RCDO/hs/rcdo/addGruppInv';

    // ✅ ручка проведения перевода (смена МОЛ + запись в историю)
    const API_TRANSFER_OS_URL = '/api/RCDO/hs/rcdo/transferOS';

    const USERNAME_BGU = 'Администратор';
    const PASSWORD_BGU = '159753';
    const USERNAME_RCDO = 'admin';
    const PASSWORD_RCDO = '10028585mM';

    const osItemsBGU = ref([]);
    const metaInfoBGU = ref(null);
    const rcdoDataMap = ref(new Map());
    const rcdoGruppDataMap = ref(new Map());

    const loading = ref(true);
    const error = ref(null);
    const errorDetails = ref(null);

    const addingItems = ref(false);
    const addError = ref(null);
    const addSuccessMessage = ref(null);

    const addingGroupedItems = ref(false);
    const addGroupedError = ref(null);
    const addGroupedSuccessMessage = ref(null);

    const addingInvNumbers = ref(false);
    const addInvError = ref(null);
    const addInvSuccessMessage = ref(null);

    // ✅ проведение перевода
    const transferring = ref(false);
    const transferError = ref(null);
    const transferSuccessMessage = ref(null);

    const detailsVisible = ref(false);
    const selectedRow = ref(null);

    const columns = ref([
      { key: 'Наименование', label: 'Наименование' },
      { key: 'ИнвентарныйНомер', label: 'Инвентарный номер' },
      { key: 'СтоимостьFormatted', label: 'Стоимость (БГУ)' },
      { key: 'МатериальноОтветственный', label: 'Ответственный (БГУ)' },
      { key: 'МатериальноОтветственныйРЦДО', label: 'Ответственный (РЦДО)' },
      { key: 'Статус', label: 'Статус/Сравнение' },
      { key: 'actions', label: 'Действия' }
    ]);

    function encodeBasicAuth(username, password) {
      try {
        const userStr = String(username || '');
        const passStr = String(password || '');
        const encoder = new TextEncoder();
        const data = encoder.encode(`${userStr}:${passStr}`);
        return btoa(
          Array.from(new Uint8Array(data))
            .map((byte) => String.fromCharCode(byte))
            .join('')
        );
      } catch (e1) {
        void e1;
        try {
          const userStr = String(username || '');
          const passStr = String(password || '');
          return btoa(unescape(encodeURIComponent(`${userStr}:${passStr}`)));
        } catch (e2) {
          void e2;
          return '';
        }
      }
    }

    const AUTH_HEADER_BGU = 'Basic ' + encodeBasicAuth(USERNAME_BGU, PASSWORD_BGU);
    const AUTH_HEADER_RCDO = 'Basic ' + encodeBasicAuth(USERNAME_RCDO, PASSWORD_RCDO);

    const safeJson = (data) => {
      if (data === null || data === undefined) return data;
      if (typeof data !== 'string') return data;
      const s = data.trim();
      if (!s) return null;
      try {
        return JSON.parse(s);
      } catch (e) {
        void e;
        return data;
      }
    };

    const getActorLogin = () => {
      try {
        const u = JSON.parse(localStorage.getItem('user') || 'null');
        return u?.login || u?.username || u?.fio || u?.ФИО || '';
      } catch (e) {
        void e;
        return '';
      }
    };

    const formatDate = (dateString) => {
      if (!dateString) return '';
      try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        return new Intl.DateTimeFormat('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }).format(date);
      } catch (e) {
        void e;
        return dateString;
      }
    };

    const formatCurrency = (value) => {
      if (value === null || value === undefined) return '0,00 ₽';
      const numValue = Number(value);
      if (isNaN(numValue)) return 'Не число';
      return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB',
        minimumFractionDigits: 2
      }).format(numValue);
    };

    const normalizeStr = (val) => (val ?? '').toString().trim().toLowerCase();
    const normalizeInv = (v) => String(v || '').trim();

    const parseInvNumbers = (raw) => {
      const s = String(raw || '').trim();
      if (!s) return [];
      return s
        .split(/[;,]/)
        .map((x) => x.trim())
        .filter(Boolean);
    };

    const extractInvNumbersFromGrupp = (gruppItem) => {
      const out = [];
      if (gruppItem?.ИнвентарныйНомер) {
        const inv = normalizeInv(gruppItem.ИнвентарныйНомер);
        if (inv) out.push(inv);
      }
      if (Array.isArray(gruppItem?.ИнвентарныйНомера)) {
        gruppItem.ИнвентарныйНомера.forEach((x) => {
          const inv = normalizeInv(x?.ИнвентарныйНомер);
          if (inv) out.push(inv);
        });
      }
      return out.filter(Boolean);
    };

    const fetchBGUData = async () => {
      const response = await axios.get(API_BGU_URL, {
        timeout: 45000,
        headers: { Authorization: AUTH_HEADER_BGU, Accept: 'application/json' }
      });

      const responseData = safeJson(response.data);

      if (responseData?.данные && Array.isArray(responseData.данные)) {
        const filteredBGU = responseData.данные.filter((item) => {
          const cost = Number(item.Стоимость) || 0;
          const mol = (item.МатериальноОтветственный || '').trim();
          return cost > 0 && mol.length > 0;
        });

        metaInfoBGU.value = {
          количество: filteredBGU.length,
          датаФормирования: responseData.датаФормирования
        };

        osItemsBGU.value = filteredBGU.map((item) => ({
          ...item,
          СтоимостьFormatted: formatCurrency(item.Стоимость),
          МатериальноОтветственныйРЦДО: '-',
          Статус: 'Проверка...',
          isNew: null,
          hasMolDiscrepancy: false,
          rowClass: '',
          isGrouped: Boolean(item.ГрупповойУчет),
          isGroupedNew: false,

          missingInvNumbers: [],
          rcdoInvNumbers: [],
          rcdoGroupCode: '',
          rcdoGroupKey: ''
        }));
      } else {
        throw new Error('Некорректная структура данных в ответе сервера БГУ');
      }
    };

    const fetchRCDOData = async () => {
      const response = await axios.get(API_RCDO_URL, {
        timeout: 30000,
        headers: { Authorization: AUTH_HEADER_RCDO, Accept: 'application/json' }
      });

      const responseData = safeJson(response.data);

      if (responseData?.osnovnye_sredstva && Array.isArray(responseData.osnovnye_sredstva)) {
        rcdoDataMap.value.clear();
        responseData.osnovnye_sredstva.forEach((item) => {
          if (item?.ИнвентарныйНомер) {
            rcdoDataMap.value.set(String(item.ИнвентарныйНомер).trim(), item);
          }
        });
      } else {
        throw new Error(
          'Некорректная структура ответа РЦДО (ожидался объект с полем "osnovnye_sredstva")'
        );
      }
    };

    const fetchGruppRCDOData = async () => {
      const response = await axios.get(API_RCDO_GRUPP_URL, {
        timeout: 30000,
        headers: { Authorization: AUTH_HEADER_RCDO, Accept: 'application/json' }
      });

      const responseData = safeJson(response.data);

      if (responseData?.gruppovoy_uchot && Array.isArray(responseData.gruppovoy_uchot)) {
        rcdoGruppDataMap.value.clear();

        responseData.gruppovoy_uchot.forEach((item) => {
          const nameNorm = normalizeStr(item.НаименованиеОС || item.Наименование);
          if (!nameNorm) return;

          const molRaw =
            item.МатериальноОтветственный ||
            item.МатериальноОтветственныйЛицо ||
            item.Ответственный ||
            item.МОЛ ||
            '';
          const molNorm = normalizeStr(molRaw);

          const keyWithMol = `${nameNorm}||${molNorm}`;
          const keyWithoutMol = `${nameNorm}||`;

          if (!rcdoGruppDataMap.value.has(keyWithMol)) rcdoGruppDataMap.value.set(keyWithMol, item);
          if (!rcdoGruppDataMap.value.has(keyWithoutMol))
            rcdoGruppDataMap.value.set(keyWithoutMol, item);
        });
      } else {
        throw new Error(
          'Некорректная структура ответа РЦДО (ожидался объект с полем "gruppovoy_uchot")'
        );
      }
    };

    const compareData = () => {
      osItemsBGU.value.forEach((itemBGU) => {
        const isGrouped = !!itemBGU.ГрупповойУчет;

        itemBGU.isNew = null;
        itemBGU.isGroupedNew = false;
        itemBGU.hasMolDiscrepancy = false;

        itemBGU.missingInvNumbers = [];
        itemBGU.rcdoInvNumbers = [];
        itemBGU.rcdoGroupCode = '';
        itemBGU.rcdoGroupKey = '';

        if (isGrouped) {
          const nameNormBGU = normalizeStr(itemBGU.Наименование);
          const molNormBGU = normalizeStr(itemBGU.МатериальноОтветственный);

          const keyWithMol = `${nameNormBGU}||${molNormBGU}`;
          const keyWithoutMol = `${nameNormBGU}||`;

          const gruppItemRCDO =
            rcdoGruppDataMap.value.get(keyWithMol) || rcdoGruppDataMap.value.get(keyWithoutMol);

          if (gruppItemRCDO) {
            const molRawRCDO =
              gruppItemRCDO.МатериальноОтветственный ||
              gruppItemRCDO.МатериальноОтветственныйЛицо ||
              gruppItemRCDO.Ответственный ||
              gruppItemRCDO.МОЛ ||
              '';

            itemBGU.МатериальноОтветственныйРЦДО = molRawRCDO || '-';

            itemBGU.rcdoGroupCode = gruppItemRCDO.Код || '';
            itemBGU.rcdoGroupKey = gruppItemRCDO.КодПоБгу || '';

            const invBGUList = parseInvNumbers(itemBGU.ИнвентарныйНомер);
            const rcdoInvSet = new Set(
              extractInvNumbersFromGrupp(gruppItemRCDO).map((x) => normalizeInv(x))
            );
            const rcdoInvList = Array.from(rcdoInvSet).filter(Boolean);

            itemBGU.rcdoInvNumbers = rcdoInvList;

            if (invBGUList.length > 0) {
              const missing = invBGUList
                .map((x) => normalizeInv(x))
                .filter((inv) => inv && !rcdoInvSet.has(inv));

              if (missing.length > 0) {
                itemBGU.missingInvNumbers = missing;
                itemBGU.Статус =
                  `Групповой учёт: Есть в РЦДО, но инв.№ отсутствует в списке: ${missing.join(
                    ', '
                  )}` + ` (в РЦДО: ${rcdoInvList.length ? rcdoInvList.join(', ') : 'список пуст'})`;

                itemBGU.rowClass = 'row-discrepancy-inv';
                return;
              }
            }

            const molNormRCDO = normalizeStr(molRawRCDO);
            if (molNormBGU !== molNormRCDO) {
              itemBGU.Статус = 'Групповой учёт: Расхождение МОЛ';
              itemBGU.hasMolDiscrepancy = true;
              itemBGU.rowClass = 'row-discrepancy-mol';
            } else {
              itemBGU.Статус = 'Групповой учёт: Есть в РЦДО (МОЛ совпадает)';
              itemBGU.rowClass = 'row-exists';
            }

            if (
              typeof itemBGU.Количество !== 'undefined' &&
              typeof gruppItemRCDO.Количество !== 'undefined'
            ) {
              const qtyBGU = Number(itemBGU.Количество) || 0;
              const qtyRCDO = Number(gruppItemRCDO.Количество) || 0;
              itemBGU.КоличествоРЦДО = qtyRCDO;
              if (qtyBGU !== qtyRCDO)
                itemBGU.Статус += ` (кол-во: БГУ=${qtyBGU}, РЦДО=${qtyRCDO})`;
            }

            itemBGU.isNew = null;
          } else {
            itemBGU.МатериальноОтветственныйРЦДО = 'Нет в РЦДО (групповой учёт)';
            itemBGU.Статус = 'Групповой учёт: НОВЫЙ (нет в РЦДО)';
            itemBGU.rowClass = 'row-new';
            itemBGU.isGroupedNew = true;
          }

          return;
        }

        const invNumBGU = String(itemBGU.ИнвентарныйНомер || '').trim();

        if (!invNumBGU) {
          itemBGU.Статус = 'Нет инв. номера в БГУ';
          itemBGU.rowClass = 'row-warning';
          return;
        }

        if (rcdoDataMap.value.has(invNumBGU)) {
          const itemRCDO = rcdoDataMap.value.get(invNumBGU);
          const molRCDO_raw =
            itemRCDO?.МатериальноОтветственный ||
            itemRCDO?.МатериальноОтветственныйЛицо ||
            itemRCDO?.Ответственный ||
            itemRCDO?.МОЛ ||
            '';

          itemBGU.МатериальноОтветственныйРЦДО = molRCDO_raw || '-';

          const molBGU_norm = normalizeStr(itemBGU.МатериальноОтветственный);
          const molRCDO_norm = normalizeStr(molRCDO_raw);

          if (molBGU_norm !== molRCDO_norm) {
            itemBGU.Статус = 'Расхождение МОЛ';
            itemBGU.hasMolDiscrepancy = true;
            itemBGU.rowClass = 'row-discrepancy-mol';
          } else {
            itemBGU.Статус = 'Есть в РЦДО (МОЛ совпадает)';
            itemBGU.rowClass = 'row-exists';
          }
          itemBGU.isNew = false;
        } else {
          itemBGU.Статус = 'НОВЫЙ (нет в РЦДО)';
          itemBGU.isNew = true;
          itemBGU.rowClass = 'row-new';
          itemBGU.МатериальноОтветственныйРЦДО = 'Нет в РЦДО';
        }
      });
    };

    const fetchAllData = async () => {
      loading.value = true;
      error.value = null;
      errorDetails.value = null;

      addError.value = null;
      addSuccessMessage.value = null;
      addGroupedError.value = null;
      addGroupedSuccessMessage.value = null;

      addInvError.value = null;
      addInvSuccessMessage.value = null;

      transferError.value = null;
      transferSuccessMessage.value = null;

      osItemsBGU.value = [];
      metaInfoBGU.value = null;
      rcdoDataMap.value.clear();
      rcdoGruppDataMap.value.clear();

      try {
        await Promise.all([fetchBGUData(), fetchRCDOData(), fetchGruppRCDOData()]);
        compareData();
      } catch (err) {
        if (err.response) {
          error.value = `Ошибка сервера: ${err.response.status}`;
          let details = '';
          try {
            details =
              typeof err.response.data === 'object'
                ? JSON.stringify(err.response.data)
                : String(err.response.data);
          } catch (e) {
            void e;
            details = 'Не удалось обработать ответ сервера';
          }
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
        rcdoGruppDataMap.value.clear();
      } finally {
        loading.value = false;
      }
    };

    const newOsItems = computed(() =>
      osItemsBGU.value.filter((item) => item.isNew === true && !item.ГрупповойУчет)
    );

    const newGroupedOsItems = computed(() =>
      osItemsBGU.value.filter((item) => item.isGroupedNew === true)
    );

    const discrepancyMolItems = computed(() =>
      osItemsBGU.value.filter((item) => item.hasMolDiscrepancy === true)
    );

    const discrepancyInvItems = computed(() =>
      osItemsBGU.value.filter((item) => item.rowClass === 'row-discrepancy-inv')
    );

    const missingInvTotal = computed(() =>
      discrepancyInvItems.value.reduce((sum, row) => sum + (row.missingInvNumbers?.length || 0), 0)
    );

    const displayedOsItems = computed(() =>
      osItemsBGU.value.filter((item) => item.rowClass !== 'row-exists')
    );

    const addAllNewItems = async () => {
      if (newOsItems.value.length === 0 || addingItems.value) return;

      addingItems.value = true;
      addError.value = null;
      addSuccessMessage.value = null;

      const itemsToAdd = newOsItems.value.map((item) => ({
        ИнвентарныйНомер: item.ИнвентарныйНомер,
        НаименованиеОС: item.Наименование,
        СтоимостьПоследняя: item.Стоимость,
        МатериальноОтветственный: item.МатериальноОтветственный
      }));

      try {
        const response = await axios.post(API_ADD_RCDO_URL, itemsToAdd, {
          timeout: 60000,
          headers: {
            Authorization: AUTH_HEADER_RCDO,
            'Content-Type': 'application/json',
            Accept: 'application/json'
          }
        });

        if ((response.status >= 200 && response.status < 300) || response.status === 207) {
          const resultData = safeJson(response.data);

          if (resultData && Array.isArray(resultData.errors) && resultData.errors.length > 0) {
            const addedCount = resultData.addedCount ?? itemsToAdd.length - resultData.errors.length;
            addError.value = `Добавлено ~${addedCount} ОС. Ошибки: ${resultData.errors
              .map((e) => `(${e.item?.ИнвентарныйНомер || '??'}): ${e.error}`)
              .join('; ')}`;
            addSuccessMessage.value = null;
          } else if (resultData) {
            addSuccessMessage.value =
              resultData.message ||
              `Успешно обработано ${resultData.addedCount ?? itemsToAdd.length} ОС.`;
            addError.value = null;
          } else {
            addSuccessMessage.value = `Запрос выполнен (статус ${response.status}), но ответ сервера пустой.`;
          }
          await fetchAllData();
        } else {
          throw new Error(`Неожиданный статус ответа при добавлении: ${response.status}`);
        }
      } catch (err) {
        addSuccessMessage.value = null;
        if (err.response) {
          addError.value = `Ошибка сервера (${err.response.status}) при добавлении на ${err.config?.url}.`;
          try {
            const errorData =
              typeof err.response.data === 'object'
                ? JSON.stringify(err.response.data)
                : String(err.response.data);
            addError.value += ` Ответ: ${errorData}`;
          } catch (e) {
            void e;
          }
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

    const addAllNewGroupedItems = async () => {
      if (newGroupedOsItems.value.length === 0 || addingGroupedItems.value) return;

      addingGroupedItems.value = true;
      addGroupedError.value = null;
      addGroupedSuccessMessage.value = null;

      const agg = new Map();

      newGroupedOsItems.value.forEach((item) => {
        const nameRaw = (item.Наименование || '').toString().trim();
        const molRaw = (item.МатериальноОтветственный || '').toString().trim();

        const nameKey = normalizeStr(nameRaw);
        const molKey = normalizeStr(molRaw);
        const key = `${nameKey}||${molKey}`;
        if (!nameKey) return;

        if (!agg.has(key)) {
          agg.set(key, {
            НаименованиеОС: nameRaw,
            МатериальноОтветственный: molRaw,
            qtySum: 0,
            totalCostSum: 0,
            invSet: new Set()
          });
        }

        const g = agg.get(key);

        const invList = parseInvNumbers(item.ИнвентарныйНомер)
          .map((x) => normalizeInv(x))
          .filter(Boolean);
        invList.forEach((inv) => g.invSet.add(inv));

        const qtyLine = invList.length > 0 ? invList.length : Number(item.Количество) || 1;
        g.qtySum += qtyLine;

        let pricePerUnitLine = Number(item.СтоимостьЗаЕдиницу);
        if (!pricePerUnitLine || isNaN(pricePerUnitLine)) {
          const total = Number(item.Стоимость) || 0;
          pricePerUnitLine = qtyLine > 0 ? total / qtyLine : total;
        }

        const lineTotal = (Number(pricePerUnitLine) || 0) * (Number(qtyLine) || 0);
        g.totalCostSum += lineTotal;
      });

      const itemsToAdd = Array.from(agg.values()).map((g) => {
        const invArr = Array.from(g.invSet).filter(Boolean);

        const qtyFinal = invArr.length > 0 ? invArr.length : Number(g.qtySum) || 1;
        const pricePerUnit =
          qtyFinal > 0 ? (Number(g.totalCostSum) || 0) / qtyFinal : Number(g.totalCostSum) || 0;

        const payloadItem = {
          НаименованиеОС: g.НаименованиеОС,
          МатериальноОтветственный: g.МатериальноОтветственный,
          Количество: qtyFinal,
          СтоимостьЗаЕдиницу: Number(pricePerUnit) || 0,
          ГрупповойУчот: true
        };

        if (invArr.length === 1) {
          payloadItem.ИнвентарныйНомер = invArr[0];
        } else if (invArr.length > 1) {
          payloadItem.ИнвентарныйНомера = invArr.map((num) => ({ ИнвентарныйНомер: num }));
        }

        return payloadItem;
      });

      try {
        const response = await axios.post(API_ADD_RCDO_GRUPP_URL, itemsToAdd, {
          timeout: 600000,
          headers: {
            Authorization: AUTH_HEADER_RCDO,
            'Content-Type': 'application/json',
            Accept: 'application/json'
          }
        });

        if ((response.status >= 200 && response.status < 300) || response.status === 207) {
          const resultData = safeJson(response.data);

          if (resultData && Array.isArray(resultData.errors) && resultData.errors.length > 0) {
            const addedCount = resultData.addedCount ?? itemsToAdd.length - resultData.errors.length;
            addGroupedError.value = `Добавлено ~${addedCount} групповых ОС. Ошибки: ${resultData.errors
              .map(
                (e) =>
                  `(${e.item?.НаименованиеОС || '??'} / ${
                    e.item?.МатериальноОтветственный || 'МОЛ?'
                  }): ${e.error}`
              )
              .join('; ')}`;
            addGroupedSuccessMessage.value = null;
          } else if (resultData) {
            addGroupedSuccessMessage.value =
              resultData.message ||
              `Успешно обработано ${resultData.addedCount ?? itemsToAdd.length} групповых ОС.`;
            addGroupedError.value = null;
          } else {
            addGroupedSuccessMessage.value = `Запрос выполнен (статус ${response.status}), но ответ сервера пустой.`;
          }

          await fetchAllData();
        } else {
          throw new Error(
            `Неожиданный статус ответа при добавлении группового учёта: ${response.status}`
          );
        }
      } catch (err) {
        addGroupedSuccessMessage.value = null;
        if (err.response) {
          addGroupedError.value = `Ошибка сервера (${err.response.status}) при добавлении группового учёта на ${err.config?.url}.`;
          try {
            const errorData =
              typeof err.response.data === 'object'
                ? JSON.stringify(err.response.data)
                : String(err.response.data);
            addGroupedError.value += ` Ответ: ${errorData}`;
          } catch (e) {
            void e;
          }
          if (err.response.status === 401 || err.response.status === 403) {
            addGroupedError.value = `Ошибка авторизации (${err.response.status}) при добавлении группового учёта на ${err.config?.url}. Проверьте права пользователя '${USERNAME_RCDO}' на запись/изменение и доступ к HTTP-сервису.`;
          }
        } else if (err.code === 'ECONNABORTED') {
          addGroupedError.value = `Превышено время ожидания при добавлении группового учёта (${err.config?.url}).`;
        } else if (err.request) {
          addGroupedError.value = `Сервер не ответил на запрос добавления группового учёта (${err.config?.url}).`;
        } else {
          addGroupedError.value = `Ошибка при отправке данных на ${err.config?.url}: ${err.message}`;
        }
      } finally {
        addingGroupedItems.value = false;
      }
    };

    const addMissingInvForRow = async (row) => {
      if (!row || row.rowClass !== 'row-discrepancy-inv') return;

      const missing = Array.isArray(row.missingInvNumbers) ? row.missingInvNumbers : [];
      if (missing.length === 0) return;

      addingInvNumbers.value = true;
      addInvError.value = null;
      addInvSuccessMessage.value = null;

      const payload = [
        {
          Код: row.rcdoGroupCode || undefined,
          КодПоБгу: row.rcdoGroupKey || undefined,
          ИнвентарныйНомера: missing.map((n) => ({ ИнвентарныйНомер: n }))
        }
      ];

      try {
        const response = await axios.post(API_ADD_RCDO_GRUPP_INV_URL, payload, {
          timeout: 120000,
          headers: {
            Authorization: AUTH_HEADER_RCDO,
            'Content-Type': 'application/json',
            Accept: 'application/json'
          }
        });

        const resultData = safeJson(response.data);

        if (response.status === 200 || response.status === 207) {
          if (resultData?.errors?.length) {
            addInvError.value = `Есть ошибки: ${resultData.errors.map((e) => e.error).join('; ')}`;
          } else {
            addInvSuccessMessage.value =
              resultData?.message || `Инв.№ добавлены: ${missing.join(', ')}`;
          }
          await fetchAllData();
        } else {
          throw new Error(`Неожиданный статус: ${response.status}`);
        }
      } catch (err) {
        addInvSuccessMessage.value = null;
        if (err.response) {
          addInvError.value = `Ошибка сервера (${err.response.status}) при добавлении инв.№ на ${err.config?.url}.`;
          try {
            const errorData =
              typeof err.response.data === 'object'
                ? JSON.stringify(err.response.data)
                : String(err.response.data);
            addInvError.value += ` Ответ: ${errorData}`;
          } catch (e) {
            void e;
          }
          if (err.response.status === 401 || err.response.status === 403) {
            addInvError.value = `Ошибка авторизации (${err.response.status}) при добавлении инв.№ на ${err.config?.url}. Проверьте права пользователя '${USERNAME_RCDO}' на запись/изменение справочника ГруппавойУчот.`;
          }
        } else if (err.code === 'ECONNABORTED') {
          addInvError.value = `Превышено время ожидания (${err.config?.url}).`;
        } else if (err.request) {
          addInvError.value = `Сервер не ответил (${err.config?.url}).`;
        } else {
          addInvError.value = `Ошибка: ${err.message}`;
        }
      } finally {
        addingInvNumbers.value = false;
      }
    };

    const addAllMissingInvNumbers = async () => {
      if (addingInvNumbers.value) return;
      if (missingInvTotal.value <= 0) return;

      addingInvNumbers.value = true;
      addInvError.value = null;
      addInvSuccessMessage.value = null;

      const agg = new Map();
      discrepancyInvItems.value.forEach((row) => {
        const code = row.rcdoGroupCode || '';
        const key =
          code ||
          row.rcdoGroupKey ||
          `${normalizeStr(row.Наименование)}||${normalizeStr(row.МатериальноОтветственный)}`;

        if (!agg.has(key)) {
          agg.set(key, {
            Код: code || undefined,
            КодПоБгу: row.rcdoGroupKey || undefined,
            set: new Set()
          });
        }
        (row.missingInvNumbers || []).forEach((n) => agg.get(key).set.add(String(n).trim()));
      });

      const payload = Array.from(agg.values()).map((x) => ({
        Код: x.Код,
        КодПоБгу: x.КодПоБгу,
        ИнвентарныйНомера: Array.from(x.set)
          .filter(Boolean)
          .map((n) => ({ ИнвентарныйНомер: n }))
      }));

      try {
        const response = await axios.post(API_ADD_RCDO_GRUPP_INV_URL, payload, {
          timeout: 240000,
          headers: {
            Authorization: AUTH_HEADER_RCDO,
            'Content-Type': 'application/json',
            Accept: 'application/json'
          }
        });

        const resultData = safeJson(response.data);

        if (response.status === 200 || response.status === 207) {
          if (resultData?.errors?.length) {
            addInvError.value = `Часть не добавилась: ${resultData.errors
              .map((e) => e.error)
              .join('; ')}`;
          } else {
            addInvSuccessMessage.value =
              resultData?.message ||
              `Добавлено инв.№: ${resultData?.addedCount ?? missingInvTotal.value}`;
          }
          await fetchAllData();
        } else {
          throw new Error(`Неожиданный статус: ${response.status}`);
        }
      } catch (err) {
        addInvSuccessMessage.value = null;
        if (err.response) {
          addInvError.value = `Ошибка сервера (${err.response.status}) при массовом добавлении инв.№ на ${err.config?.url}.`;
          try {
            const errorData =
              typeof err.response.data === 'object'
                ? JSON.stringify(err.response.data)
                : String(err.response.data);
            addInvError.value += ` Ответ: ${errorData}`;
          } catch (e) {
            void e;
          }
        } else if (err.code === 'ECONNABORTED') {
          addInvError.value = `Превышено время ожидания (${err.config?.url}).`;
        } else if (err.request) {
          addInvError.value = `Сервер не ответил (${err.config?.url}).`;
        } else {
          addInvError.value = `Ошибка: ${err.message}`;
        }
      } finally {
        addingInvNumbers.value = false;
      }
    };

    const conductTransfer = async (row) => {
      if (!row?.ИнвентарныйНомер) return;

      transferring.value = true;
      transferError.value = null;
      transferSuccessMessage.value = null;

      const oldMol = (row.МатериальноОтветственныйРЦДО || '').toString().trim();
      const newMol = (row.МатериальноОтветственный || '').toString().trim();

      if (oldMol && newMol && normalizeStr(oldMol) === normalizeStr(newMol)) {
        transferSuccessMessage.value = 'МОЛ уже совпадает — проводить нечего.';
        transferring.value = false;
        return;
      }

      const payload = {
        ИнвентарныйНомер: String(row.ИнвентарныйНомер).trim(),
        СтарыйМОЛ: oldMol,
        НовыйМОЛ: newMol,
        Примечание: `Перевод МОЛ по данным БГУ: "${oldMol}" → "${newMol}"`
      };

      try {
        const response = await axios.post(API_TRANSFER_OS_URL, payload, {
          timeout: 120000,
          headers: {
            Authorization: AUTH_HEADER_RCDO,
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-User': getActorLogin()
          }
        });

        const resultData = safeJson(response.data);

        if (response.status === 200 || response.status === 207) {
          if (resultData?.success === false) {
            throw new Error(resultData?.message || 'Ошибка проведения');
          }

          transferSuccessMessage.value =
            resultData?.message || 'Проведено: МОЛ в РЦДО обновлён, событие записано.';

          await fetchAllData();
          detailsVisible.value = false;
        } else {
          throw new Error(`Неожиданный статус: ${response.status}`);
        }
      } catch (err) {
        if (err.response) {
          transferError.value = `Ошибка сервера (${err.response.status}) при проведении на ${err.config?.url}.`;
          try {
            const errorData =
              typeof err.response.data === 'object'
                ? JSON.stringify(err.response.data)
                : String(err.response.data);
            transferError.value += ` Ответ: ${errorData}`;
          } catch (e) {
            void e;
          }
        } else {
          transferError.value = `Ошибка: ${err.message || 'Неизвестная ошибка'}`;
        }
      } finally {
        transferring.value = false;
      }
    };

    onMounted(fetchAllData);

    const onSortChanged = () => {
      return;
    };

    const actionButtonText = (row) => {
      if (row?.rowClass === 'row-discrepancy-inv') return 'Добавить инв.№';
      return 'Перевести';
    };

    const showTransferButton = (row) =>
      (row?.hasMolDiscrepancy === true && !row?.ГрупповойУчет) ||
      row?.rowClass === 'row-discrepancy-inv';

    const onActionTriggered = async ({ row }) => {
      if (row?.rowClass === 'row-discrepancy-inv') {
        await addMissingInvForRow(row);
        return;
      }
      transferError.value = null;
      transferSuccessMessage.value = null;

      selectedRow.value = row;
      detailsVisible.value = true;
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
      newGroupedOsItems,
      discrepancyMolItems,
      displayedOsItems,

      discrepancyInvItems,
      missingInvTotal,
      addAllMissingInvNumbers,
      addingInvNumbers,
      addInvError,
      addInvSuccessMessage,

      addAllNewItems,
      addingItems,
      addError,
      addSuccessMessage,

      addAllNewGroupedItems,
      addingGroupedItems,
      addGroupedError,
      addGroupedSuccessMessage,

      detailsVisible,
      selectedRow,

      transferring,
      transferError,
      transferSuccessMessage,
      conductTransfer,

      actionButtonText,
      showTransferButton,
      onActionTriggered
    };
  }
};
</script>

<style scoped>
.loading-indicator,
.error-container,
.meta-info,
.add-new-container {
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

.retry-button,
.add-button {
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
.retry-button:hover,
.add-button:hover {
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
  to {
    transform: rotate(360deg);
  }
}

:deep(.row-new) {
  background-color: #fff3cd !important;
}
:deep(.row-warning) {
  background-color: #f8d7da !important;
}
:deep(.row-discrepancy-mol) {
  background-color: #ffe0b2 !important;
}

:deep(.row-discrepancy-inv) {
  background-color: #e3f2fd !important;
}
</style>
