import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // './' 相对路径打包：Electron 用 file:// 加载 dist 时，默认的 /assets 绝对路径会找不到资源（白屏）
  base: './',
  plugins: [
    react(),
    // 第十五次课：PWA 改造 —— 构建时自动生成 manifest.webmanifest 和 sw.js
    VitePWA({
      registerType: 'autoUpdate', // 新版本上线后自动接管，无需用户手动刷新
      manifest: {
        name: '费曼学习平台',
        short_name: '费曼平台',
        description: '一个基于AI的个性化费曼学习平台（Web + Electron + PWA）',
        theme_color: '#1a2a3a',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '.',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'], // 预缓存这些静态资源 -> 可离线打开
        // 本项目主 JS bundle 约 2.9MB（three/echarts/mermaid 都在里面），
        // workbox 默认只缓存 ≤2MB 的文件并直接报错，这里放宽到 10MB
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
      },
    }),
  ],
})
