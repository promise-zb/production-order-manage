<template>
  <el-container class="layout">
    <el-aside class="sider" width="200px">
      <div class="sider-logo">生产跟单</div>
      <el-menu :default-active="route.path" @select="onSelect">
        <el-menu-item v-for="item in menus" :key="item.path" :index="item.path">
          {{ item.meta.title }}
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="header">
        <span class="page-title">{{ title }}</span>
        <div class="header-right">
          <span class="user">{{ username }}</span>
          <el-button link type="primary" @click="logout">退出登录</el-button>
        </div>
      </el-header>
      <el-main class="content">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const username = ref(localStorage.getItem('username') || 'admin')
const title = computed(() => route.meta.title || '')
const menus = computed(() => router.getRoutes().filter((item) => item.meta.menu))

function onSelect(path: string) {
  router.push(path)
}

function logout() {
  localStorage.removeItem('token')
  localStorage.removeItem('username')
  router.push('/login')
}
</script>

<style scoped lang="less" src="./index.less"></style>
