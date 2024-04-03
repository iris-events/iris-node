import { defineConfig } from 'vitest/config'
import swc from 'unplugin-swc'

export default defineConfig({
  test: {
    setupFiles: ['dotenv/config'],
    cache: false,
    globals: true,
    root: './',
    clearMocks: true,
    reporters: ['verbose'],
    include: [
      '(src|test)/**/*.spec.ts'
    ],
    fileParallelism: true,
    coverage: {
      clean: true, // clean existing before running test
      enabled: true,
      reporter: ['html-spa', 'text'],
      provider: 'v8',
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
      reportsDirectory: 'coverage/all',
      exclude: [
        '**/coverage/**',
        '**/dist/**',
        '**/test?(s)/**',
        '**/vitest*',
        '**/jest*',
      ]
    },
  },
  plugins: [
    swc.vite({
      module: { type: 'nodenext' },
    })
  ]
})
