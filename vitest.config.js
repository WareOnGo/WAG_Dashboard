import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js', './src/test/mswServer.js'],
    css: true,
    // Real Ant Design interactions are expensive under jsdom + coverage.
    maxWorkers: 2,
    testTimeout: 15000,
    reporters: ['default', 'junit', 'json'],
    outputFile: { junit: 'test-results/junit.xml', json: 'test-results/results.json' },
    env: {
      VITE_API_BASE_URL: 'http://localhost:3001/api'
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html', 'lcov'],
      reportOnFailure: true,
      include: ['src/**/*.{js,jsx}'],
      exclude: [
        'src/test/**',
        'src/**/__tests__/**',
        'src/main.jsx', // React bootstrap; browser smoke tests exercise this.
        'src/components/index.js',
        'src/contexts/index.js',
        'src/hooks/index.js',
        'src/services/index.js',
        'src/utils/index.js',
      ],
      thresholds: {
        // Honest whole-source baseline, including untouched features. The former
        // thresholds.global object did not enforce any global limit in Vitest.
        // Raise these as coverage is added; see docs/dashboard-test-repair-review.md.
        branches: 30,
        functions: 30,
        lines: 30,
        statements: 30,
        'src/components/Dashboard.jsx': { lines: 70, statements: 65, functions: 60, branches: 40 },
        'src/components/WarehouseForm.jsx': { lines: 70, statements: 70, functions: 70, branches: 70 },
      },
    },
  },
});
