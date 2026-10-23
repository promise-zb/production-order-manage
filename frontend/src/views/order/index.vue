<template>
  <el-card class="panel" shadow="never">
    <OrderToolbar
      v-model:keyword="keyword"
      v-model:status="status"
      :importing="importing"
      :loading="loading"
      :selected-count="selectedRowKeys.length"
      @search="onSearch"
      @reset="onReset"
      @create="openCreate"
      @import="onImport"
      @template="downloadTemplate"
      @export-filtered="exportFiltered"
      @export-selected="exportSelected"
      @batch-delete="onBatchDelete"
      @refresh="load"
    />
    <OrderTable
      v-model:table-tab="tableTab"
      :list="list"
      :loading="loading"
      :page="page"
      :page-size="pageSize"
      :total="total"
      @selection-change="onSelectionChange"
      @detail="openDetail"
      @edit="openEdit"
      @remove="onDelete"
      @page-change="onPageChange"
      @page-size-change="onPageSizeChange"
    />
  </el-card>

  <OrderFormDialog
    v-model:open="formOpen"
    :editing="editingId != null"
    :saving="saving"
    :form="form"
    @submit="onSubmit"
  />
  <OrderDetailDrawer v-model:open="detailOpen" :loading="detailLoading" :fields="fields" />
</template>

<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type UploadRequestOptions } from 'element-plus'
import { api, type Order, type OrderStatus } from '../../api'
import OrderDetailDrawer from './components/OrderDetailDrawer/index.vue'
import OrderFormDialog from './components/OrderFormDialog/index.vue'
import OrderTable from './components/OrderTable/index.vue'
import OrderToolbar from './components/OrderToolbar/index.vue'
import type { TableTab } from './types'
import { detailFields, emptyForm, errorText, fillForm, toPayload } from './utils'

const tableTab = ref<TableTab>('all')
const list = ref<Order[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const loading = ref(false)
const keyword = ref('')
const status = ref<OrderStatus>()
const selectedRowKeys = ref<number[]>([])
const importing = ref(false)

async function load() {
  loading.value = true
  try {
    const data = await api.listOrders({
      page: page.value,
      pageSize: pageSize.value,
      keyword: keyword.value.trim(),
      status: status.value,
    })
    list.value = data.list || []
    total.value = data.total || 0
    selectedRowKeys.value = []
    if (list.value.length === 0 && page.value > 1) {
      page.value -= 1
      loading.value = false
      return load()
    }
  } catch (err) {
    ElMessage.error(errorText(err, '加载失败'))
  } finally {
    loading.value = false
  }
}

function onSearch() {
  page.value = 1
  load()
}

function onReset() {
  keyword.value = ''
  status.value = undefined
  page.value = 1
  load()
}

function onPageChange(value: number) {
  page.value = value
  load()
}

function onPageSizeChange(value: number) {
  pageSize.value = value
  page.value = 1
  load()
}

function onSelectionChange(rows: Order[]) {
  selectedRowKeys.value = rows.map((row) => row.id)
}

const formOpen = ref(false)
const saving = ref(false)
const editingId = ref<number | null>(null)
const form = reactive(emptyForm())

function openCreate() {
  editingId.value = null
  Object.assign(form, emptyForm())
  formOpen.value = true
}

function openEdit(record: Order) {
  editingId.value = record.id
  Object.assign(form, fillForm(record))
  formOpen.value = true
}

async function onSubmit() {
  if (form.shippedQty > form.orderQty) {
    ElMessage.error('累计已出货不能大于订单总数')
    return
  }
  if (form.todayShipQty > form.orderQty) {
    ElMessage.error('当天出货数量不能大于订单总数')
    return
  }
  if (editingId.value) {
    try {
      await ElMessageBox.confirm('保存后会覆盖原来的订单内容。', '确认保存修改？', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      })
    } catch {
      return
    }
  }
  saving.value = true
  try {
    const body = toPayload(form)
    if (editingId.value) {
      await api.updateOrder(editingId.value, body)
      ElMessage.success('已保存')
    } else {
      await api.createOrder(body)
      ElMessage.success('已新增')
    }
    formOpen.value = false
    await load()
  } catch (err) {
    ElMessage.error(errorText(err, '保存失败'))
  } finally {
    saving.value = false
  }
}

async function onDelete(record: Order) {
  try {
    await ElMessageBox.confirm(
      '将删除「' + record.name + '」。删除后不能恢复。',
      '确认删除这条订单？',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
  } catch {
    return
  }
  try {
    await api.deleteOrder(record.id)
    ElMessage.success('已删除')
    await load()
  } catch (err) {
    ElMessage.error(errorText(err, '删除失败'))
  }
}

async function onBatchDelete() {
  if (selectedRowKeys.value.length === 0) return
  try {
    await ElMessageBox.confirm(
      '删除后不能恢复。',
      '确认删除选中的 ' + selectedRowKeys.value.length + ' 条订单？',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
  } catch {
    return
  }
  try {
    const data = await api.batchDeleteOrders(selectedRowKeys.value)
    ElMessage.success('已删除 ' + data.deleted + ' 条')
    await load()
  } catch (err) {
    ElMessage.error(errorText(err, '删除失败'))
  }
}

const detailOpen = ref(false)
const detailLoading = ref(false)
const detail = ref<Order | null>(null)
const fields = computed(() => detailFields(detail.value))

async function openDetail(record: Order) {
  detail.value = null
  detailOpen.value = true
  detailLoading.value = true
  try {
    detail.value = await api.getOrder(record.id)
  } catch (err) {
    ElMessage.error(errorText(err, '加载详情失败'))
  } finally {
    detailLoading.value = false
  }
}

async function onImport(options: UploadRequestOptions) {
  importing.value = true
  try {
    const data = await api.importOrders(options.file)
    options.onSuccess?.(data)
    const errors = data.errors || []
    if (errors.length === 0) {
      ElMessage.success('已导入 ' + data.inserted + ' 条')
    } else {
      ElMessageBox.alert(
        h('div', { style: 'white-space: pre-wrap' }, errors.slice(0, 10).join('\n')),
        '导入完成：成功 ' + data.inserted + ' 条，失败 ' + errors.length + ' 条',
        { confirmButtonText: '知道了' },
      )
    }
    page.value = 1
    await load()
  } catch (err) {
    options.onError?.(err as Parameters<NonNullable<UploadRequestOptions['onError']>>[0])
    ElMessage.error(errorText(err, '导入失败'))
  } finally {
    importing.value = false
  }
}

function downloadTemplate() {
  api.downloadOrderTemplate().catch((err: unknown) => ElMessage.error(errorText(err, '下载失败')))
}

function exportSelected() {
  if (selectedRowKeys.value.length === 0) return
  api
    .exportOrders({ ids: selectedRowKeys.value.join(',') }, '订单-选中.xlsx')
    .catch((err: unknown) => ElMessage.error(errorText(err, '导出失败')))
}

function exportFiltered() {
  api
    .exportOrders(
      {
        keyword: keyword.value.trim() || undefined,
        status: status.value,
      },
      '订单-筛选.xlsx',
    )
    .catch((err: unknown) => ElMessage.error(errorText(err, '导出失败')))
}

onMounted(load)
</script>

<style scoped lang="less" src="./index.less"></style>
