# 生产跟单管理

前后端分开放：

- `frontend`：Vue 3 + TypeScript + Element Plus（浅色主题）
- `backend`：Node.js + TypeScript + Express，默认用本机 SQLite，配上连接串后改用 PostgreSQL

在仓库根目录安装并启动：

```bash
pnpm install
pnpm dev
```

`pnpm install` 会安装前端和接口的依赖。`pnpm dev` 会同时启动接口和页面。浏览器打开 http://localhost:5173 ，账号 `admin` / `admin`。

需要你去 Deno、Netlify 上操作的步骤，以及建表 SQL，写在 [docs/需要你配合的事项.md](docs/需要你配合的事项.md)。
