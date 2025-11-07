<template>
  <div v-if="show" class="modal-mask">
    <div class="modal-wrapper">
      <div class="modal-container">
        <div class="modal-header">
          <h3>Содержимое договора №{{ nomerDisplay }}</h3>
          <button class="close" @click="emit('close')">×</button>
        </div>

        <div class="modal-body" v-if="loading">Загрузка…</div>

        <div class="modal-body error" v-else-if="error">
          <p><strong>Ошибка:</strong> {{ error }}</p>
          <button class="btn" @click="fetchDetails">Попробовать снова</button>
        </div>

        <div class="modal-body" v-else>
          <div v-if="contractData?.договор">
            <p><b>Наименование:</b> {{ contractData.договор.Наименование }}</p>
            <p><b>Филиал:</b> {{ contractData.договор.Филиал }}</p>
            <p><b>ФИО:</b> {{ contractData.договор.ФИО }}</p>
            <p><b>Дата подписания:</b> {{ contractData.договор.Дата_Подписания }}</p>

            <h4 class="mt">Состав оборудования ({{ contractData.договор.КоличествоОборудования }})</h4>
            <table class="tbl">
              <thead>
                <tr>
                  <th>Тип</th>
                  <th>Инв./МЗ</th>
                  <th>Наименование</th>
                  <th>Кол-во</th>
                  <th>Стоимость</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, idx) in contractData.договор.СоставОборудования" :key="idx">
                  <td>{{ row.Тип }}</td>
                  <td>
                    <template v-if="row.Тип === 'ОС'">{{ row.ИинвентарныйНомер || row.ИнвентарныйНомер }}</template>
                    <template v-else>{{ row.МЗ_ID }}</template>
                  </td>
                  <td>{{ row.НаименованиеОС || row.НаименованиеМЗ }}</td>
                  <td>{{ row.Количество || (row.Тип === 'ОС' ? 1 : '') }}</td>
                  <td>{{ row.Стоимость }}</td>
                </tr>
              </tbody>
            </table>

            <p class="mt"><b>Общая стоимость:</b> {{ contractData.договор.ОбщаяСтоимостьОборудования }}</p>
          </div>

          <div v-else>
            <p>Данные по договору не найдены.</p>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn" @click="emit('close')">Закрыть</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import http from '@/api/http';

const props = defineProps({
  show: { type: Boolean, default: false },
  contract: { type: Object, default: null },
  nomer: { type: [String, Number], default: '' }
});
const emit = defineEmits(['close']);

const loading = ref(false);
const error = ref('');
const contractData = ref(null);

const rawNomer = computed(() => {
  const c = props.contract || {};
  const val =
    props.nomer ??
    c?.Номер_Договора ??
    c?.Nomer_Договора ??
    c?.Номер ??
    c?.nomer ??
    '';
  return String(val);
});
const nomerParam = computed(() => rawNomer.value.replace(/\D+/g, ''));
const nomerDisplay = computed(() => rawNomer.value || nomerParam.value);

async function fetchDetails() {
  error.value = '';
  contractData.value = null;
  const n = nomerParam.value;
  if (!n) {
    error.value = 'Не указан номер договора.';
    return;
  }
  loading.value = true;
  try {
    // 1) прямой вызов “родной” 1С-ручки с кириллицей
    const first = await http.get('/RCDO/hs/rcdo/URLUD_ДоговорПоНомеру', { params: { nomer: n } });
    contractData.value = first?.data || null;

    // 2) если вдруг 1С отвалилась на имени — пробуем Dogovor (иногда есть псевдоним на гейтвее)
    if (!contractData.value || contractData.value.error) {
      const second = await http.get('/RCDO/hs/rcdo/Dogovor', { params: { nomer: n } });
      contractData.value = second?.data || null;
      if (!contractData.value || contractData.value.error) {
        throw new Error(contractData.value?.message || 'Договор не найден');
      }
    }
  } catch (e) {
    error.value = e?.response?.data?.message || e?.response?.data || e?.message || 'Ошибка загрузки';
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.show,
  (v) => { if (v) fetchDetails(); }
);
</script>

<style scoped>
.modal-mask{position:fixed;z-index:9998;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center}
.modal-container{background:#fff;width:min(900px,96vw);border-radius:8px;box-shadow:0 10px 30px rgba(0,0,0,.2);overflow:hidden}
.modal-header{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #eee}
.modal-body{padding:16px}
.modal-body.error{color:#b00020}
.modal-footer{padding:12px 16px;border-top:1px solid #eee;display:flex;justify-content:flex-end;gap:8px}
.close{border:none;background:transparent;font-size:20px;cursor:pointer}
.btn{padding:8px 12px;border-radius:6px;border:1px solid #ddd;background:#f7f7f7;cursor:pointer}
.btn:hover{background:#efefef}
.tbl{width:100%;border-collapse:collapse;margin-top:8px}
.tbl th,.tbl td{border:1px solid #eee;padding:6px 8px;text-align:left}
.mt{margin-top:10px}
</style>
