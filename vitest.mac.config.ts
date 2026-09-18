import { defineConfig } from "vitest/config";

// The specs that need this Mac: a built helper, the real apps, and the permissions they ask for.
export default defineConfig({
  test: {
    include: ["src/**/*.mac.spec.ts", "spec/**/*.mac.spec.ts"],
    testTimeout: 30_000,
  },
});
