/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

// Configuração única para Cloudflare Pages e Vercel (build estático em dist/).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1800,
    rollupOptions: {
      output: {
        // Phaser e bibliotecas gráficas em chunks próprios (cache de CDN)
        manualChunks(id: string) {
          if (id.includes('node_modules/phaser')) return 'phaser'
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) return 'charts'
          if (id.includes('node_modules/@xyflow')) return 'flow'
          return undefined
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
})
