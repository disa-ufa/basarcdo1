<template>
  <div class="os-side-panel-backdrop" @click.self="$emit('close')">
    <div class="os-side-panel">
      <button class="close-btn" @click="$emit('close')">×</button>
      <h3>Детали основного средства</h3>
      <div v-if="osData">
        <p><b>Наименование ОС:</b><br> {{ osData.НаименованиеОС }}</p>
        <p><b>Инвентарный номер:</b><br> {{ osData.ИнвентарныйНомер }}</p>
        <p><b>Стоимость:</b><br> {{ osData.СтоимостьПоследняя }}</p>
        <p><b>Ответственный:</b><br> {{ osData.МатериальноОтветственный }}</p>
        <p><b>Филиал:</b><br> {{ osData.Филиал }}</p>
      </div>

      <div v-if="dogovorLoading" style="margin: 24px 0;">
        <span class="small-spinner"></span> Загрузка данных договора...
      </div>
      <template v-else>
        <div v-if="dogovorData">
          <hr>
          <h4>Договор</h4>
          <p><b>Номер:</b> {{ dogovorData.Номер_Договора }}</p>
          <p><b>Дата подписания:</b> {{ dogovorData.Дата_Подписания }}</p>
          <p><b>Тип:</b> {{ dogovorData.Пользователь }}</p>
          <p><b>ФИО:</b> {{ dogovorData.ФИО }}</p>
          <p><b>Филиал:</b> {{ dogovorData.Филиал }}</p>
        </div>
        <div v-else>
          <hr>
          <h4>Иное место нахождения (примечания)</h4>
          <div v-if="!editMode">
            <p v-if="osData && osData.ИноеМестоНахождения">{{ osData.ИноеМестоНахождения }}</p>
            <p v-else><em>Нет договора и примечаний для этого ОС.</em></p>
            <button @click="startEdit" class="edit-btn">Редактировать</button>
          </div>
          <div v-else>
            <textarea v-model="editInoe" rows="3" style="width: 100%;"></textarea>
            <div style="margin-top: 10px;">
              <button @click="saveInoe" :disabled="saving" class="save-btn">{{ saving ? 'Сохранение...' : 'Сохранить' }}</button>
              <button @click="cancelEdit" :disabled="saving" class="cancel-btn">Отмена</button>
            </div>
            <div v-if="errorMsg" class="edit-error">{{ errorMsg }}</div>
          </div>
        </div>
      </template>

      <hr>
      <h4 style="margin-top:24px;">История перемещений</h4>
      <div v-if="historyLoading" style="margin: 10px 0;">
        <span class="small-spinner"></span> Загрузка истории...
      </div>
      <div v-else>
        <div v-if="osHistory && osHistory.length">
          <table class="history-table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Событие</th>
                <th>Договор</th>
                <th>Комментарий</th>
                <th>Пользователь</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, idx) in osHistory" :key="idx">
                <td>{{ item.ДатаСобытия }}</td>
                <td>{{ item.ТипСобытия }}</td>
                <td>{{ item.Договор }}</td>
                <td>{{ item.Комментарий }}</td>
                <td>{{ item.Пользователь }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else>
          <em v-if="historyError">{{ historyError }}</em>
          <em v-else>Нет истории перемещений по данному ОС.</em>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, watch } from 'vue';
import http from '@/api/http';

export default {
  props: {
    osData: Object,
    dogovorData: Object,
    dogovorLoading: Boolean
  },
  emits: ['close', 'inoe-updated'],
  setup(props, { emit }) {
    const editMode = ref(false);
    const editInoe = ref('');
    const saving = ref(false);
    const errorMsg = ref('');
    const osHistory = ref([]);
    const historyLoading = ref(false);
    const historyError = ref('');

    const loadOsHistory = async (invNumber) => {
      if (!invNumber) {
        osHistory.value = [];
        historyError.value = '';
        return;
      }
      historyLoading.value = true;
      osHistory.value = [];
      historyError.value = '';
      try {
        const { data } = await http.get('/RCDO/hs/rcdo/OSHISTORY', { params: { inv: String(invNumber) } });
        if (Array.isArray(data)) {
          osHistory.value = data;
          historyError.value = '';
        } else if (data && data.error) {
          osHistory.value = [];
          historyError.value = data.error;
        } else {
          osHistory.value = [];
          historyError.value = '';
        }
      } catch (e) {
        osHistory.value = [];
        if (e.response?.data && typeof e.response.data === 'object' && e.response.data.error) {
          historyError.value = e.response.data.error;
        } else {
          historyError.value = 'Ошибка загрузки истории';
        }
      } finally {
        historyLoading.value = false;
      }
    };

    watch(() => props.osData, async (val) => {
      editMode.value = false;
      editInoe.value = val?.ИноеМестоНахождения || '';
      errorMsg.value = '';
      if (val?.ИнвентарныйНомер) {
        await loadOsHistory(val.ИнвентарныйНомер);
      } else {
        osHistory.value = [];
        historyError.value = '';
      }
    }, { immediate: true });

    const startEdit = () => {
      editInoe.value = props.osData?.ИноеМестоНахождения || '';
      editMode.value = true;
      errorMsg.value = '';
    };
    const cancelEdit = () => {
      editMode.value = false;
      errorMsg.value = '';
    };

    const saveInoe = async () => {
      if (!props.osData || !props.osData.Код) return;
      saving.value = true;
      errorMsg.value = '';
      try {
        await http.post('/RCDO/hs/rcdo/PATCH_OS/', {
          Код: props.osData.Код,
          ИноеМестоНахождения: editInoe.value
        });
        emit('inoe-updated', { Код: props.osData.Код, ИноеМестоНахождения: editInoe.value });
        editMode.value = false;
      } catch (e) {
        errorMsg.value = 'Ошибка при сохранении: ' + (e.response?.data || e.message);
      } finally {
        saving.value = false;
      }
    };

    return { editMode, editInoe, saving, errorMsg, startEdit, cancelEdit, saveInoe, osHistory, historyLoading, historyError };
  }
};
</script>

<style scoped>
.os-side-panel-backdrop {
  position: fixed;
  z-index: 9999;
  left: 0; top: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.12);
  display: flex;
  justify-content: flex-end;
  align-items: stretch;
}
.os-side-panel {
  background: #fff;
  width: 650px;
  max-width: 100vw;
  height: 100%;
  box-shadow: -2px 0 24px rgba(0,0,0,0.13);
  position: relative;
  padding: 36px 28px 20px 28px;
  animation: slideInPanel .35s cubic-bezier(.33,.9,.56,1.02);
  overflow-y: auto;
}
@keyframes slideInPanel {
  from { transform: translateX(100%); opacity: 0.3; }
  to { transform: translateX(0); opacity: 1; }
}
.close-btn {
  position: absolute; right: 18px; top: 12px; border: none; background: none;
  font-size: 26px; color: #333; cursor: pointer;
}
.history-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  margin-top: 8px;
}
.history-table th,
.history-table td {
  border: 1px solid #ddd;
  padding: 4px 8px;
}
.history-table th {
  background: #f3f3f3;
  font-weight: 600;
}
.small-spinner {
  display: inline-block;
  width: 18px;
  height: 18px;
  border: 2px solid #b8b8b8;
  border-top: 2px solid #409eff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  margin-right: 8px;
  vertical-align: middle;
}
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
.edit-btn, .save-btn, .cancel-btn {
  margin: 0 3px;
  padding: 3px 10px;
  font-size: 13px;
  border-radius: 6px;
  border: 1px solid #bbb;
  background: #f7f7f7;
  cursor: pointer;
}
.edit-btn:hover, .save-btn:hover {
  background: #e9f3ff;
  border-color: #409eff;
}
.cancel-btn:hover {
  background: #fff2f2;
  border-color: #ff8888;
}
.edit-error {
  color: #d03a3a;
  margin-top: 8px;
}
</style>
