// 数据库同时支持两种库。没填 DATABASE_URL 时用本机 SQLite，填了就用 PostgreSQL。
// SQL 里统一写 ?，发给 PostgreSQL 之前再换成 $1、$2。
import fs from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import pg from 'pg'
import type { Order, QueryRunner } from './types.ts'

const timeLayout = 'YYYY-MM-DD HH:mm:ss'

export function env(key: string, fallback = '') {
  const value = (process.env[key] || '').trim()
  return value === '' ? fallback : value
}

export function errorText(err: unknown) {
  return err instanceof Error ? err.message : ''
}

let driver = 'sqlite'
let sqlite: DatabaseSync | null = null
let pool: pg.Pool | null = null

export function dbDriver() {
  return driver
}

// 把 ? 换成 PostgreSQL 的 $1、$2。SQLite 原样返回。
export function q(query: string) {
  if (driver !== 'postgres') return query
  let n = 1
  return query.replace(/\?/g, () => '$' + n++)
}

interface Statement {
  get(...params: unknown[]): unknown
  all(...params: unknown[]): unknown[]
  run(...params: unknown[]): { lastInsertRowid?: number | bigint; changes?: number | bigint }
}

function sqliteRunner(database: DatabaseSync): QueryRunner {
  return {
    async get(sql, params = []) {
      return (database.prepare(q(sql)) as Statement).get(...params)
    },
    async all(sql, params = []) {
      return (database.prepare(q(sql)) as Statement).all(...params)
    },
    async run(sql, params = []) {
      const result = (database.prepare(q(sql)) as Statement).run(...params)
      return {
        lastInsertRowid: Number(result.lastInsertRowid || 0),
        changes: Number(result.changes || 0),
      }
    },
  }
}

function pgRunner(client: {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number | null }>
}): QueryRunner {
  return {
    async get(sql, params = []) {
      const result = await client.query(q(sql), params)
      return result.rows[0]
    },
    async all(sql, params = []) {
      const result = await client.query(q(sql), params)
      return result.rows
    },
    async run(sql, params = []) {
      const result = await client.query(q(sql), params)
      const row = result.rows[0] as { id?: unknown } | undefined
      const id = row && row.id
      return {
        lastInsertRowid: id == null ? 0 : Number(id),
        changes: result.rowCount || 0,
      }
    },
  }
}

function requireSqlite() {
  if (!sqlite) throw new Error('SQLite 未打开')
  return sqlite
}

function requirePool() {
  if (!pool) throw new Error('PostgreSQL 未连接')
  return pool
}

export function runner() {
  if (driver === 'postgres') return pgRunner(requirePool())
  return sqliteRunner(requireSqlite())
}

// 导入时多行要么一起成功，要么一起撤回。fn 里要用传入的 tx，不要用外面的 runner()。
export async function transaction<T>(fn: (tx: QueryRunner) => Promise<T>) {
  if (driver === 'postgres') {
    const client = await requirePool().connect()
    try {
      await client.query('BEGIN')
      const result = await fn(pgRunner(client))
      await client.query('COMMIT')
      return result
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  }
  const database = requireSqlite()
  database.exec('BEGIN')
  try {
    const result = await fn(sqliteRunner(database))
    database.exec('COMMIT')
    return result
  } catch (err) {
    database.exec('ROLLBACK')
    throw err
  }
}

export async function openDB() {
  const dsn = env('DATABASE_URL')
  if (dsn) {
    driver = 'postgres'
    pool = new pg.Pool({ connectionString: dsn, max: 5 })
    await pool.query('SELECT 1')
    console.log('当前数据库: PostgreSQL')
    return
  }

  driver = 'sqlite'
  const path = env('DB_PATH', 'data/orders.db')
  try {
    fs.mkdirSync('data', { recursive: true })
    sqlite = new DatabaseSync(path)
    console.log('当前数据库: SQLite', path)
  } catch (err) {
    // 有的托管环境不能写文件。这时先用内存库把接口跑起来，数据不保留。
    console.log('SQLite 文件不可写，改用内存数据库:', errorText(err))
    sqlite = new DatabaseSync(':memory:')
  }
  requireSqlite().exec('PRAGMA busy_timeout = 5000')
}

export async function migrate() {
  const sql =
    driver === 'postgres'
      ? `CREATE TABLE IF NOT EXISTS orders (
        id BIGSERIAL PRIMARY KEY,
        order_no TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        alias TEXT NOT NULL DEFAULT '',
        customer_name TEXT NOT NULL DEFAULT '',
        customer_address TEXT NOT NULL DEFAULT '',
        contact_name TEXT NOT NULL DEFAULT '',
        contact_phone TEXT NOT NULL DEFAULT '',
        product_name TEXT NOT NULL DEFAULT '',
        style_no TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending',
        order_qty INTEGER NOT NULL DEFAULT 0,
        unit_price DOUBLE PRECISION NOT NULL DEFAULT 0,
        total_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
        today_ship_qty INTEGER NOT NULL DEFAULT 0,
        shipped_qty INTEGER NOT NULL DEFAULT 0,
        remain_qty INTEGER NOT NULL DEFAULT 0,
        material_done_at TEXT,
        order_total_hours DOUBLE PRECISION NOT NULL DEFAULT 0,
        order_date TEXT,
        delivery_date TEXT,
        remark TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`
      : `CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_no TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        alias TEXT NOT NULL DEFAULT '',
        customer_name TEXT NOT NULL DEFAULT '',
        customer_address TEXT NOT NULL DEFAULT '',
        contact_name TEXT NOT NULL DEFAULT '',
        contact_phone TEXT NOT NULL DEFAULT '',
        product_name TEXT NOT NULL DEFAULT '',
        style_no TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending',
        order_qty INTEGER NOT NULL DEFAULT 0,
        unit_price REAL NOT NULL DEFAULT 0,
        total_amount REAL NOT NULL DEFAULT 0,
        today_ship_qty INTEGER NOT NULL DEFAULT 0,
        shipped_qty INTEGER NOT NULL DEFAULT 0,
        remain_qty INTEGER NOT NULL DEFAULT 0,
        material_done_at TEXT,
        order_total_hours REAL NOT NULL DEFAULT 0,
        order_date TEXT,
        delivery_date TEXT,
        remark TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`
  if (driver === 'postgres') await requirePool().query(sql)
  else requireSqlite().exec(sql)
}

const selectSQL = `SELECT id,
  order_no AS "orderNo", name, alias,
  customer_name AS "customerName", customer_address AS "customerAddress",
  contact_name AS "contactName", contact_phone AS "contactPhone",
  product_name AS "productName", style_no AS "styleNo", status,
  order_qty AS "orderQty", unit_price AS "unitPrice", total_amount AS "totalAmount",
  today_ship_qty AS "todayShipQty", shipped_qty AS "shippedQty", remain_qty AS "remainQty",
  material_done_at AS "materialDoneAt", order_total_hours AS "orderTotalHours",
  order_date AS "orderDate", delivery_date AS "deliveryDate",
  remark, created_at AS "createdAt", updated_at AS "updatedAt"
  FROM orders`

export { selectSQL, timeLayout }

export function text(value: unknown) {
  return value == null ? '' : String(value)
}

export function round2(value: unknown) {
  return Math.round(Number(value || 0) * 100) / 100
}

export function mapOrder(row: unknown): Order | null {
  if (!row || typeof row !== 'object') return null
  const data = row as Record<string, unknown>
  return {
    id: Number(data.id),
    orderNo: text(data.orderNo),
    name: text(data.name),
    alias: text(data.alias),
    customerName: text(data.customerName),
    customerAddress: text(data.customerAddress),
    contactName: text(data.contactName),
    contactPhone: text(data.contactPhone),
    productName: text(data.productName),
    styleNo: text(data.styleNo),
    status: text(data.status),
    orderQty: Number(data.orderQty || 0),
    unitPrice: round2(data.unitPrice),
    totalAmount: round2(data.totalAmount),
    todayShipQty: Number(data.todayShipQty || 0),
    shippedQty: Number(data.shippedQty || 0),
    remainQty: Number(data.remainQty || 0),
    materialDoneAt: text(data.materialDoneAt),
    orderTotalHours: round2(data.orderTotalHours),
    orderDate: text(data.orderDate),
    deliveryDate: text(data.deliveryDate),
    remark: text(data.remark),
    createdAt: text(data.createdAt),
    updatedAt: text(data.updatedAt),
  }
}

export function isDuplicate(err: unknown) {
  if (!err || typeof err !== 'object') return false
  const error = err as { code?: string; message?: string }
  if (error.code === '23505') return true
  return /unique|duplicate/i.test(error.message || '')
}

export function pad(n: number) {
  return String(n).padStart(2, '0')
}

export function formatDateTime(date: Date) {
  return (
    date.getFullYear() +
    '-' +
    pad(date.getMonth() + 1) +
    '-' +
    pad(date.getDate()) +
    ' ' +
    pad(date.getHours()) +
    ':' +
    pad(date.getMinutes()) +
    ':' +
    pad(date.getSeconds())
  )
}

export function formatDate(date: Date) {
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate())
}

export function formatCompact(date: Date) {
  return (
    String(date.getFullYear()) +
    pad(date.getMonth() + 1) +
    pad(date.getDate()) +
    pad(date.getHours()) +
    pad(date.getMinutes()) +
    pad(date.getSeconds())
  )
}
