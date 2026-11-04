import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // Opt-in live Track B probe can be slow on a cold model load.
    testTimeout: 30_000,
    hookTimeout: 20_000,
  },
});
