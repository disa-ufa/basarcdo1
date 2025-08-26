<template>
  <div class="mz-side-panel-backdrop" @click.self="$emit('close')">
    <div class="mz-side-panel">
      <button class="close-btn" @click="$emit('close')">×</button>
      <h3>Детали материального запаса</h3>
      <div v-if="mzData">
        <p><b>Наименование МЗ:</b><br> {{ mzData.НаименованиеМЗ || mzData.Наименование }}</p>
        <p><b>Стоимость:</b><br> {{ mzData.СтоимостьПоследняя }}</p>
        <p><b>Ответственный:</b><br> {{ mzData.МатериальноОтветственный }}</p>
        <p><b>Филиал:</b><br> {{ mzData.ФилиалRaw }}</p>
        <p><b>Количество всего:</b><br> {{ mzData.Количество }}</p>
        <p><b>Количество в договорах:</b><br> {{ mzData.КолВДоговорах }}</p>
      </div>
      <hr>
      <h4>Договора</h4>
      <table class="mz-dogovora-table">
        <thead>
          <tr>
            <th>Договор</th>
            <th>Количество</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!mzData.Договоры || mzData.Договоры.length === 0">
            <td colspan="2" style="text-align:center;">-</td>
          </tr>
          <tr v-for="(dogovor, idx) in mzData.Договоры" :key="idx">
            <td>{{ dogovor.НомерДоговора || '-' }}</td>
            <td>
              <!-- отобразим количество или "-" если undefined -->
              {{ (dogovor.Количество !== undefined && dogovor.Количество !== null) ? dogovor.Количество : '-' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    mzData: { type: Object, required: true }
  },
  emits: ['close']
};
</script>

<style scoped>
.mz-side-panel-backdrop {
  position: fixed;
  z-index: 9999;
  left: 0; top: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.12);
  display: flex;
  justify-content: flex-end;
  align-items: stretch;
}

.mz-side-panel {
  background: #fff;
  width: 500px;
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

.mz-dogovora-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 15px;
  margin-top: 8px;
  margin-bottom: 8px;
}
.mz-dogovora-table th,
.mz-dogovora-table td {
  border: 1px solid #ddd;
  padding: 4px 8px;
  text-align: left;
}
.mz-dogovora-table th {
  background: #f3f3f3;
  font-weight: 600;
}
</style>
