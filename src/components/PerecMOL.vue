<template>
  <div>
    <h2>МОЛ, которых нет в справочнике МОЛ</h2>
    <div v-if="loading" class="loading-indicator">
      <span class="spinner"></span> Загрузка данных...
    </div>
    <div v-if="error" class="error-container">
      <p class="error-message">{{ error }}</p>
      <p class="error-details" v-if="errorDetails">{{ errorDetails }}</p>
      <button @click="fetchAll" class="retry-button">Попробовать снова</button>
    </div>
    <div v-if="extraMolList.length === 0 && !loading && !error">
      <p>Все ответственные из OS и MZ есть в MOL.</p>
    </div>
    <table v-if="extraMolList.length > 0 && !loading && !error" class="data-table">
      <thead>
        <tr>
          <th>ФИО/МОЛ</th>
          <th>Источники (OS/MZ)</th>
          <th>Филиал для добавления</th>
          <th>Действия</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="mol in extraMolList" :key="mol.name">
          <td>{{ mol.name }}</td>
          <td>
            <span v-if="mol.fromOS">OS</span>
            <span v-if="mol.fromOS && mol.fromMZ">, </span>
            <span v-if="mol.fromMZ">MZ</span>
          </td>
          <td>
            <select v-model="mol.selectedFilial" :disabled="mol.added || mol.adding" class="select-filial">
              <option disabled value="">Выберите филиал</option>
              <option v-for="f in filialyList" :key="f" :value="f">{{ f }}</option>
            </select>
          </td>
          <td>
            <button :disabled="mol.added || mol.adding || !mol.selectedFilial" @click="addMolToDirectory(mol)" class="retry-button" style="margin:0;min-width:110px;">
              <span v-if="mol.adding"><span class="spinner" style="width:12px;height:12px;border-width:2px;margin-right:6px;"></span>Добавление...</span>
              <span v-else-if="mol.added">Добавлен</span>
              <span v-else>Добавить</span>
            </button>
            <div v-if="mol.error" class="add-error">Ошибка: {{ mol.error }}</div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script>
import { ref } from 'vue';
import http from '@/api/http';

export default {
  name: 'ExtraMolTable',
  setup() {
    const loading = ref(true);
    const error = ref(null);
    const errorDetails = ref(null);

    const filialyList = ref([]);
    const molDirectory = ref([]);
    const osResponsible = ref([]);
    const mzResponsible = ref([]);
    const extraMolList = ref([]);

    async function fetchAll() {
      loading.value = true;
      error.value = null;
      errorDetails.value = null;
      filialyList.value = [];
      molDirectory.value = [];
      osResponsible.value = [];
      mzResponsible.value = [];
      extraMolList.value = [];

      try {
        // 1. MOL
        const molRes = await http.get('/RCDO/hs/rcdo/MOL');
        let molData = molRes.data;
        if (typeof molData === 'string') molData = JSON.parse(molData);
        let molArr = molData.filialy || molData.Filialy || molData.filials || [];
        filialyList.value = molArr.map(filial => filial.Наименование).sort();
        let allMol = [];
        molArr.forEach(filial => {
          if (Array.isArray(filial.МОЛы) && filial.МОЛы.length) {
            allMol.push(...filial.МОЛы.map(m => (m.МОЛ || '').trim()));
          }
        });
        molDirectory.value = Array.from(new Set(allMol));

        // 2. OS
        const osRes = await http.get('/RCDO/hs/rcdo/OS');
        let osData = osRes.data;
        if (typeof osData === 'string') osData = JSON.parse(osData);
        let osArr = osData.osnovnye_sredstva || [];
        osResponsible.value = Array.from(new Set(osArr.map(item => (item && item.МатериальноОтветственный ? item.МатериальноОтветственный.trim() : null)).filter(Boolean)));

        // 3. MZ
        const mzRes = await http.get('/RCDO/hs/rcdo/MZ');
        let mzData = mzRes.data;
        if (typeof mzData === 'string') mzData = JSON.parse(mzData);
        let mzArr = mzData.materialnye_zapasy || [];
        mzResponsible.value = Array.from(new Set(mzArr.map(item => (item && item.МатериальноОтветственный ? item.МатериальноОтветственный.trim() : null)).filter(Boolean)));

        // 4. Вычисляем отсутствующих в MOL
        const allExtra = [];
        osResponsible.value.forEach(name => {
          if (!molDirectory.value.includes(name)) {
            allExtra.push({ name, fromOS: true, fromMZ: false, added: false, adding: false, error: null, selectedFilial: '' });
          }
        });
        mzResponsible.value.forEach(name => {
          const existing = allExtra.find(x => x.name === name);
          if (existing) {
            existing.fromMZ = true;
          } else if (!molDirectory.value.includes(name)) {
            allExtra.push({ name, fromOS: false, fromMZ: true, added: false, adding: false, error: null, selectedFilial: '' });
          }
        });
        extraMolList.value = allExtra;

      } catch (err) {
        error.value = 'Ошибка при загрузке данных';
        errorDetails.value = err.message || '';
      } finally {
        loading.value = false;
      }
    }

    async function addMolToDirectory(mol) {
      mol.adding = true;
      mol.error = null;
      const body = { МОЛ: mol.name, Филиал: mol.selectedFilial };
      try {
        await http.post('/RCDO/hs/rcdo/addMOL', body);
        mol.added = true;
        mol.adding = false;
        setTimeout(fetchAll, 800);
      } catch (e) {
        mol.adding = false;
        mol.error = e?.response?.data?.message || e.message || 'Не удалось добавить';
      }
    }

    fetchAll();

    return { loading, error, errorDetails, extraMolList, filialyList, fetchAll, addMolToDirectory };
  },
};
</script>

<style scoped>
.loading-indicator, .error-container {
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
.retry-button {
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
.retry-button:hover {
  background-color: #0056b3;
}
.add-error {
  color: #d8000c;
  font-size: 13px;
  margin-top: 3px;
}
.spinner {
  display: inline-block;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: #333;
  width: 14px;
  height: 14px;
  animation: spin 1s ease-in-out infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
.data-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 15px;
}
.data-table th, .data-table td {
  border: 1px solid #eee;
  padding: 8px 12px;
  text-align: left;
}
.data-table th {
  background: #f8f9fa;
}
.select-filial {
  padding: 5px 10px;
  border-radius: 4px;
  border: 1px solid #bbb;
  background: #fff;
  min-width: 120px;
}
</style>
