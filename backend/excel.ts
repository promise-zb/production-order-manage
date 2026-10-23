// 导入认这组表头。系统 ID、创建时间、修改时间只在导出里出现，导入时忽略。
import type { Request, Response } from 'express'
import ExcelJS from 'exceljs'
import { errorText, isDuplicate, mapOrder, runner, selectSQL, transaction } from './db.ts'
import { buildFilter, insertOrder, normalize, statusLabel } from './orders.ts'
import type { Order, OrderDraft } from './types.ts'

const sheetHeaders = [
  '订单编号',
  '名称',
  '别名',
  '客户名称',
  '客户地址',
  '联系人',
  '联系电话',
  '产品名称',
  '款号',
  '状态',
  '订单总数',
  '单个金额',
  '订单总金额',
  '当天出货数量',
  '累计已出货数量',
  '剩余未完成数量',
  '单个材料完成时间',
  '订单完成总时间(小时)',
  '下单日期',
  '交货日期',
  '备注',
]

function fail(res: Response, status: number, message: string) {
  res.status(status).json({ message })
}

function totalOf(row: unknown) {
  if (!row || typeof row !== 'object') return 0
  const data = row as Record<string, unknown>
  return Number(data.total || 0)
}

function cellText(cell: { value: unknown }) {
  const value = cell.value
  if (value == null) return ''
  if (value instanceof Date) {
    const pad = (n: number) => String(n).padStart(2, '0')
    return (
      value.getFullYear() +
      '-' +
      pad(value.getMonth() + 1) +
      '-' +
      pad(value.getDate()) +
      ' ' +
      pad(value.getHours()) +
      ':' +
      pad(value.getMinutes()) +
      ':' +
      pad(value.getSeconds())
    )
  }
  if (typeof value === 'object') {
    const objectValue = value as {
      text?: unknown
      result?: unknown
      richText?: { text?: string }[]
    }
    if (objectValue.text != null) return String(objectValue.text).trim()
    if (objectValue.result != null) return String(objectValue.result).trim()
    if (Array.isArray(objectValue.richText))
      return objectValue.richText
        .map((part) => part.text || '')
        .join('')
        .trim()
  }
  return String(value).trim()
}

async function writeBook(headers: string[], records: unknown[][]) {
  const book = new ExcelJS.Workbook()
  const sheet = book.addWorksheet('订单')
  const header = sheet.addRow(headers)
  header.font = { bold: true }
  for (const record of records) sheet.addRow(record)
  sheet.columns.forEach((column) => {
    column.width = 18
  })
  const buffer = await book.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

function sendExcel(res: Response, filename: string, buffer: Buffer) {
  res.setHeader('Content-Disposition', 'attachment; filename=' + filename)
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.send(buffer)
}

export async function downloadTemplate(req: Request, res: Response) {
  const example = [
    'PO-TEMPLATE-001',
    '模板示例-夏季T恤',
    'T恤-白',
    '上海示例服饰',
    '上海市静安区示例路 1 号',
    '李四',
    '13900002222',
    '圆领T恤',
    'TS-1001',
    '待生产',
    500,
    22.5,
    11250,
    0,
    0,
    500,
    '2026-05-01 12:00:00',
    48,
    '2026-04-01',
    '2026-05-20',
    '这是模板示例，导入后可以删除',
  ]
  try {
    const buffer = await writeBook(sheetHeaders, [example])
    sendExcel(res, 'orders-template.xlsx', buffer)
  } catch (err) {
    console.error('生成模板失败:', err)
    fail(res, 500, '生成模板失败')
  }
}

async function ordersForExport(req: Request, res: Response) {
  const idText = String(req.query.ids || '').trim()
  let where = ''
  let args: unknown[] = []
  if (idText) {
    const parts = idText.split(',')
    if (parts.length > 500) {
      fail(res, 400, '一次最多导出 500 条')
      return null
    }
    const marks = []
    args = []
    for (const part of parts) {
      const id = Number(part.trim())
      if (!Number.isInteger(id) || id <= 0) continue
      marks.push('?')
      args.push(id)
    }
    if (args.length === 0) {
      fail(res, 400, '请选择要导出的订单')
      return null
    }
    where = 'WHERE id IN (' + marks.join(',') + ')'
  } else {
    try {
      const filter = buildFilter(req.query.keyword, req.query.status)
      where = filter.where
      args = filter.args
    } catch (err) {
      fail(res, 400, errorText(err))
      return null
    }
    const countRow = await runner().get('SELECT COUNT(*) AS total FROM orders ' + where, args)
    if (totalOf(countRow) > 5000) {
      fail(res, 400, '筛选结果超过 5000 条，请缩小范围再导出')
      return null
    }
  }
  const rows = await runner().all(
    selectSQL + ' ' + where + ' ORDER BY updated_at DESC, id DESC',
    args,
  )
  return rows.map(mapOrder).filter((order): order is Order => order != null)
}

export async function exportOrders(req: Request, res: Response) {
  const headers = ['系统ID', ...sheetHeaders, '创建时间', '修改时间']
  let orders: Order[] | null
  try {
    orders = await ordersForExport(req, res)
  } catch (err) {
    console.error('导出失败:', err)
    fail(res, 500, '导出失败')
    return
  }
  if (!orders) return
  const records = orders.map((order) => [
    order.id,
    order.orderNo,
    order.name,
    order.alias,
    order.customerName,
    order.customerAddress,
    order.contactName,
    order.contactPhone,
    order.productName,
    order.styleNo,
    statusLabel(order.status),
    order.orderQty,
    order.unitPrice,
    order.totalAmount,
    order.todayShipQty,
    order.shippedQty,
    order.remainQty,
    order.materialDoneAt,
    order.orderTotalHours,
    order.orderDate,
    order.deliveryDate,
    order.remark,
    order.createdAt,
    order.updatedAt,
  ])
  try {
    const buffer = await writeBook(headers, records)
    sendExcel(res, 'orders.xlsx', buffer)
  } catch (err) {
    console.error('导出失败:', err)
    fail(res, 500, '导出失败')
  }
}

function cell(row: string[], index: Record<string, number>, name: string) {
  const i = index[name]
  if (i == null || i >= row.length) return ''
  return String(row[i] || '').trim()
}

function rowEmpty(row: string[]) {
  return row.every((item) => String(item || '').trim() === '')
}

function parseFloatCell(value: unknown) {
  let text = String(value || '').trim()
  text = text.replace(/小时$/, '').replace(/,/g, '')
  if (text === '') return 0
  const n = Number(text)
  if (!Number.isFinite(n)) throw new Error('不是数字')
  return n
}

function parseIntCell(value: unknown) {
  return Math.round(parseFloatCell(value))
}

// Excel 有时会把长数字写成科学计数法，电话号码需要还原成整数文本。
function cleanText(value: unknown) {
  const text = String(value || '').trim()
  if (text === '') return ''
  if (text.includes('.') || /e/i.test(text)) {
    const n = Number(text)
    if (Number.isFinite(n) && n === Math.trunc(n) && Math.abs(n) >= 100000) {
      return n.toFixed(0)
    }
  }
  return text
}

function excelSerialToDate(serial: number) {
  const utc = Math.round((serial - 25569) * 86400 * 1000)
  const date = new Date(utc)
  if (Number.isNaN(date.getTime())) return null
  return date
}

function parseExcelTime(value: unknown, withTime: boolean) {
  const text = String(value || '').trim()
  if (text === '') return ''
  let date: Date | null = null
  const match = text.match(
    /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  )
  if (match) {
    const year = Number(match[1])
    const month = Number(match[2])
    const day = Number(match[3])
    date = new Date(
      year,
      month - 1,
      day,
      Number(match[4] || 0),
      Number(match[5] || 0),
      Number(match[6] || 0),
    )
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day)
      date = null
  }
  if (!date) {
    const serial = Number(text)
    if (text !== '' && Number.isFinite(serial) && serial > 20000 && serial < 80000) {
      date = excelSerialToDate(serial)
    }
  }
  if (!date) throw new Error(withTime ? '无法识别时间 ' + text : '无法识别日期 ' + text)
  const pad = (n: number) => String(n).padStart(2, '0')
  const day = date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate())
  if (!withTime) return day
  return (
    day + ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes()) + ':' + pad(date.getSeconds())
  )
}

function orderFromCells(row: string[], index: Record<string, number>): OrderDraft {
  const order: OrderDraft = {
    orderNo: cleanText(cell(row, index, '订单编号')),
    name: cell(row, index, '名称'),
    alias: cell(row, index, '别名'),
    customerName: cell(row, index, '客户名称'),
    customerAddress: cell(row, index, '客户地址'),
    contactName: cell(row, index, '联系人'),
    contactPhone: cleanText(cell(row, index, '联系电话')),
    productName: cell(row, index, '产品名称'),
    styleNo: cleanText(cell(row, index, '款号')),
    status: cell(row, index, '状态'),
    remark: cell(row, index, '备注'),
  }
  try {
    order.orderQty = parseIntCell(cell(row, index, '订单总数'))
  } catch {
    throw new Error('订单总数不是数字')
  }
  try {
    order.unitPrice = parseFloatCell(cell(row, index, '单个金额'))
  } catch {
    throw new Error('单个金额不是数字')
  }
  try {
    order.todayShipQty = parseIntCell(cell(row, index, '当天出货数量'))
  } catch {
    throw new Error('当天出货数量不是数字')
  }
  try {
    order.shippedQty = parseIntCell(cell(row, index, '累计已出货数量'))
  } catch {
    throw new Error('累计已出货数量不是数字')
  }
  try {
    order.orderTotalHours = parseFloatCell(cell(row, index, '订单完成总时间(小时)'))
  } catch {
    throw new Error('订单完成总时间不是数字')
  }
  order.materialDoneAt = parseExcelTime(cell(row, index, '单个材料完成时间'), true)
  order.orderDate = parseExcelTime(cell(row, index, '下单日期'), false)
  order.deliveryDate = parseExcelTime(cell(row, index, '交货日期'), false)
  return order
}

async function readSheet(buffer: Uint8Array) {
  const book = new ExcelJS.Workbook()
  // exceljs 的类型还按旧 Buffer 声明，和当前 Node 的 Buffer 对不上，这里按它的入参收。
  await book.xlsx.load(buffer as unknown as Parameters<ExcelJS.Xlsx['load']>[0])
  const sheet = book.worksheets[0]
  if (!sheet) return []
  const rows: string[][] = []
  for (let r = 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r)
    const width = Math.max(row.cellCount, sheetHeaders.length)
    const values = []
    for (let c = 1; c <= width; c++) values.push(cellText(row.getCell(c)))
    rows.push(values)
  }
  return rows
}

class ImportStop extends Error {
  expose: boolean
  constructor(message: string, expose: boolean) {
    super(message)
    this.expose = expose
  }
}

export async function importOrders(req: Request, res: Response) {
  const file = req.file
  if (!file) {
    fail(res, 400, '请上传文件，字段名是 file')
    return
  }
  if (
    !String(file.originalname || '')
      .toLowerCase()
      .endsWith('.xlsx')
  ) {
    fail(res, 400, '请上传 .xlsx 文件')
    return
  }
  let rows: string[][]
  try {
    rows = await readSheet(file.buffer)
  } catch (err) {
    console.error('解析 Excel 失败:', err)
    fail(res, 400, '无法解析这个 Excel，请使用 .xlsx')
    return
  }
  if (rows.length === 0) {
    fail(res, 400, 'Excel 里没有数据')
    return
  }
  const index: Record<string, number> = {}
  rows[0].forEach((head, i) => {
    const name = String(head || '').trim()
    if (name) index[name] = i
  })
  if (index['名称'] == null) {
    fail(res, 400, '表头缺少「名称」列，请先下载模板')
    return
  }

  let inserted = 0
  const errors: string[] = []
  try {
    await transaction(async (tx) => {
      for (let i = 1; i < rows.length; i++) {
        if (rowEmpty(rows[i])) continue
        try {
          const order = orderFromCells(rows[i], index)
          normalize(order)
          await insertOrder(tx, order)
          inserted += 1
        } catch (err) {
          const message = errorText(err)
          const rowProblem =
            isDuplicate(err) ||
            /不是数字|不能|过长|格式应为|无法识别|状态不正确|名称不能为空/.test(message)
          if (!rowProblem) throw err
          if (errors.length < 50) {
            errors.push('第 ' + (i + 1) + ' 行：' + (isDuplicate(err) ? '订单编号已存在' : message))
          }
        }
      }
      if (inserted === 0) {
        throw new ImportStop(
          errors.length === 0 ? '没有读到数据，请从第 2 行开始填写' : 'no-commit',
          errors.length === 0,
        )
      }
    })
  } catch (err) {
    if (err instanceof ImportStop && err.expose) {
      fail(res, 400, err.message)
      return
    }
    if (err instanceof ImportStop && err.message === 'no-commit') {
      res.json({ inserted: 0, errors })
      return
    }
    console.error('导入失败:', err)
    fail(res, 500, '导入失败')
    return
  }
  res.json({ inserted, errors })
}
