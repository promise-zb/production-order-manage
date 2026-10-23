<template>
  <!-- Element Plus 自带的就是浅色主题。 -->
  <el-config-provider :locale="zhCn">
    <router-view />
  </el-config-provider>
</template>

<script setup lang="ts">
import zhCn from 'element-plus/es/locale/lang/zh-cn'
</script>

<style>
html,
body,
#app {
  margin: 0;
  min-height: 100%;
  background: #f5f5f5;
}
</style>
