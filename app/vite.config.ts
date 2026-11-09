import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { POSTHOG_PROXY_PATH } from './src/lib/posthogHost.ts'

const stripProxyPath = (url: string) => url.slice(POSTHOG_PROXY_PATH.length)
const proxyTo = (target: string) => ({ target, changeOrigin: true, rewrite: stripProxyPath })
const posthogProxy = {
  [`^${POSTHOG_PROXY_PATH}/static/`]: proxyTo('https://eu-assets.i.posthog.com'),
  [`^${POSTHOG_PROXY_PATH}/array/`]: proxyTo('https://eu-assets.i.posthog.com'),
  [`^${POSTHOG_PROXY_PATH}/`]: proxyTo('https://eu.i.posthog.com'),
}

// https://vite.dev/config/
export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // The server build only feeds the prerender; the client build already ships public/.
  // The main chunk is 458 kB (React DOM and Router are 295 kB of it); Vite warns past 470 kB.
  // The same three rewrites as vercel.json, in the same order, for `vite` and `vite preview`.
  server: { proxy: posthogProxy },
  preview: { proxy: posthogProxy },
  build: { copyPublicDir: !isSsrBuild, chunkSizeWarningLimit: 470 },
}))
