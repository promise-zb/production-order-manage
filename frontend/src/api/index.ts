// 页面只从这里发请求。具体路径和类型由 backend/openapi.yaml 生成，在 generated 目录里。
import axios from 'axios'
import { openApiHttpClient, OpenApiOpenapi } from './generated/openapi-gen'
import type { OrderInput, OrderStatus } from './generated/openapi-gen/types'

export type {
  BatchDeleteResult,
  ImportResult,
  LoginResult,
  Order,
  OrderInput,
  OrderPage,
  OrderStatus,
} from './generated/openapi-gen/types'

const sdk = OpenApiOpenapi({
  // 为空时走当前域名，本地由 Vite 转到 8080。线上填 VITE_API_BASE。
  BASE: import.meta.env.VITE_API_BASE || '',
  token: () => localStorage.getItem('token') ?? '',
})

async function errorMessage(error: unknown) {
  if (!axios.isAxiosError(error)) return error instanceof Error ? error.message : '请求失败'
  const data = error.response?.data
  if (data instanceof Blob) {
    try {
      const text = JSON.parse(await data.text()) as { message?: string }
      if (text.message) return text.message
    } catch {
      // 文件接口失败时，响应体不一定是 JSON。
    }
  }
  if (data && typeof data === 'object' && 'message' in data && typeof data.message === 'string') {
    return data.message
  }
  return '请求失败'
}

openApiHttpClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const url = error.config?.url || ''
      if (!url.includes('/api/login')) {
        localStorage.removeItem('token')
        localStorage.removeItem('username')
        if (location.pathname !== '/login') location.assign('/login')
      }
    }
    return Promise.reject(new Error(await errorMessage(error)))
  },
)

async function unwrap<T>(request: Promise<{ data: T }>) {
  const result = await request
  return result.data
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export const api = {
  login(body: { username: string; password: string }) {
    return unwrap(sdk.login({ body, throwOnError: true }))
  },
  listOrders(query: { page: number; pageSize: number; keyword?: string; status?: OrderStatus }) {
    return unwrap(
      sdk.listOrders({
        query: {
          page: query.page,
          pageSize: query.pageSize,
          keyword: query.keyword || undefined,
          status: query.status,
        },
        throwOnError: true,
      }),
    )
  },
  getOrder(id: number) {
    return unwrap(sdk.getOrder({ path: { id }, throwOnError: true }))
  },
  createOrder(body: OrderInput) {
    return unwrap(sdk.createOrder({ body, throwOnError: true }))
  },
  updateOrder(id: number, body: OrderInput) {
    return unwrap(sdk.updateOrder({ path: { id }, body, throwOnError: true }))
  },
  deleteOrder(id: number) {
    return unwrap(sdk.deleteOrder({ path: { id }, throwOnError: true }))
  },
  batchDeleteOrders(ids: number[]) {
    return unwrap(sdk.batchDeleteOrders({ body: { ids }, throwOnError: true }))
  },
  importOrders(file: File) {
    return unwrap(sdk.importOrders({ body: { file }, throwOnError: true }))
  },
  async exportOrders(
    query: {
      ids?: string
      keyword?: string
      status?: OrderStatus
    },
    filename: string,
  ) {
    const data = await unwrap(sdk.exportOrders({ query, throwOnError: true }))
    if (!(data instanceof Blob)) throw new Error('导出失败')
    saveBlob(data, filename)
  },
  async downloadOrderTemplate() {
    const data = await unwrap(sdk.downloadOrderTemplate({ throwOnError: true }))
    if (!(data instanceof Blob)) throw new Error('下载失败')
    saveBlob(data, '订单导入模板.xlsx')
  },
}
