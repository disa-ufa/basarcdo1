<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import http from '@/api/http';

const props = defineProps({
  visible: Boolean,
  loading: Boolean,
  error: String,
  errorDetails: String,
  contractData: Object,
  contractRaw: Object,
  formatDate: Function,
  formatDateTime: Function,
  formatCurrency: Function,
  autoEdit: Boolean
});
const emit = defineEmits(['close', 'retry']);

const isEditing = ref(false);
const editedEquipment = ref([]);
const allOs = ref([]);
const availableOs = ref([]);
const filialMols = ref([]);
const availableMz = ref([]);
const searchOs = ref('');
const searchMz = ref('');
const saving = ref(false);
const saveError = ref('');
const tab = ref('os');
const showHoz = ref(false);

function openAndEdit() {
  if (props.visible && props.contractData) {
    isEditing.value = true;
    startEditing();
  }
}

watch(() => [props.visible, props.contractData, props.autoEdit], async ([v, cd, ae]) => {
  if (v && cd && ae) {
    await nextTick();
    isEditing.value = true;
    await startEditing();
  }
  if (!v) {
    isEditing.value = false;
  }
}, { immediate: true });

async function startEditing() {
  saveError.value = '';
  editedEquipment.value = props.contractData?.СоставОборудования
    ? JSON.parse(JSON.stringify(props.contractData.СоставОборудования))
    : [];
  isEditing.value = true;
  await fetchFilialMolsAndMz();
  await fetchAvailableOs();
}

function onClose() {
  isEditing.value = false;
  emit('close');
}
function cancelEdit() { saveError.value = ''; isEditing.value = false; }

function isEquipmentAdded(os) {
  return editedEquipment.value.some(eq => eq.ИнвентарныйНомер === os.ИнвентарныйНомер);
}
function addEquipment(os) {
  if (!isEquipmentAdded(os)) {
    editedEquipment.value.push({
      ИнвентарныйНомер: os.ИнвентарныйНомер,
      НаименованиеОС: os.НаименованиеОС,
      Стоимость: os.СтоимостьПоследняя,
      Тип: 'ОС'
    });
  }
}
function isMzAdded(mz) {
  return editedEquipment.value.some(eq => eq.МЗ_ID === (mz.КодПоБгу || mz.Код));
}
function addMzToContract(mz) {
  const maxCount = mz.Количество - mz.КолВДоговорах;
  let qty = prompt(`Введите количество (максимум: ${maxCount}):`, 1);
  qty = Math.max(1, Math.min(maxCount, Number(qty) || 1));
  if (!qty) return;
  editedEquipment.value.push({
    МЗ_ID: mz.КодПоБгу || mz.Код,
    НаименованиеМЗ: mz.НаименованиеМЗ,
    Стоимость: mz.СтоимостьПоследняя,
    Количество: qty,
    Тип: 'МЗ'
  });
}
function removeEquipment(idx) { editedEquipment.value.splice(idx, 1); }

async function fetchFilialMolsAndMz() {
  filialMols.value = [];
  const filial = props.contractData?.Филиал;

  const molResp = await http.get('/RCDO/hs/rcdo/MOL');
  const molData = typeof molResp.data === 'string' ? JSON.parse(molResp.data) : molResp.data;
  const found = molData.filialy?.find(fil => fil.НаименованиеФилиала === filial || fil.Наименование === filial);
  if (found) {
    filialMols.value = found.МОЛы.map(x => (x.МОЛ || '').trim());
  }

  const mzResp = await http.get('/RCDO/hs/rcdo/MZ');
  const mzData = typeof mzResp.data === 'string' ? JSON.parse(mzResp.data) : mzResp.data;
  availableMz.value = mzData.materialnye_zapasy || mzData.мз || [];
}

async function fetchAvailableOs() {
  const filial = props.contractData?.Филиал;

  const molResp = await http.get('/RCDO/hs/rcdo/MOL');
  const molData = typeof molResp.data === 'string' ? JSON.parse(molResp.data) : molResp.data;
  const found = molData.filialy?.find(fil => fil.НаименованиеФилиала === filial || fil.Наименование === filial);
  let mols = [];
  if (found) mols = found.МОЛы.map(x => (x.МОЛ || '').trim());

  const osResp = await http.get('/RCDO/hs/rcdo/OS');
  const osData = typeof osResp.data === 'string' ? JSON.parse(osResp.data) : osResp.data;
  availableOs.value = (osData.osnovnye_sredstva || []).filter(
    os => mols.includes((os.МатериальноОтветственный || '').trim()) &&
          (os.Договор === 0 || os.Договор === '0' || os.Договор == null)
  );
  allOs.value = osData.osnovnye_sredstva || [];
}

const filteredAvailableOs = computed(() => {
  const query = searchOs.value.toLowerCase();
  return availableOs.value
    .filter(os => !isEquipmentAdded(os))
    .filter(os =>
      !query ||
      (os.ИнвентарныйНомер && os.ИнвентарныйНомер.toLowerCase().includes(query)) ||
      (os.НаименованиеОС && os.НаименованиеОС.toLowerCase().includes(query))
    );
});

const filteredAvailableMz = computed(() => {
  const query = searchMz.value.toLowerCase();
  const _filialMolsArr = filialMols.value.map(m => (m || '').trim());
  return availableMz.value
    .filter(mz => showHoz.value || !mz.Хоз)
    .filter(mz => mz.Количество > mz.КолВДоговорах)
    .filter(mz => _filialMolsArr.includes((mz.МатериальноОтветственный || '').trim()))
    .filter(mz =>
      !query ||
      (mz.НаименованиеМЗ && mz.НаименованиеМЗ.toLowerCase().includes(query)) ||
      (mz.Код && String(mz.Код).toLowerCase().includes(query))
    )
    .filter(mz => !isMzAdded(mz));
});

async function saveEdit() {
  saveError.value = '';
  saving.value = true;
  try {
    const payload = {
      СоставОборудования: editedEquipment.value.map(item => {
        if (item.Тип === 'МЗ') {
          return {
            МЗ_ID: item.МЗ_ID,
            НаименованиеМЗ: item.НаименованиеМЗ,
            Стоимость: item.Стоимость,
            Количество: item.Количество,
            Тип: 'МЗ'
          };
        } else {
          return {
            ИнвентарныйНомер: item.ИнвентарныйНомер,
            НаименованиеОС: item.НаименованиеОС,
            Стоимость: item.Стоимость,
            Тип: 'ОС'
          };
        }
      }),
      Пользователь: JSON.parse(localStorage.getItem('user'))?.Логин || ''
    };
    const nomer = props.contractData?.Номер_Договора;
    await http.post('/RCDO/hs/rcdo/RedDogovor', payload, { params: { nomer } });
    isEditing.value = false;
    emit('retry');
  } catch (e) {
    saveError.value = e.message || 'Не удалось сохранить изменения';
  } finally {
    saving.value = false;
  }
}

defineExpose({ openAndEdit });
</script>

<template>
  <div v-if="visible" class="modal-overlay" @click.self="onClose">
    <div class="modal-content" style="min-width: 600px">
      <button @click="onClose" class="modal-close-button">&times;</button>
      <h3>Содержимое договора №{{ contractData?.Номер_Договора || '...' }}</h3>
      <div v-if="!isEditing">
        <div v-if="loading" class="loading-indicator modal-loading">
          <span class="spinner"></span> Загрузка деталей...
        </div>
        <div v-if="error" class="error-container modal-error">
          <p class="error-message">{{ error }}</p>
          <p class="error-details" v-if="errorDetails">Техническая информация: {{ errorDetails }}</p>
          <button @click="$emit('retry')" class="retry-button">Попробовать снова</button>
        </div>
        <div v-if="contractData && !loading && !error" class="contract-details">
          <p><strong>№:</strong> {{ contractData.Наименование }}</p>
          <p><strong>Дата подписания:</strong> {{ formatDate(contractData.Дата_Подписания) }}</p>
          <p><strong>Пользователь:</strong> {{ contractData.Пользователь }}</p>
          <p><strong>ФИО:</strong> {{ contractData.ФИО }}</p>
          <p><strong>Филиал:</strong> {{ contractData.Филиал }}</p>
          <h4>Состав оборудования ({{ contractData.КоличествоОборудования || 0 }} шт.)</h4>
          <div v-if="contractData.СоставОборудования && contractData.СоставОборудования.length > 0" class="equipment-list">
            <table>
              <thead>
                <tr>
                  <th>Инв. номер</th>
                  <th>Наименование</th>
                  <th>Стоимость</th>
                  <th>Кол-во</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, idx) in contractData.СоставОборудования" :key="item.ИнвентарныйНомер || item.МЗ_ID || idx">
                  <td>{{ item.Тип === 'МЗ' ? 'Без номера' : item.ИнвентарныйНомер }}</td>
                  <td>{{ item.Тип === 'МЗ' ? item.НаименованиеМЗ : item.НаименованиеОС }}</td>
                  <td>{{ formatCurrency(item.Стоимость) }}</td>
                  <td>{{ item.Тип === 'МЗ' ? item.Количество : 1 }}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="3" style="text-align: right; font-weight: bold;">Итого</td>
                  <td style="font-weight: bold;">{{ formatCurrency(contractData.ОбщаяСтоимостьОборудования) }}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p v-else>Состав оборудования не указан.</p>
          <p><small>Данные на: {{ formatDateTime(contractRaw?.датаФормирования) }}</small></p>
          <button @click="startEditing" class="retry-button" style="margin-top: 20px;">Редактировать</button>
        </div>
      </div>

      <div v-else>
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
          <button @click="saveEdit" class="retry-button" :disabled="saving">{{ saving ? 'Сохраняю...' : 'Сохранить' }}</button>
          <button @click="cancelEdit" class="retry-button" :disabled="saving">Отмена</button>
        </div>
        <div v-if="saveError" class="error-container modal-error">
          <p class="error-message">{{ saveError }}</p>
        </div>
        <h4>Редактирование состава оборудования</h4>
        <div class="equipment-editor">
          <div>
            <h5>В составе договора</h5>
            <table>
              <thead>
                <tr>
                  <th>Инв. номер</th>
                  <th>Наименование</th>
                  <th>Стоимость</th>
                  <th>Кол-во</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, idx) in editedEquipment" :key="item.ИнвентарныйНомер || item.МЗ_ID || idx">
                  <td>{{ item.Тип === 'МЗ' ? 'Без номера' : item.ИнвентарныйНомер }}</td>
                  <td>{{ item.Тип === 'МЗ' ? item.НаименованиеМЗ : item.НаименованиеОС }}</td>
                  <td>{{ formatCurrency(item.Стоимость) }}</td>
                  <td>{{ item.Тип === 'МЗ' ? item.Количество : 1 }}</td>
                  <td><button @click="removeEquipment(idx)" style="color: red" :disabled="saving">Удалить</button></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style="margin-top: 24px;">
            <div style="display: flex; gap: 8px; margin-bottom: 10px;">
              <button :class="{active: tab==='os'}" @click="tab='os'">Основные средства филиала</button>
              <button :class="{active: tab==='mz'}" @click="tab='mz'">Материальные запасы филиала</button>
            </div>
            <div v-if="tab === 'mz'" style="margin-bottom: 10px;">
              <label><input type="checkbox" v-model="showHoz"> Показать хоз. МЗ</label>
              <input v-model="searchMz" placeholder="Поиск по наименованию МЗ" style="margin-left: 10px; padding: 4px; width: 60%;">
            </div>

            <div v-if="tab === 'os'">
              <input v-model="searchOs" placeholder="Поиск по наименованию или инв. номеру" style="margin-bottom: 10px; padding: 4px; width: 60%;">
              <table>
                <thead><tr><th>Инв. номер</th><th>Наименование</th><th>Стоимость</th><th></th></tr></thead>
                <tbody>
                  <tr v-for="os in filteredAvailableOs" :key="os.ИнвентарныйНомер">
                    <td>{{ os.ИнвентарныйНомер }}</td>
                    <td>{{ os.НаименованиеОС }}</td>
                    <td>{{ formatCurrency(os.СтоимостьПоследняя) }}</td>
                    <td><button @click="addEquipment(os)" :disabled="saving">Добавить</button></td>
                  </tr>
                </tbody>
              </table>
              <div v-if="filteredAvailableOs.length === 0" style="padding: 10px 0; color: #888;">Нет доступных ОС</div>
            </div>

            <div v-if="tab === 'mz'">
              <table>
                <thead><tr><th>Наименование</th><th>Стоимость</th><th>Доступно</th><th></th></tr></thead>
                <tbody>
                  <tr v-for="mz in filteredAvailableMz" :key="mz.КодПоБгу || mz.Код">
                    <td>{{ mz.НаименованиеМЗ }}</td>
                    <td>{{ formatCurrency(mz.СтоимостьПоследняя) }}</td>
                    <td>{{ mz.Количество - mz.КолВДоговорах }}</td>
                    <td><button @click="addMzToContract(mz)" :disabled="saving || (mz.Количество - mz.КолВДоговорах <= 0)">Добавить</button></td>
                  </tr>
                </tbody>
              </table>
              <div v-if="filteredAvailableMz.length === 0" style="padding: 10px 0; color: #888;">Нет доступных МЗ</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>




<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  padding: 20px;
  box-sizing: border-box;
}
.modal-content {
  background-color: white;
  padding: 25px 30px;
  border-radius: 8px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
  position: relative;
  max-width: 800px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
}
.modal-close-button {
  position: absolute;
  top: 10px;
  right: 15px;
  background: none;
  border: none;
  font-size: 28px;
  line-height: 1;
  cursor: pointer;
  color: #888;
  padding: 0;
}
.modal-close-button:hover {
    color: #333;
}
.modal-content h3 {
  margin-top: 0;
  margin-bottom: 20px;
  color: #333;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
}
.contract-details p {
  margin: 8px 0;
  line-height: 1.6;
}
.contract-details strong {
  color: #555;
}
.contract-details h4 {
    margin-top: 25px;
    margin-bottom: 10px;
    color: #333;
    border-bottom: 1px solid #eee;
    padding-bottom: 5px;
}
.equipment-list table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 10px;
}
.equipment-list th,
.equipment-list td {
    border: 1px solid #ddd;
    padding: 8px 10px;
    text-align: left;
    font-size: 14px;
}
.equipment-list th {
    background-color: #f8f9fa;
    font-weight: bold;
}
.equipment-list tbody tr:nth-child(even) {
    background-color: #f9f9f9;
}
.equipment-list tfoot td {
    border-top: 2px solid #ccc;
}
.modal-loading {
    margin: 30px 0;
    text-align: center;
}
.modal-error {
    margin: 20px 0;
}
.error-container {
  margin: 20px 0;
  padding: 15px;
  background-color: #fff8f8;
  border-left: 4px solid #ff5252;
  border-radius: 4px;
}
.error-message {
  color: #d32f2f;
  margin-bottom: 8px;
  font-weight: bold;
}
.error-details {
  color: #666;
  font-size: 0.9em;
  margin-bottom: 15px;
}
.retry-button {
  background-color: #2196f3;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}
.retry-button:hover {
  background-color: #0d8aee;
}
.loading-indicator {
  display: flex;
  align-items: center;
  margin: 20px 0;
}
.spinner {
  display: inline-block;
  width: 20px;
  height: 20px;
  margin-right: 10px;
  border: 3px solid rgba(0, 0, 0, 0.1);
  border-radius: 50%;
  border-top-color: #2196f3;
  animation: spin 1s ease-in-out infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
.equipment-editor {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.equipment-editor table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 10px;
}
.equipment-editor th, .equipment-editor td {
  border: 1px solid #ddd;
  padding: 5px 7px;
  text-align: left;
  font-size: 14px;
}
.equipment-editor th {
  background: #f3f3f3;
}
.active {
  background: #eaf6fd;
  color: #333;
  font-weight: bold;
}
</style>
