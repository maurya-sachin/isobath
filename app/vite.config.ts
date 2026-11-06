import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // The server build only feeds the prerender; the client build already ships public/.
  // The main chunk is 453 kB (React DOM and Router are 295 kB of it); Vite warns past 470 kB.
  build: { copyPublicDir: !isSsrBuild, chunkSizeWarningLimit: 470 },
}))
