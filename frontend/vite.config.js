import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Local dev: read .env from project root; Vercel: env vars injected by dashboard
  envDir: process.env.VERCEL ? '.' : '../',
})
