import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vite';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { VantResolver } from "@vant/auto-import-resolver";
import vue from '@vitejs/plugin-vue';

// https://vitejs.dev/config/
export default defineConfig({
    base: './',
    build: {
        outDir: 'dist',
        assetsDir: 'assets',
        emptyOutDir: true,
    },
    plugins: [
        vue(),
        AutoImport({
            resolvers: [VantResolver()],
        }),
        Components({
            resolvers: [VantResolver()],
        }),
        // dev 下 /imChat 重定向到 /imChat/（与生产 nginx 行为一致）
        {
            name: 'redirect-imchat-root',
            configureServer(server) {
                server.middlewares.use((req, res, next) => {
                    const url = req.url || ''
                    if (url === '/imChat' || url === '/imChat?') {
                        res.statusCode = 302
                        res.setHeader('Location', '/imChat/')
                        res.end()
                        return
                    }
                    next()
                })
            },
        },
    ],
    server: {
        port: 8083,
        proxy: {
            // chat 后端 (context-path /chat, 端口 8801)
            // ws: true 必须开,聊天消息和通话信令都走 WebSocket
            "/chat": {
                target: "http://localhost:8801/",
                changeOrigin: true,
                secure: false,
                ws: true,
            },
        }
    },
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url))
        }
    }
});
