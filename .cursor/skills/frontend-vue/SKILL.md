---
name: frontend-vue
description: >-
  本仓库前端页面和组件的写法。使用 Element Plus，单个 Vue 文件尽量不超过 400 行，
  并按实际界面块拆到 components/xxx/index.vue。
  在新增或修改 frontend 下的 Vue、页面、布局、弹窗、表格时使用。
---

# 前端组件

改 `frontend/` 里的页面或组件时遵守下面两条。

## 只用 Element Plus

- UI 组件只用 `element-plus`。不要再引入 Ant Design Vue 或其他组件库。
- 中文已经在 `frontend/src/App.vue` 用 `el-config-provider` 和 `zhCn` 设置，新页面不要再包一层。
- 交互用现有组件：表格 `el-table`，表单 `el-form`，弹窗 `el-dialog`，详情 `el-drawer`，页签 `el-tabs`，按钮 `el-button`，分页 `el-pagination`。

## 单个 Vue 文件尽量不超过 400 行

行数按文件实际内容算，包含 `<template>`、`<script>` 和 `<style>`。

快到 400 行或已经超过时，按屏幕上真实的一块界面拆，不要为了行数拆成没有界面的空壳。订单页的拆法就是标准：

- 页面留在 `views/<page>/index.vue`，只放数据加载和操作流程。
- 一块界面一个目录：`views/<page>/components/<Name>/index.vue`。
- 这块界面的样式放同目录 `index.less`，在 Vue 里用 `<style scoped lang="less" src="./index.less">`。
- 这块页面专用的函数放 `views/<page>/utils.ts`，表格列、表单这类类型放 `views/<page>/types.ts`。

订单页现在的块是：`OrderToolbar`、`OrderTable`、`OrderFormDialog`、`OrderDetailDrawer`。新页面有同样的工具栏、表格、弹窗、抽屉时，按这个粒度拆。
