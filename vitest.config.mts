import { defineConfig } from 'vitest/config';

// Mirrors tsconfig.json's "@/*": ["./*"] — needed because Vitest (unlike Next.js's own bundler)
// doesn't read tsconfig `paths` for runtime module resolution on its own. Every existing test
// file only ever used `@/...` in `import type` (erased at compile time), so this gap was never
// exercised until lib/services/settingsDefaults.test.ts pulled in a real value-level `@/` import.
export default defineConfig({
  resolve: {
    alias: { '@': import.meta.dirname },
  },
});
