<template>
  <div v-if="visible" class="modal-overlay" @click.self="onClose">
    <div class="modal-content">
      <button class="modal-close-button" @click="onClose">&times;</button>
      <h3>Перевод ОС (просмотр)</h3>

      <div v-if="!item" class="empty-state">
        Данные об оборудовании не выбраны.
      </div>

      <div v-else class="content">
        <div class="grid">
          <div><strong>Наименование:</strong></div>
          <div>{{ item.Наименование }}</div>

          <div><strong>Инвентарный №:</strong></div>
          <div>{{ item.ИнвентарныйНомер }}</div>

          <div><strong>Стоимость (БГУ):</strong></div>
          <div>{{ item.СтоимостьFormatted }}</div>

          <div><strong>МОЛ (БГУ):</strong></div>
          <div>{{ item.МатериальноОтветственный }}</div>

          <div><strong>МОЛ (РЦДО):</strong></div>
          <div>{{ item.МатериальноОтветственныйРЦДО }}</div>

          <div><strong>Статус:</strong></div>
          <div>{{ item.Статус }}</div>
        </div>

        <div class="divider"></div>

        <h4>Перемещение в БГУ</h4>
        <p class="note">
          Здесь должны отображаться <em>дата</em> и <em>документ</em> перемещения из БГУ.<br>
          Пока серверная часть не трогаем — ставим плейсхолдеры.
        </p>

        <div class="grid">
          <div><strong>Дата перемещения:</strong></div>
          <div>—</div>
          <div><strong>Документ:</strong></div>
          <div>—</div>
        </div>

        <div class="footer">
          <button class="primary" @click="onClose">Понятно</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AnalizDetailsModal',
  props: {
    visible: { type: Boolean, default: false },
    item: { type: Object, default: null }
  },
  emits: ['close'],
  setup(props, { emit }) {
    const onClose = () => emit('close');
    return { onClose };
  }
};
</script>

<style scoped>
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,.55);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000; padding: 20px;
}
.modal-content {
  background: #fff; border-radius: 10px; padding: 22px 26px;
  width: 92%; max-width: 760px; max-height: 90vh; overflow: auto;
  position: relative; box-shadow: 0 10px 30px rgba(0,0,0,.25);
}
.modal-close-button {
  position: absolute; top: 10px; right: 14px;
  border: 0; background: transparent; font-size: 28px; line-height: 1; cursor: pointer; color: #888;
}
.modal-close-button:hover { color: #333; }

h3 { margin: 0 0 14px; }
.divider { height: 1px; background: #eee; margin: 16px 0; }
.grid {
  display: grid; grid-template-columns: 220px 1fr; gap: 8px 14px;
  align-items: center;
}
.note { color: #666; margin: 6px 0 10px; }
.footer { margin-top: 18px; display: flex; justify-content: flex-end; gap: 8px; }
.primary {
  background: #1976d2; color: #fff; border: 0; border-radius: 6px;
  padding: 8px 14px; cursor: pointer; font-weight: 600;
}
.primary:hover { background: #145ca6; }

.empty-state {
  color: #777; background: #fafafa; border: 1px dashed #e3e3e3; padding: 16px; border-radius: 8px;
}
</style>
