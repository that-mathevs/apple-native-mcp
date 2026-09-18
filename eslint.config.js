import eslint from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

// The fixtures under spec/architecture break the dependency rules on purpose, so they are
// kept out of both the TypeScript project and the lint run. `.claude/` holds agent
// worktrees — other checkouts of this repo, which lint themselves.
export default defineConfig(
  globalIgnores(["dist", ".claude", "spec/architecture/fixtures"]),
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // CLAUDE.md asks for types over interfaces unless one is being extended, and the
      // types here are closed records whose fields are `readonly`, which an interface
      // cannot promise as plainly. The stylistic preset asks for the opposite, so it is
      // turned off rather than followed silently.
      "@typescript-eslint/consistent-type-definitions": "off",
    },
  },
);
