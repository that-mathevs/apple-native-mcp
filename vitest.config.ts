import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.spec.ts", "spec/**/*.spec.ts"],
    exclude: ["**/node_modules/**", "spec/architecture/fixtures/**"],
  },
});
