import { createRouter, createWebHistory } from 'vue-router'
import Layout from '../layout/index.vue'
import Login from '../views/login/index.vue'
import OrderPage from '../views/order/index.vue'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    menu?: boolean
  }
}

// 登录页单独放。其余页面都挂在布局下面。
// 加新页面时，在 children 里加一项。meta.menu 为 true 时，左侧菜单会多出这一项。
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: Login },
    {
      path: '/',
      component: Layout,
      redirect: '/orders',
      children: [
        {
          path: '/orders',
          name: 'orders',
          component: OrderPage,
          meta: { title: '订单列表', menu: true },
        },
      ],
    },
  ],
})

// 没有令牌就去登录页。令牌只是放在浏览器本地，用来带给后端。
router.beforeEach((to) => {
  const token = localStorage.getItem('token')
  if (to.path !== '/login' && !token) return '/login'
  if (to.path === '/login' && token) return '/orders'
})

export default router
