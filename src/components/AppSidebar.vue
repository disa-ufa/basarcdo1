<template>
  <div class="sidebar">
    <div class="sidebar-header">
      <h3>РЦДО Меню</h3>
    </div>
    <div class="sidebar-menu">
      <!-- Пользователи -->
      <div class="menu-category">
        <div class="menu-category-header" @click="toggleCategory('users')">
          <span>Пользователи</span>
          <span class="arrow" :class="{ 'arrow-down': expandedCategories.users }">▶</span>
        </div>
        <div class="menu-items" v-if="expandedCategories.users">
          <div 
            class="menu-item" 
            :class="{ 'active': activeItem === 'ucit' }"
            @click="setActiveItem('students')"
          >
            Ученики
          </div>
          <div 
            class="menu-item" 
            :class="{ 'active': activeItem === 'teachers' }"
            @click="setActiveItem('teachers')"
          >
            Учителя
          </div>
        </div>
      </div>
      
      <!-- Договора -->
      <div class="menu-category">
        <div class="menu-category-header" @click="toggleCategory('contracts')">
          <span>Договора</span>
          <span class="arrow" :class="{ 'arrow-down': expandedCategories.contracts }">▶</span>
        </div>
        <div class="menu-items" v-if="expandedCategories.contracts">
          <div 
            class="menu-item" 
            :class="{ 'active': activeItem === 'student-contracts' }"
            @click="setActiveItem('student-contracts')"
          >
            Ученики
          </div>
          <div 
            class="menu-item" 
            :class="{ 'active': activeItem === 'teacher-contracts' }"
            @click="setActiveItem('teacher-contracts')"
          >
            Учителя
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue';

export default {
  name: 'AppSidebar',
  props: {
    modelValue: {
      type: String,
      default: 'students'
    }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const expandedCategories = ref({
      users: true,
      contracts: false
    });

    const activeItem = ref(props.modelValue);

    const toggleCategory = (category) => {
      expandedCategories.value[category] = !expandedCategories.value[category];
    };

    const setActiveItem = (item) => {
      activeItem.value = item;
      emit('update:modelValue', item);
    };

    return {
      expandedCategories,
      activeItem,
      toggleCategory,
      setActiveItem
    };
  }
}
</script>

<style scoped>
.sidebar {
  width: 250px;
  background-color: #2c3e50;
  color: white;
  height: 100vh;
  box-shadow: 2px 0 5px rgba(0,0,0,0.1);
}

.sidebar-header {
  padding: 20px 15px;
  border-bottom: 1px solid #3c4e60;
}

.sidebar-header h3 {
  margin: 0;
  font-size: 18px;
}

.sidebar-menu {
  padding: 15px 0;
}

.menu-category {
  margin-bottom: 10px;
}

.menu-category-header {
  padding: 10px 15px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: bold;
  transition: background-color 0.2s;
}

.menu-category-header:hover {
  background-color: #3c4e60;
}

.menu-items {
  padding-left: 15px;
}

.menu-item {
  padding: 8px 15px 8px 20px;
  cursor: pointer;
  transition: background-color 0.2s;
  border-left: 3px solid transparent;
}

.menu-item:hover {
  background-color: #3c4e60;
}

.menu-item.active {
  background-color: #34495e;
  border-left-color: #42b983;
}

.arrow {
  transition: transform 0.3s;
  font-size: 10px;
}

.arrow-down {
  transform: rotate(90deg);
}
</style>