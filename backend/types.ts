// 订单在接口里的形状。金额和剩余数量由服务端重算。
export interface Order {
  id: number
  orderNo: string
  name: string
  alias: string
  customerName: string
  customerAddress: string
  contactName: string
  contactPhone: string
  productName: string
  styleNo: string
  status: string
  orderQty: number
  unitPrice: number
  totalAmount: number
  todayShipQty: number
  shippedQty: number
  remainQty: number
  materialDoneAt: string
  orderTotalHours: number
  orderDate: string
  deliveryDate: string
  remark: string
  createdAt: string
  updatedAt: string
}

// 新增、导入和示例数据进来时字段可以缺，normalize 会补齐。
export interface OrderDraft {
  id?: number
  orderNo?: string
  name?: string
  alias?: string
  customerName?: string
  customerAddress?: string
  contactName?: string
  contactPhone?: string
  productName?: string
  styleNo?: string
  status?: string
  orderQty?: number
  unitPrice?: number
  totalAmount?: number
  todayShipQty?: number
  shippedQty?: number
  remainQty?: number
  materialDoneAt?: string
  orderTotalHours?: number
  orderDate?: string
  deliveryDate?: string
  remark?: string
  createdAt?: string
  updatedAt?: string
}

export interface QueryRunner {
  get(sql: string, params?: unknown[]): Promise<unknown>
  all(sql: string, params?: unknown[]): Promise<unknown[]>
  run(sql: string, params?: unknown[]): Promise<{ lastInsertRowid: number; changes: number }>
}
