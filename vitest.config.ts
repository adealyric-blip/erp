import { defineConfig } from 'vitest/config';
import path from 'node:path';

// T04 fix (Phase 1 close-out): vitest's default include matches
// e2e/auth.spec.ts (a Playwright test), which made `npm test` exit 1
// even though all 43 unit tests passed. Playwright specs live only in
// e2e/ and run via `npm run test:e2e`.
export default defineConfig({
  resolve: {
    // Mirror tsconfig paths ("@/*" -> "./src/*") so unit tests can import
    // the same modules the app does (Lane A registry, flat commands, ...).
    alias: [{ find: '@', replacement: path.resolve(__dirname, 'src') }],
  },
  test: {
    exclude: ['e2e/**', 'node_modules/**', 'dist/**', '.next/**'],
  },
});
