// OpenWrt 内嵌前端构建(neutral flavor;ipk/apk 的 dist/www 同源)。
// root 指向 core 包:复用其自带入口(index.html/src/main.ts/public)与默认
// 无宿主适配器——OpenWrt 是独立端口部署,无平台 SDK 桥接。
// (2026-10-09 前端拆仓:适配器归各平台仓,openwrt 无适配器=纯 neutral。)
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'

const coreDir = fileURLToPath(new URL('./node_modules/@pigeonbox/frontend-core', import.meta.url))
const coreSrc = `${coreDir}/src`
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string }

export default defineConfig({
  root: coreDir,
  // 相对 base:ipk 内嵌 UI 经任意反代/带前缀路径访问时资源不丢前缀
  base: './',
  plugins: [
    vue(),
    Components({
      resolvers: [ElementPlusResolver()],
      dts: fileURLToPath(new URL('./components.d.ts', import.meta.url)),
      dirs: [`${coreSrc}/components`],
      // core 以 tgz 形态住在 node_modules——unplugin 默认 exclude node_modules,
      // 会让 core 源码模板里的 El*(el-icon 等图标容器)永远不被解析(图标全灭,
      // 2026-10-09 fnos 真机视觉回归同源)。只排 .git,放行 core 源码。
      exclude: [/\/\.git\//],
    }),
  ],
  define: {
    // 版本注入:构建环境 APP_VERSION 优先(打包脚本传前端列车号),
    // 缺省取本包 version——页脚「前端版本」显示产品语义版本
    __APP_VERSION__: JSON.stringify(process.env.APP_VERSION || pkg.version),
  },
  resolve: {
    alias: {
      '@': coreSrc,
    },
  },
  build: {
    outDir: fileURLToPath(new URL('./dist', import.meta.url)),
    emptyOutDir: true,
  },
})
