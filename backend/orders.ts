// 订单的校验、查询和增删改。金额和剩余数量在这里重算，不信前端传来的数。
import type { Request, Response } from 'express'
import {
  dbDriver,
  errorText,
  formatCompact,
  formatDate,
  formatDateTime,
  isDuplicate,
  mapOrder,
  round2,
  runner,
  selectSQL,
} from './db.ts'
import type { OrderDraft, QueryRunner } from './types.ts'

const statusText: Record<string, string> = {
  pending: '待生产',
  processing: '生产中',
  partial_shipped: '部分出货',
  done: '已完成',
  cancelled: '已取消',
}

const insertSQL = `INSERT INTO orders (
  order_no, name, alias, customer_name, customer_address,
  contact_name, contact_phone, product_name, style_no, status,
  order_qty, unit_price, total_amount, today_ship_qty, shipped_qty, remain_qty,
  material_done_at, order_total_hours, order_date, delivery_date,
  remark, created_at, updated_at
) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`

function fail(res: Response, status: number, message: string) {
  res.status(status).json({ message })
}

function tooLong(value: string, max: number) {
  return Array.from(value).length > max
}

function nullIfEmpty(value: string | undefined) {
  const text = String(value || '').trim()
  return text === '' ? null : text
}

function queryText(value: unknown) {
  if (Array.isArray(value)) return String(value[0] ?? '')
  if (value == null) return ''
  return String(value)
}

function totalOf(row: unknown) {
  if (!row || typeof row !== 'object') return 0
  const data = row as Record<string, unknown>
  return Number(data.total || data.TOTAL || 0)
}

export function canonicalStatus(value: unknown) {
  const text = String(value || '').trim()
  if (text === '') return 'pending'
  if (statusText[text]) return text
  for (const [code, label] of Object.entries(statusText)) {
    if (text === label) return code
  }
  return ''
}

export function statusLabel(code: string) {
  return statusText[code] || code || ''
}

function parseDateParts(value: unknown) {
  const text = String(value || '').trim()
  if (text === '') return null
  let match = text.match(
    /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  )
  if (!match) match = text.match(/^(\d{2})-(\d{2})-(\d{2})$/)
  if (!match) return null
  let year = 0
  let month = 0
  let day = 0
  let hour = 0
  let minute = 0
  let second = 0
  if (match[1].length === 2) {
    year = 2000 + Number(match[3])
    month = Number(match[1])
    day = Number(match[2])
  } else {
    year = Number(match[1])
    month = Number(match[2])
    day = Number(match[3])
    hour = Number(match[4] || 0)
    minute = Number(match[5] || 0)
    second = Number(match[6] || 0)
  }
  const date = new Date(year, month - 1, day, hour, minute, second)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day)
    return null
  return date
}

function normalizeDate(value: unknown, withTime: boolean) {
  const text = String(value || '').trim()
  if (text === '') return ''
  const date = parseDateParts(text)
  if (!date) {
    throw new Error(
      withTime ? '单个材料完成时间格式应为 2006-01-02 15:04:05' : '日期格式应为 2006-01-02',
    )
  }
  return withTime ? formatDateTime(date) : formatDate(date)
}

function numberOrZero(value: unknown, label: string) {
  if (value == null || value === '') return 0
  const n = Number(value)
  if (!Number.isFinite(n)) throw new Error(label + '不是数字')
  return n
}

// normalize 统一整理字段。总金额和剩余数量不信前端，避免两边各算各的。
export function normalize(order: OrderDraft) {
  order.orderNo = String(order.orderNo || '').trim()
  order.name = String(order.name || '').trim()
  order.alias = String(order.alias || '').trim()
  order.customerName = String(order.customerName || '').trim()
  order.customerAddress = String(order.customerAddress || '').trim()
  order.contactName = String(order.contactName || '').trim()
  order.contactPhone = String(order.contactPhone || '').trim()
  order.productName = String(order.productName || '').trim()
  order.styleNo = String(order.styleNo || '').trim()
  order.remark = String(order.remark || '').trim()

  if (order.name === '') throw new Error('名称不能为空')
  if (tooLong(order.name, 100) || tooLong(order.alias, 100) || tooLong(order.orderNo, 50)) {
    throw new Error('名称、别名或订单编号过长')
  }
  if (tooLong(order.customerAddress, 200) || tooLong(order.remark, 500)) {
    throw new Error('地址或备注过长')
  }
  if (order.orderNo === '') order.orderNo = 'PO' + formatCompact(new Date())

  const status = canonicalStatus(order.status)
  if (!status) throw new Error('状态不正确，可选：待生产、生产中、部分出货、已完成、已取消')
  order.status = status

  order.orderQty = numberOrZero(order.orderQty, '订单总数')
  order.unitPrice = numberOrZero(order.unitPrice, '单个金额')
  order.todayShipQty = numberOrZero(order.todayShipQty, '当天出货数量')
  order.shippedQty = numberOrZero(order.shippedQty, '累计已出货数量')
  order.orderTotalHours = numberOrZero(order.orderTotalHours, '订单完成总时间')
  order.orderQty = Math.round(order.orderQty)
  order.todayShipQty = Math.round(order.todayShipQty)
  order.shippedQty = Math.round(order.shippedQty)

  if (
    order.orderQty < 0 ||
    order.todayShipQty < 0 ||
    order.shippedQty < 0 ||
    order.unitPrice < 0 ||
    order.orderTotalHours < 0
  ) {
    throw new Error('数量、金额和时间不能为负数')
  }
  if (order.shippedQty > order.orderQty) throw new Error('累计已出货不能大于订单总数')
  if (order.todayShipQty > order.orderQty) throw new Error('当天出货数量不能大于订单总数')

  try {
    order.materialDoneAt = normalizeDate(order.materialDoneAt, true)
  } catch (err) {
    if (errorText(err).startsWith('单个材料')) throw err
    throw new Error('单个材料完成时间格式应为 2006-01-02 15:04:05')
  }
  try {
    order.orderDate = normalizeDate(order.orderDate, false)
  } catch {
    throw new Error('下单日期格式应为 2006-01-02')
  }
  try {
    order.deliveryDate = normalizeDate(order.deliveryDate, false)
  } catch {
    throw new Error('交货日期格式应为 2006-01-02')
  }

  order.unitPrice = round2(order.unitPrice)
  order.orderTotalHours = round2(order.orderTotalHours)
  order.totalAmount = round2(order.unitPrice * order.orderQty)
  order.remainQty = order.orderQty - order.shippedQty
  return order
}

function insertArgs(order: OrderDraft) {
  return [
    order.orderNo,
    order.name,
    order.alias,
    order.customerName,
    order.customerAddress,
    order.contactName,
    order.contactPhone,
    order.productName,
    order.styleNo,
    order.status,
    order.orderQty,
    order.unitPrice,
    order.totalAmount,
    order.todayShipQty,
    order.shippedQty,
    order.remainQty,
    nullIfEmpty(order.materialDoneAt),
    order.orderTotalHours,
    nullIfEmpty(order.orderDate),
    nullIfEmpty(order.deliveryDate),
    order.remark,
    order.createdAt,
    order.updatedAt,
  ]
}

export async function insertOrder(db: QueryRunner, order: OrderDraft) {
  const now = formatDateTime(new Date())
  if (!String(order.createdAt || '').trim()) order.createdAt = now
  if (!String(order.updatedAt || '').trim()) order.updatedAt = now
  const args = insertArgs(order)
  if (dbDriver() === 'postgres') {
    const row = (await db.get(insertSQL + ' RETURNING id', args)) as { id?: unknown }
    return Number(row.id)
  }
  const result = await db.run(insertSQL, args)
  return result.lastInsertRowid
}

export async function findOrder(id: number) {
  const row = await runner().get(selectSQL + ' WHERE id = ?', [id])
  return mapOrder(row)
}

function atoi(value: unknown, fallback: number) {
  const n = Number.parseInt(queryText(value), 10)
  return Number.isFinite(n) ? n : fallback
}

// 关键字和状态都用占位符传入，不拼进 SQL 字符串。
export function buildFilter(keyword: unknown, status: unknown) {
  let where = 'WHERE 1=1'
  const args: unknown[] = []
  const word = queryText(keyword).trim()
  if (word) {
    const like = '%' + word + '%'
    where += ` AND (order_no LIKE ? OR name LIKE ? OR alias LIKE ? OR customer_name LIKE ?
      OR customer_address LIKE ? OR product_name LIKE ? OR style_no LIKE ? OR contact_phone LIKE ?)`
    for (let i = 0; i < 8; i++) args.push(like)
  }
  const statusTextValue = queryText(status).trim()
  if (statusTextValue) {
    const code = canonicalStatus(statusTextValue)
    if (!code) throw new Error('状态不正确')
    where += ' AND status = ?'
    args.push(code)
  }
  return { where, args }
}

export async function listOrders(req: Request, res: Response) {
  let page = atoi(req.query.page, 1)
  let pageSize = atoi(req.query.pageSize, 10)
  if (page < 1) page = 1
  if (pageSize < 1) pageSize = 10
  if (pageSize > 100) pageSize = 100

  let filter
  try {
    filter = buildFilter(req.query.keyword, req.query.status)
  } catch (err) {
    fail(res, 400, errorText(err))
    return
  }

  try {
    const db = runner()
    const countRow = await db.get(
      'SELECT COUNT(*) AS total FROM orders ' + filter.where,
      filter.args,
    )
    const total = totalOf(countRow)
    const rows = await db.all(
      selectSQL + ' ' + filter.where + ' ORDER BY updated_at DESC, id DESC LIMIT ? OFFSET ?',
      filter.args.concat([pageSize, (page - 1) * pageSize]),
    )
    res.json({ list: rows.map(mapOrder), total, page, pageSize })
  } catch (err) {
    console.error('查询订单失败:', err)
    fail(res, 500, '查询失败')
  }
}

function parseID(req: Request, res: Response) {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id <= 0) {
    fail(res, 400, '订单 ID 不正确')
    return 0
  }
  return id
}

export async function getOrder(req: Request, res: Response) {
  const id = parseID(req, res)
  if (!id) return
  try {
    const order = await findOrder(id)
    if (!order) {
      fail(res, 404, '订单不存在')
      return
    }
    res.json(order)
  } catch (err) {
    console.error('查询订单失败:', err)
    fail(res, 500, '查询失败')
  }
}

function readBody(req: Request, res: Response) {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    fail(res, 400, '请求体不是合法的 JSON')
    return null
  }
  return { ...(req.body as OrderDraft) }
}

export async function createOrder(req: Request, res: Response) {
  const order = readBody(req, res)
  if (!order) return
  order.createdAt = ''
  order.updatedAt = ''
  try {
    normalize(order)
  } catch (err) {
    fail(res, 400, errorText(err))
    return
  }
  try {
    const id = await insertOrder(runner(), order)
    res.json(await findOrder(id))
  } catch (err) {
    if (isDuplicate(err)) {
      fail(res, 400, '订单编号已存在')
      return
    }
    console.error('新增订单失败:', err)
    fail(res, 500, '新增失败')
  }
}

export async function updateOrder(req: Request, res: Response) {
  const id = parseID(req, res)
  if (!id) return
  const old = await findOrder(id)
  if (!old) {
    fail(res, 404, '订单不存在')
    return
  }
  const order = readBody(req, res)
  if (!order) return
  order.createdAt = old.createdAt
  order.updatedAt = formatDateTime(new Date())
  try {
    normalize(order)
  } catch (err) {
    fail(res, 400, errorText(err))
    return
  }
  try {
    await runner().run(
      `UPDATE orders SET
      order_no=?, name=?, alias=?, customer_name=?, customer_address=?,
      contact_name=?, contact_phone=?, product_name=?, style_no=?, status=?,
      order_qty=?, unit_price=?, total_amount=?, today_ship_qty=?, shipped_qty=?, remain_qty=?,
      material_done_at=?, order_total_hours=?, order_date=?, delivery_date=?,
      remark=?, updated_at=? WHERE id=?`,
      [
        order.orderNo,
        order.name,
        order.alias,
        order.customerName,
        order.customerAddress,
        order.contactName,
        order.contactPhone,
        order.productName,
        order.styleNo,
        order.status,
        order.orderQty,
        order.unitPrice,
        order.totalAmount,
        order.todayShipQty,
        order.shippedQty,
        order.remainQty,
        nullIfEmpty(order.materialDoneAt),
        order.orderTotalHours,
        nullIfEmpty(order.orderDate),
        nullIfEmpty(order.deliveryDate),
        order.remark,
        order.updatedAt,
        id,
      ],
    )
    res.json(await findOrder(id))
  } catch (err) {
    if (isDuplicate(err)) {
      fail(res, 400, '订单编号已存在')
      return
    }
    console.error('修改订单失败:', err)
    fail(res, 500, '修改失败')
  }
}

export async function deleteOrder(req: Request, res: Response) {
  const id = parseID(req, res)
  if (!id) return
  try {
    const result = await runner().run('DELETE FROM orders WHERE id = ?', [id])
    if (!result.changes) {
      fail(res, 404, '订单不存在')
      return
    }
    res.json({ message: '已删除' })
  } catch (err) {
    console.error('删除订单失败:', err)
    fail(res, 500, '删除失败')
  }
}

export async function batchDeleteOrders(req: Request, res: Response) {
  const body = req.body as { ids?: unknown } | undefined
  const ids = body && Array.isArray(body.ids) ? body.ids : null
  if (!ids) {
    fail(res, 400, '请求体不是合法的 JSON')
    return
  }
  if (ids.length === 0) {
    fail(res, 400, '请选择要删除的订单')
    return
  }
  if (ids.length > 200) {
    fail(res, 400, '一次最多删除 200 条')
    return
  }
  const marks = ids.map(() => '?').join(',')
  try {
    const result = await runner().run(
      'DELETE FROM orders WHERE id IN (' + marks + ')',
      ids.map(Number),
    )
    res.json({ deleted: result.changes })
  } catch (err) {
    console.error('批量删除失败:', err)
    fail(res, 500, '删除失败')
  }
}

// 只在空表时写入示例，避免每次重启都重复插入。
export async function seedIfEmpty() {
  if ((process.env.SEED || '1').trim() === '0') return
  const row = await runner().get('SELECT COUNT(*) AS total FROM orders')
  if (totalOf(row) > 0) return

  const samples: OrderDraft[] = [
    {
      orderNo: 'PO2026001',
      name: '春季连帽卫衣',
      alias: '卫衣-卡其',
      customerName: '杭州青禾服饰',
      customerAddress: '浙江省杭州市西湖区文三路 100 号',
      contactName: '王敏',
      contactPhone: '13800001111',
      productName: '连帽卫衣',
      styleNo: 'KH-2501',
      status: 'processing',
      orderQty: 1200,
      unitPrice: 45,
      todayShipQty: 200,
      shippedQty: 400,
      orderTotalHours: 96,
      materialDoneAt: '2026-03-18 18:00:00',
      orderDate: '2026-03-01',
      deliveryDate: '2026-04-15',
      remark: '先出卡其色',
      createdAt: '2026-03-01 09:12:00',
      updatedAt: '2026-03-20 16:40:00',
    },
    {
      orderNo: 'PO2026002',
      name: '夏季圆领T恤',
      alias: 'T恤-白',
      customerName: '上海南风制衣',
      customerAddress: '上海市静安区南京西路 88 号',
      contactName: '李强',
      contactPhone: '13900002222',
      productName: '圆领T恤',
      styleNo: 'TS-1008',
      status: 'pending',
      orderQty: 800,
      unitPrice: 22.5,
      todayShipQty: 0,
      shippedQty: 0,
      orderTotalHours: 48,
      orderDate: '2026-04-02',
      deliveryDate: '2026-05-10',
      remark: '等面料到仓',
      createdAt: '2026-04-02 11:05:00',
      updatedAt: '2026-04-02 11:05:00',
    },
    {
      orderNo: 'PO2026003',
      name: '直筒牛仔裤',
      alias: '牛仔-深蓝',
      customerName: '广州纬成商贸',
      customerAddress: '广东省广州市海珠区新港东路 66 号',
      contactName: '陈静',
      contactPhone: '13700003333',
      productName: '牛仔裤',
      styleNo: 'JN-331',
      status: 'partial_shipped',
      orderQty: 600,
      unitPrice: 68,
      todayShipQty: 80,
      shippedQty: 260,
      orderTotalHours: 120,
      materialDoneAt: '2026-02-28 17:30:00',
      orderDate: '2026-02-10',
      deliveryDate: '2026-04-01',
      remark: '剩余深色未洗水',
      createdAt: '2026-02-10 14:20:00',
      updatedAt: '2026-03-28 10:15:00',
    },
    {
      orderNo: 'PO2026004',
      name: '碎花连衣裙',
      alias: '连衣裙-红',
      customerName: '成都缓慢生活',
      customerAddress: '四川省成都市锦江区东大街 18 号',
      contactName: '赵雪',
      contactPhone: '13600004444',
      productName: '连衣裙',
      styleNo: 'LY-090',
      status: 'done',
      orderQty: 300,
      unitPrice: 89,
      todayShipQty: 0,
      shippedQty: 300,
      orderTotalHours: 72,
      materialDoneAt: '2026-01-20 12:00:00',
      orderDate: '2026-01-06',
      deliveryDate: '2026-02-20',
      remark: '已全部出货',
      createdAt: '2026-01-06 08:40:00',
      updatedAt: '2026-02-18 19:00:00',
    },
    {
      orderNo: 'PO2026005',
      name: '防风外套',
      alias: '外套-黑',
      customerName: '北京北窗零售',
      customerAddress: '北京市朝阳区酒仙桥路 4 号',
      contactName: '周凯',
      contactPhone: '13500005555',
      productName: '外套',
      styleNo: 'WT-17',
      status: 'cancelled',
      orderQty: 150,
      unitPrice: 120,
      todayShipQty: 0,
      shippedQty: 0,
      orderTotalHours: 0,
      orderDate: '2026-03-12',
      deliveryDate: '2026-04-30',
      remark: '客户取消',
      createdAt: '2026-03-12 15:33:00',
      updatedAt: '2026-03-15 09:08:00',
    },
    {
      orderNo: 'PO2026006',
      name: '工装长裤',
      alias: '工装-军绿',
      customerName: '苏州河工坊',
      customerAddress: '江苏省苏州市工业园区星湖街 328 号',
      contactName: '孙莉',
      contactPhone: '15800006666',
      productName: '工装裤',
      styleNo: 'GZ-662',
      status: 'processing',
      orderQty: 450,
      unitPrice: 76.8,
      todayShipQty: 40,
      shippedQty: 40,
      orderTotalHours: 80,
      orderDate: '2026-04-08',
      deliveryDate: '2026-05-28',
      remark: '口袋改成双层',
      createdAt: '2026-04-08 10:18:00',
      updatedAt: '2026-04-18 13:22:00',
    },
  ]

  const db = runner()
  for (const sample of samples) {
    normalize(sample)
    await insertOrder(db, sample)
  }
  console.log('已写入示例订单', samples.length, '条')
}
