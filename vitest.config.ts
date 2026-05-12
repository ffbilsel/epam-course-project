import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    globals: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/server/**", "src/lib/**"],
      exclude: [
        "src/lib/errors/codes.ts",
        "src/lib/errors/error-messages.ts",
        "src/app/**",
        "src/components/ui/**",
        "src/db/migrate.ts",
        "src/db/seed.ts",
        "**/*.d.ts",
      ],
      thresholds: {
        lines: 70,
      },
    },
  },
});
