import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next", "dist"],
    // Vitest's 5s default is not enough for the heavier jsdom render tests when
    // the whole suite runs in parallel — sidebar.test.tsx times out on a loaded
    // machine while passing in isolation. Raised when `pnpm test` was added to
    // CI, since a gate that fails intermittently gets ignored, and an ignored
    // gate is worse than no gate.
    testTimeout: 20_000,
    hookTimeout: 20_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      reportsDirectory: "./coverage",
      include: ["src/lib/**/*.ts", "src/features/**/*.tsx"],
      exclude: [
        "src/**/*.d.ts",
        "src/**/*.test.ts",
        "src/**/*.spec.ts",
        "src/test/**",
        "node_modules/**",
      ],
      // TODO: Gradually increase thresholds as more tests are added
      // Target: lines: 70, functions: 70, branches: 60, statements: 70
      thresholds: {
        lines: 2,
        functions: 1,
        branches: 1,
        statements: 2,
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
