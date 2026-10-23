// 程序入口。页面通过 /api 访问这里。
import fs from 'node:fs'
import express from 'express'
import type { NextFunction, Request, Response } from 'express'
import multer from 'multer'
import { authRequired, login } from './auth.ts'
import { dbDriver, env, errorText, migrate, openDB } from './db.ts'
import { downloadTemplate, exportOrders, importOrders } from './excel.ts'
import {
  batchDeleteOrders,
  createOrder,
  deleteOrder,
  getOrder,
  listOrders,
  seedIfEmpty,
  updateOrder,
} from './orders.ts'

// 只在环境变量还没设置时，才用 .env 里的值。
function loadDotEnv(path: string) {
  if (!fs.existsSync(path)) return
  const text = fs.readFileSync(path, 'utf8')
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (trimmed === '' || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

function wrap(fn: (req: Request, res: Response, next: NextFunction) => unknown) {
  return (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next)
}

function cors(req: Request, res: Response, next: NextFunction) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  if (req.method === 'OPTIONS') {
    res.sendStatus(204)
    return
  }
  next()
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
})

loadDotEnv('.env')
await openDB()
await migrate()
await seedIfEmpty()

const app = express()
app.disable('x-powered-by')
app.use(cors)
app.use(express.json())

app.get('/api/health', (req, res) => {
  res.json({ ok: true, driver: dbDriver() })
})
// 接口说明。前端用这份 YAML 生成 src/api 里的请求代码。
app.get('/api/openapi.yaml', (req, res) => {
  res.type('application/yaml')
  res.send(fs.readFileSync(new URL('./openapi.yaml', import.meta.url)))
})
app.post('/api/login', wrap(login))

// 下面这些接口都要先登录。固定路径写在 /orders/:id 前面，避免 export 被当成 id。
app.get('/api/orders', authRequired, wrap(listOrders))
app.post('/api/orders', authRequired, wrap(createOrder))
app.get('/api/orders/export', authRequired, wrap(exportOrders))
app.get('/api/orders/template', authRequired, wrap(downloadTemplate))
app.post('/api/orders/import', authRequired, upload.single('file'), wrap(importOrders))
app.post('/api/orders/batch-delete', authRequired, wrap(batchDeleteOrders))
app.get('/api/orders/:id', authRequired, wrap(getOrder))
app.put('/api/orders/:id', authRequired, wrap(updateOrder))
app.delete('/api/orders/:id', authRequired, wrap(deleteOrder))

app.use('/api', (req, res) => {
  res.status(404).json({ message: '接口不存在' })
})

app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    next(err)
    return
  }
  const error = err as { type?: string; code?: string }
  if (err && (error.type === 'entity.parse.failed' || err instanceof SyntaxError)) {
    res.status(400).json({ message: '请求体不是合法的 JSON' })
    return
  }
  if (error.code === 'LIMIT_FILE_SIZE') {
    res.status(400).json({ message: '文件不能超过 5MB' })
    return
  }
  console.error(errorText(err) || err)
  res.status(500).json({ message: '服务器错误' })
})

const port = env('PORT', '8080')
app.listen(port, () => {
  console.log('服务已启动: http://127.0.0.1:' + port)
})
