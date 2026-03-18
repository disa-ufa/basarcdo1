<template>
  <div v-if="visible" class="modal-backdrop" @click.self="emitClose">
    <div class="modal-card">
      <button class="modal-close" @click="emitClose" aria-label="Закрыть">×</button>

      <h3 class="modal-title">Перевод ОС (просмотр)</h3>

      <div v-if="!item" class="muted">Нет данных</div>

      <div v-else class="modal-body">
        <div class="kv">
          <div class="k">Наименование:</div>
          <div class="v">{{ item.Наименование || '—' }}</div>

          <div class="k">Инвентарный №:</div>
          <div class="v">{{ item.ИнвентарныйНомер || '—' }}</div>

          <div class="k">Стоимость (БГУ):</div>
          <div class="v">{{ item.СтоимостьFormatted || item.Стоимость || '—' }}</div>

          <div class="k">МОЛ (БГУ):</div>
          <div class="v">{{ item.МатериальноОтветственный || '—' }}</div>

          <div class="k">МОЛ (РЦДО):</div>
          <div class="v">{{ item.МатериальноОтветственныйРЦДО || '—' }}</div>

          <div class="k">Статус:</div>
          <div class="v">{{ item.Статус || '—' }}</div>
        </div>

        <hr class="sep" />

        <h4 class="sub-title">Перемещение (РЦДО)</h4>
        <div class="muted">
          При нажатии “Провести” — МОЛ в РЦДО будет заменён на МОЛ из БГУ и запишется событие в историю.
        </div>

        <div v-if="error" class="msg error">{{ error }}</div>
        <div v-if="success" class="msg success">{{ success }}</div>
      </div>

      <div class="modal-footer">
        <button class="btn secondary" @click="emitClose" :disabled="loading">Отмена</button>

        <button
          class="btn primary"
          @click="emitConduct"
          :disabled="loading || !item || !item.ИнвентарныйНомер"
          title="Провести перевод (заменить МОЛ в РЦДО и записать историю)"
        >
          <span v-if="loading" class="spinner"></span>
          {{ loading ? 'Проведение...' : 'Провести' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AnalizDetailsModal',
  props: {
    visible: { type: Boolean, default: false },
    item: { type: Object, default: null },
    loading: { type: Boolean, default: false },
    error: { type: String, default: null },
    success: { type: String, default: null }
  },
  emits: ['close', 'conduct'],
  methods: {
    emitClose() {
      this.$emit('close');
    },
    emitConduct() {
      this.$emit('conduct', this.item);
    }
  }
};
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
}
.modal-card {
  width: min(860px, 95vw);
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(0,0,0,.25);
  position: relative;
  padding: 18px 18px 14px;
}
.modal-close {
  position: absolute;
  top: 10px;
  right: 12px;
  border: none;
  background: transparent;
  font-size: 22px;
  cursor: pointer;
  line-height: 1;
}
.modal-title {
  margin: 0 0 12px;
  font-weight: 700;
}
.modal-body {
  padding-top: 6px;
}
.kv {
  display: grid;
  grid-template-columns: 180px 1fr;
  gap: 8px 12px;
}
.k { font-weight: 600; color: #222; }
.v { color: #111; }
.sep { margin: 16px 0; border: 0; border-top: 1px solid #eee; }
.sub-title { margin: 0 0 8px; font-weight: 700; }
.muted { color: #666; font-size: 0.95em; }

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 14px;
}
.btn {
  border: none;
  border-radius: 6px;
  padding: 8px 14px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.btn.primary { background: #0d6efd; color: #fff; }
.btn.secondary { background: #e9ecef; color: #111; }
.btn:disabled { opacity: .6; cursor: not-allowed; }

.msg {
  margin-top: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 0.95em;
}
.msg.error { background: #f8d7da; color: #721c24; }
.msg.success { background: #d4edda; color: #155724; }

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,.35);
  border-top-color: rgba(255,255,255,1);
  border-radius: 50%;
  display: inline-block;
  animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
