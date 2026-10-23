<template>
  <el-dialog v-model="open" :title="editing ? '修改订单' : '新增订单'" width="880px">
    <div class="dialog-body">
      <el-form ref="formRef" label-position="top" :model="form">
        <el-divider content-position="left">基本信息</el-divider>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="订单编号">
              <el-input v-model="form.orderNo" />
              <div class="field-extra">留空时由系统生成</div>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="状态">
              <el-select v-model="form.status" style="width: 100%">
                <el-option
                  v-for="item in statusOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item
              label="名称"
              prop="name"
              :rules="[{ required: true, message: '请填写名称', trigger: 'blur' }]"
            >
              <el-input v-model="form.name" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="别名">
              <el-input v-model="form.alias" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="客户名称">
              <el-input v-model="form.customerName" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="联系人">
              <el-input v-model="form.contactName" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="联系电话">
              <el-input v-model="form.contactPhone" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="产品名称">
              <el-input v-model="form.productName" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="款号">
              <el-input v-model="form.styleNo" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="客户地址">
              <el-input v-model="form.customerAddress" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-divider content-position="left">数量和金额</el-divider>
        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="订单总数">
              <el-input-number
                v-model="form.orderQty"
                :min="0"
                :precision="0"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="单个金额">
              <el-input-number
                v-model="form.unitPrice"
                :min="0"
                :precision="2"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="订单总金额">
              <el-input-number :model-value="totalPreview" disabled style="width: 100%" />
              <div class="field-extra">保存时按 单个金额 × 订单总数 计算</div>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="当天出货数量">
              <el-input-number
                v-model="form.todayShipQty"
                :min="0"
                :precision="0"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="累计已出货数量">
              <el-input-number
                v-model="form.shippedQty"
                :min="0"
                :precision="0"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="剩余未完成数量">
              <el-input-number :model-value="remainPreview" disabled style="width: 100%" />
              <div class="field-extra">保存时按 订单总数 - 累计已出货 计算</div>
            </el-form-item>
          </el-col>
        </el-row>

        <el-divider content-position="left">时间</el-divider>
        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="单个材料完成时间">
              <el-date-picker
                v-model="form.materialDoneAt"
                type="datetime"
                value-format="YYYY-MM-DD HH:mm:ss"
                style="width: 100%"
                placeholder="选择时间"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="订单完成总时间（小时）">
              <el-input-number
                v-model="form.orderTotalHours"
                :min="0"
                :precision="2"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="下单日期">
              <el-date-picker
                v-model="form.orderDate"
                type="date"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="交货日期">
              <el-date-picker
                v-model="form.deliveryDate"
                type="date"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="16">
            <el-form-item label="备注">
              <el-input v-model="form.remark" type="textarea" :rows="2" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </div>
    <template #footer>
      <el-button @click="open = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="onSave">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { FormInstance } from 'element-plus'
import type { OrderForm } from '../../types'
import { statusOptions } from '../../utils'

const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  editing: boolean
  saving: boolean
  form: OrderForm
}>()

const emit = defineEmits<{
  submit: []
}>()

const formRef = ref<FormInstance>()
const totalPreview = computed(() =>
  Number((Number(props.form.unitPrice || 0) * Number(props.form.orderQty || 0)).toFixed(2)),
)
const remainPreview = computed(() =>
  Math.max(Number(props.form.orderQty || 0) - Number(props.form.shippedQty || 0), 0),
)

watch(open, (value) => {
  if (value) nextTick(() => formRef.value?.clearValidate())
})

async function onSave() {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  emit('submit')
}
</script>

<style scoped lang="less" src="./index.less"></style>
