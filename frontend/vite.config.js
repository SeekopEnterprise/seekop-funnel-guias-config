import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  // Assets con rutas relativas: la app funciona aunque se publique bajo un sub-path
  base: './',
  build: {
    rollupOptions: {
      input: {
        main:   resolve(__dirname, 'index.html'),
        parent: resolve(__dirname, 'index-parent.html'),
      },
    },
  },
})
