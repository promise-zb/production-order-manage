<template>
  <div class="login-page">
    <el-card class="login-card" shadow="never">
      <h1>生产跟单管理</h1>
      <p class="hint">演示账号 admin / admin</p>
      <el-form
        ref="formRef"
        label-position="top"
        :model="form"
        :rules="rules"
        @submit.prevent="onSubmit"
      >
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" size="large" autocomplete="username" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input
            v-model="form.password"
            size="large"
            type="password"
            show-password
            autocomplete="current-password"
          />
        </el-form-item>
        <el-button
          type="primary"
          native-type="submit"
          size="large"
          class="submit"
          :loading="loading"
          >登录</el-button
        >
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, type FormInstance } from 'element-plus'
import { api } from '../../api'

const router = useRouter()
const formRef = ref<FormInstance>()
const loading = ref(false)
const form = reactive({ username: 'admin', password: 'admin' })
const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

async function onSubmit() {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  loading.value = true
  try {
    const data = await api.login(form)
    localStorage.setItem('token', data.token)
    localStorage.setItem('username', data.username)
    router.push('/')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '登录失败')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  /* 默认背景：浅灰底上两团淡蓝色，不依赖图片。 */
  background-color: #f5f5f5;
  background-image:
    radial-gradient(circle at 18% 16%, rgba(64, 158, 255, 0.22), transparent 36%),
    radial-gradient(circle at 86% 84%, rgba(64, 158, 255, 0.14), transparent 34%),
    linear-gradient(165deg, #f3f8ff 0%, #f5f5f5 52%, #eef2f6 100%);
}
.login-card {
  width: 400px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(64, 158, 255, 0.08);
}
h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  color: #303133;
}
.hint {
  margin: 8px 0 24px;
  color: #909399;
}
.submit {
  width: 100%;
}
</style>
