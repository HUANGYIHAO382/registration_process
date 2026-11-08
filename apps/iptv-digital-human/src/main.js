/**
 * 应用入口
 * Vue3 Composition API；不引入 vue-router / Pinia（按工程规范，单页状态机足够）
 */
import { createApp } from 'vue'
import App from './App.vue'
import './styles/theme.css'
import './styles/stage.css'

createApp(App).mount('#app')
