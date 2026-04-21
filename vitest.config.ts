import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  // Load env vars from .env.local for tests
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    test: {
      globals: true,
      environment: 'happy-dom',
      setupFiles: ['./tests/setup.ts'],
      include: ['tests/unit/**/*.test.{ts,tsx}', 'tests/integration/**/*.test.{ts,tsx}'],
      env: {
        NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
      },
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        exclude: ['node_modules/', 'tests/', '.next/', 'out/'],
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './'),
      },
    },
  }
})
