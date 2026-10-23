import type { Order, OrderStatus } from '../../api'

export type TableTab = 'all' | 'production' | 'finance'

export interface TableColumn {
  title: string
  key?: string
  dataIndex?: keyof Order
  width?: number
  fixed?: 'left' | 'right'
  ellipsis?: boolean
}

export interface StatusOption {
  value: OrderStatus
  label: string
  type: 'primary' | 'success' | 'info' | 'warning' | 'danger'
}

// 日期控件清空时是 null，提交前再转成空字符串。
export interface OrderForm {
  orderNo: string
  name: string
  alias: string
  customerName: string
  customerAddress: string
  contactName: string
  contactPhone: string
  productName: string
  styleNo: string
  status: OrderStatus
  orderQty: number
  unitPrice: number
  todayShipQty: number
  shippedQty: number
  orderTotalHours: number
  materialDoneAt: string | null
  orderDate: string | null
  deliveryDate: string | null
  remark: string
}

export interface DetailField {
  label: string
  value: string | number
}
