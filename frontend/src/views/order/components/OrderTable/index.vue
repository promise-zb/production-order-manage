<template>
  <!-- 三张表用的是同一批订单。后两张只是从总表里挑出相关列。 -->
  <el-tabs v-model="tableTab" class="table-tabs">
    <el-tab-pane label="总表" name="all" />
    <el-tab-pane label="生产跟进表" name="production" />
    <el-tab-pane label="财务相关表" name="finance" />
  </el-tabs>

  <el-table
    :key="tableTab"
    v-loading="loading"
    row-key="id"
    :data="list"
    @selection-change="onSelectionChange"
  >
    <el-table-column type="selection" width="48" fixed="left" />
    <el-table-column
      v-for="column in columns"
      :key="column.dataIndex || column.key"
      :prop="column.dataIndex"
      :label="column.title"
      :width="column.width"
      :fixed="column.fixed"
      :show-overflow-tooltip="column.ellipsis"
    >
      <template #default="{ row }">
        <template v-if="column.key === 'status'">
          <el-tag :type="statusMeta(row.status).type" effect="light">{{
            statusMeta(row.status).label
          }}</el-tag>
        </template>
        <template v-else-if="column.key === 'unitPrice' || column.key === 'totalAmount'">
          {{ money(cellText(row, column)) }}
        </template>
        <template v-else-if="column.key === 'remainQty'">
          <span :style="{ color: row.remainQty > 0 ? '#d4380d' : '#389e0d', fontWeight: 600 }">
            {{ row.remainQty }}
          </span>
        </template>
        <template v-else-if="column.key === 'action'">
          <el-button link type="primary" @click="emit('detail', row)">查看</el-button>
          <el-button link type="primary" @click="emit('edit', row)">修改</el-button>
          <el-button link type="danger" @click="emit('remove', row)">删除</el-button>
        </template>
        <template v-else>{{ cellText(row, column) }}</template>
      </template>
    </el-table-column>
  </el-table>

  <div class="pager">
    <el-pagination
      background
      layout="total, prev, pager, next, sizes"
      :current-page="page"
      :page-size="pageSize"
      :total="total"
      :page-sizes="[10, 20, 50, 100]"
      @current-change="onPageChange"
      @size-change="onPageSizeChange"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Order } from '../../../../api'
import type { TableTab } from '../../types'
import { cellText, columnsFor, money, statusMeta } from '../../utils'

const tableTab = defineModel<TableTab>('tableTab', { required: true })

defineProps<{
  list: Order[]
  loading: boolean
  page: number
  pageSize: number
  total: number
}>()

const emit = defineEmits<{
  selectionChange: [rows: Order[]]
  detail: [row: Order]
  edit: [row: Order]
  remove: [row: Order]
  pageChange: [page: number]
  pageSizeChange: [pageSize: number]
}>()

const columns = computed(() => columnsFor(tableTab.value))

function onSelectionChange(rows: Order[]) {
  emit('selectionChange', rows)
}

function onPageChange(value: number) {
  emit('pageChange', value)
}

function onPageSizeChange(value: number) {
  emit('pageSizeChange', value)
}
</script>

<style scoped lang="less" src="./index.less"></style>
