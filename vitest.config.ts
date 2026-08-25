import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Domain logic (pricing tiers, NIP validation, cart rules) lives in
 * `storefront/src/lib` as framework-free modules, so the suite runs in a plain
 * Node environment with no DOM or Next.js runtime involved.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./storefront/src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      include: ['storefront/src/lib/**', 'storefront/src/stores/**'],
      reporter: ['text', 'html'],
    },
  },
});
