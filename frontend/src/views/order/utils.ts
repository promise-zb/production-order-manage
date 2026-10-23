import type { Order, OrderInput } from '../../api'
import type { DetailField, OrderForm, StatusOption, TableColumn, TableTab } from './types'

export const statusOptions: StatusOption[] = [
  { value: 'pending', label: '待生产', type: 'info' },
  { value: 'processing', label: '生产中', type: 'primary' },
  { value: 'partial_shipped', label: '部分出货', type: 'warning' },
  { value: 'done', label: '已完成', type: 'success' },
  { value: 'cancelled', label: '已取消', type: 'danger' },
]

export function statusMeta(value?: string) {
  return (
    statusOptions.find((item) => item.value === value) || {
      label: value || '-',
      type: 'info' as const,
    }
  )
}

export function money(value: unknown) {
  return Number(value || 0).toFixed(2)
}

export function show(value: unknown) {
  if (value === 0) return 0
  return value ? String(value) : '-'
}

export function errorText(err: unknown, fallback: string) {
  return err instanceof Error && err.message ? err.message : fallback
}

const actionColumn: TableColumn = { title: '操作', key: 'action', width: 180, fixed: 'right' }

// 总表保留全部字段。下面两张表按字段名从这里取，不另存一份数据。
const allColumns: TableColumn[] = [
  { title: '订单编号', dataIndex: 'orderNo', width: 150, fixed: 'left' },
  { title: '名称', dataIndex: 'name', width: 160, ellipsis: true },
  { title: '别名', dataIndex: 'alias', width: 120, ellipsis: true },
  { title: '状态', key: 'status', dataIndex: 'status', width: 110 },
  { title: '客户名称', dataIndex: 'customerName', width: 140, ellipsis: true },
  { title: '客户地址', dataIndex: 'customerAddress', width: 220, ellipsis: true },
  { title: '订单总数', dataIndex: 'orderQty', width: 100 },
  { title: '单个金额', key: 'unitPrice', dataIndex: 'unitPrice', width: 110 },
  { title: '订单总金额', key: 'totalAmount', dataIndex: 'totalAmount', width: 120 },
  { title: '当天出货数量', dataIndex: 'todayShipQty', width: 120 },
  { title: '累计已出货', dataIndex: 'shippedQty', width: 110 },
  { title: '剩余未完成数量', key: 'remainQty', dataIndex: 'remainQty', width: 140 },
  { title: '单个材料完成时间', dataIndex: 'materialDoneAt', width: 180 },
  { title: '订单完成总时间(小时)', dataIndex: 'orderTotalHours', width: 170 },
  { title: '交货日期', dataIndex: 'deliveryDate', width: 120 },
  { title: '备注', dataIndex: 'remark', width: 180, ellipsis: true },
  { title: '创建时间', dataIndex: 'createdAt', width: 170 },
  { title: '修改时间', dataIndex: 'updatedAt', width: 170 },
]

const columnByField: Partial<Record<keyof Order, TableColumn>> = {}
for (const column of allColumns) {
  if (column.dataIndex) columnByField[column.dataIndex] = column
}

function pickColumns(fields: (keyof Order)[]) {
  return fields
    .map((field) => {
      const column = columnByField[field]
      if (!column) throw new Error('缺少列 ' + field)
      return column
    })
    .concat(actionColumn)
}

const columnsByTab: Record<TableTab, TableColumn[]> = {
  all: allColumns.concat(actionColumn),
  production: pickColumns([
    'orderNo',
    'name',
    'alias',
    'status',
    'customerName',
    'orderQty',
    'todayShipQty',
    'shippedQty',
    'remainQty',
    'materialDoneAt',
    'orderTotalHours',
    'deliveryDate',
    'remark',
  ]),
  finance: pickColumns([
    'orderNo',
    'name',
    'customerName',
    'customerAddress',
    'orderQty',
    'unitPrice',
    'totalAmount',
    'createdAt',
    'updatedAt',
  ]),
}

export function columnsFor(tab: TableTab) {
  return columnsByTab[tab] || columnsByTab.all
}

export function cellText(row: Order, column: TableColumn) {
  if (!column.dataIndex) return ''
  return row[column.dataIndex]
}

export function emptyForm(): OrderForm {
  return {
    orderNo: '',
    name: '',
    alias: '',
    customerName: '',
    customerAddress: '',
    contactName: '',
    contactPhone: '',
    productName: '',
    styleNo: '',
    status: 'pending',
    orderQty: 0,
    unitPrice: 0,
    todayShipQty: 0,
    shippedQty: 0,
    orderTotalHours: 0,
    materialDoneAt: null,
    orderDate: null,
    deliveryDate: null,
    remark: '',
  }
}

export function fillForm(record: Order): OrderForm {
  return {
    ...emptyForm(),
    orderNo: record.orderNo || '',
    name: record.name || '',
    alias: record.alias || '',
    customerName: record.customerName || '',
    customerAddress: record.customerAddress || '',
    contactName: record.contactName || '',
    contactPhone: record.contactPhone || '',
    productName: record.productName || '',
    styleNo: record.styleNo || '',
    status: record.status || 'pending',
    orderQty: record.orderQty || 0,
    unitPrice: record.unitPrice || 0,
    todayShipQty: record.todayShipQty || 0,
    shippedQty: record.shippedQty || 0,
    orderTotalHours: record.orderTotalHours || 0,
    materialDoneAt: record.materialDoneAt || null,
    orderDate: record.orderDate || null,
    deliveryDate: record.deliveryDate || null,
    remark: record.remark || '',
  }
}

export function toPayload(form: OrderForm): OrderInput {
  return {
    orderNo: form.orderNo.trim(),
    name: form.name.trim(),
    alias: form.alias.trim(),
    customerName: form.customerName.trim(),
    customerAddress: form.customerAddress.trim(),
    contactName: form.contactName.trim(),
    contactPhone: form.contactPhone.trim(),
    productName: form.productName.trim(),
    styleNo: form.styleNo.trim(),
    status: form.status,
    orderQty: Number(form.orderQty || 0),
    unitPrice: Number(form.unitPrice || 0),
    todayShipQty: Number(form.todayShipQty || 0),
    shippedQty: Number(form.shippedQty || 0),
    orderTotalHours: Number(form.orderTotalHours || 0),
    materialDoneAt: form.materialDoneAt || '',
    orderDate: form.orderDate || '',
    deliveryDate: form.deliveryDate || '',
    remark: form.remark.trim(),
  }
}

export function detailFields(item: Order | null): DetailField[] {
  if (!item) return []
  return [
    { label: '订单编号', value: show(item.orderNo) },
    { label: '名称', value: show(item.name) },
    { label: '别名', value: show(item.alias) },
    { label: '状态', value: statusMeta(item.status).label },
    { label: '客户名称', value: show(item.customerName) },
    { label: '客户地址', value: show(item.customerAddress) },
    { label: '联系人', value: show(item.contactName) },
    { label: '联系电话', value: show(item.contactPhone) },
    { label: '产品名称', value: show(item.productName) },
    { label: '款号', value: show(item.styleNo) },
    { label: '订单总数', value: show(item.orderQty) },
    { label: '单个金额', value: money(item.unitPrice) },
    { label: '订单总金额', value: money(item.totalAmount) },
    { label: '当天出货数量', value: show(item.todayShipQty) },
    { label: '累计已出货数量', value: show(item.shippedQty) },
    { label: '剩余未完成数量', value: show(item.remainQty) },
    { label: '单个材料完成时间', value: show(item.materialDoneAt) },
    { label: '订单完成总时间（小时）', value: show(item.orderTotalHours) },
    { label: '下单日期', value: show(item.orderDate) },
    { label: '交货日期', value: show(item.deliveryDate) },
    { label: '备注', value: show(item.remark) },
    { label: '创建时间', value: show(item.createdAt) },
    { label: '修改时间', value: show(item.updatedAt) },
  ]
}
