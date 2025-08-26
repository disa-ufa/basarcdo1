<template>
  <div class="app">
    <AppSidebar />
    <div class="content">
      <router-view></router-view>
    </div>
  </div>
</template>

<script>
import AppSidebar from './components/AppSidebar.vue'

export default {
  name: 'App',
  components: { AppSidebar }
}
</script>

<style>
body {
  margin: 0;
  padding: 0;
  font-family: Arial, sans-serif;
}

.app {
  display: flex;
  min-height: 100vh;
}
</style>