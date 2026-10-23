<template>
  <el-drawer v-model="open" title="订单详情" size="520px" destroy-on-close>
    <div v-loading="loading" class="detail-body">
      <el-descriptions v-if="fields.length" border :column="1" size="small">
        <el-descriptions-item v-for="item in fields" :key="item.label" :label="item.label">
          {{ item.value }}
        </el-descriptions-item>
      </el-descriptions>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import type { DetailField } from '../../types'

const open = defineModel<boolean>('open', { required: true })

defineProps<{
  loading: boolean
  fields: DetailField[]
}>()
</script>

<style scoped lang="less" src="./index.less"></style>
