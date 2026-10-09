import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// This app is served at /scottimg/* by the main ScottVentures server
// (see Backend/server.js), so every asset path needs that prefix.
// https://vite.dev/config/
export default defineConfig({
  base: '/scottimg/',
  plugins: [react()],
  build: {
    outDir: '../scottimg',
    emptyOutDir: true,
  },
})
