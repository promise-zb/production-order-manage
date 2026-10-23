import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'
import router from './router'

// 整包引入 Element Plus，演示项目少写按需加载的配置。中文在 App.vue 里设置。
createApp(App).use(router).use(ElementPlus).mount('#app')
