import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.spec.ts", "spec/**/*.spec.ts"],
    // A *.mac.spec.ts needs this Mac's apps, its permissions and a built helper, so it is its
    // own command (`npm run spec:mac`) and never part of a run that has to pass anywhere.
    exclude: ["**/node_modules/**", "spec/architecture/fixtures/**", "**/*.mac.spec.ts"],
  },
});
