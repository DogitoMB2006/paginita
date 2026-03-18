import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // Use relative paths in the production build so assets
  // load correctly from Electron's bundled dist folder.
  base: './',
  plugins: [react(), tailwindcss()],
})
