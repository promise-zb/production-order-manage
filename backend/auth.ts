// 登录成功后发一枚令牌。令牌里带着用户名和过期时间，并用密钥签名。
// 服务器不用单独记会话，重启也不会把已登录的人踢掉，直到令牌过期。
import crypto from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'
import { env } from './db.ts'

const DAY = 24 * 60 * 60

function secret() {
  return env('AUTH_SECRET', 'dev-only-change-me')
}

function sameText(got: string, want: string) {
  const a = Buffer.from(got)
  const b = Buffer.from(want)
  if (a.length !== b.length) {
    crypto.timingSafeEqual(a, a)
    return false
  }
  return crypto.timingSafeEqual(a, b)
}

export function signToken(username: string) {
  const exp = Math.floor(Date.now() / 1000) + DAY
  const payload = username + '|' + exp
  const sig = crypto.createHmac('sha256', secret()).update(payload).digest('hex')
  return Buffer.from(payload).toString('base64url') + '.' + sig
}

export function parseToken(token: string) {
  const parts = String(token || '').split('.')
  if (parts.length !== 2) return ''
  let payload = ''
  try {
    payload = Buffer.from(parts[0], 'base64url').toString('utf8')
  } catch {
    return ''
  }
  const expected = crypto.createHmac('sha256', secret()).update(payload).digest('hex')
  if (!sameText(expected, parts[1])) return ''
  const segs = payload.split('|')
  if (segs.length !== 2) return ''
  const exp = Number(segs[1])
  if (!Number.isFinite(exp) || Math.floor(Date.now() / 1000) > exp) return ''
  return segs[0]
}

export function login(req: Request, res: Response) {
  const body = (req.body || {}) as { username?: unknown; password?: unknown }
  const user = env('ADMIN_USER', 'admin')
  const pass = env('ADMIN_PASSWORD', 'admin')
  if (
    !sameText(String(body.username || ''), user) ||
    !sameText(String(body.password || ''), pass)
  ) {
    res.status(401).json({ message: '用户名或密码错误' })
    return
  }
  res.json({ token: signToken(user), username: user })
}

export function authRequired(req: Request, res: Response, next: NextFunction) {
  const header = req.get('Authorization') || ''
  const prefix = 'Bearer '
  if (!header.startsWith(prefix)) {
    res.status(401).json({ message: '请先登录' })
    return
  }
  if (!parseToken(header.slice(prefix.length))) {
    res.status(401).json({ message: '登录已失效，请重新登录' })
    return
  }
  next()
}
