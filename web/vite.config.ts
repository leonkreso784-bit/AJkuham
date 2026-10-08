import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { host: true },
  // Railway (kuhai-web) servira produkcijski build kroz `vite preview`; bez ovoga preview odbija tudi host.
  preview: { host: true, allowedHosts: true },
})
