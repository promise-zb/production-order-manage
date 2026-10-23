import { defineConfig } from 'openapi-axios-sdk/config'

// 接口说明在 backend/openapi.yaml。生成结果给前端 src/api 使用。
// 这个命令在仓库根目录执行，因为生成器要用 TypeScript 5，页面本身仍用 TypeScript 7。
export default defineConfig({
  apiDir: 'backend',
  outDir: 'frontend/src/api/generated',
})
