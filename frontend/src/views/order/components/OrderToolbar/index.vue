<template>
  <div class="toolbar">
    <div class="toolbar-filters">
      <el-input
        v-model="keyword"
        clearable
        placeholder="搜索名称、别名、订单编号、客户、地址"
        style="width: 280px"
        @keyup.enter="emit('search')"
      />
      <el-select v-model="status" clearable placeholder="全部状态" style="width: 140px">
        <el-option
          v-for="item in statusOptions"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
      </el-select>
      <el-button type="primary" @click="emit('search')">查询</el-button>
      <el-button @click="emit('reset')">重置</el-button>
    </div>
    <div class="toolbar-actions">
      <el-button type="primary" @click="emit('create')">新增</el-button>
      <el-upload
        :show-file-list="false"
        accept=".xlsx"
        :http-request="onImport"
        :disabled="importing"
      >
        <el-button :loading="importing">导入 Excel</el-button>
      </el-upload>
      <el-button @click="emit('template')">下载模板</el-button>
      <el-button @click="emit('exportFiltered')">导出筛选结果</el-button>
      <el-dropdown trigger="click" @command="onBatchMenu">
        <el-button>批量操作</el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="export" :disabled="selectedCount === 0"
              >导出选中</el-dropdown-item
            >
            <el-dropdown-item command="delete" :disabled="selectedCount === 0">
              <span :class="{ 'danger-text': selectedCount > 0 }">批量删除</span>
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <el-button :loading="loading" @click="emit('refresh')">刷新</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { UploadRequestOptions } from 'element-plus'
import type { OrderStatus } from '../../../../api'
import { statusOptions } from '../../utils'

const keyword = defineModel<string>('keyword', { required: true })
const status = defineModel<OrderStatus>()

defineProps<{
  importing: boolean
  selectedCount: number
  loading: boolean
}>()

const emit = defineEmits<{
  search: []
  reset: []
  create: []
  template: []
  exportFiltered: []
  import: [options: UploadRequestOptions]
  exportSelected: []
  batchDelete: []
  refresh: []
}>()

function onImport(options: UploadRequestOptions) {
  emit('import', options)
}

function onBatchMenu(command: string) {
  if (command === 'export') emit('exportSelected')
  if (command === 'delete') emit('batchDelete')
}
</script>

<style scoped lang="less" src="./index.less"></style>
