import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  {
    extends: "./vitest.config.ts",
    test: {
      name: "unit",
      environment: "jsdom",
      include: [
        "src/**/__tests__/**/*.{spec,test}.{ts,tsx}",
        "tests/unit/**/*.{spec,test}.{ts,tsx}",
      ],
      setupFiles: ["tests/unit/_setup.ts"],
    },
  },
  {
    extends: "./vitest.config.ts",
    test: {
      name: "integration",
      environment: "node",
      include: ["tests/integration/**/*.{spec,test}.ts"],
      testTimeout: 30_000,
      globalSetup: ["tests/integration/_global-setup.ts"],
      setupFiles: ["tests/integration/_setup.ts"],
    },
  },
]);
