import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";

// X-Lumon-Build: en local vale "dev"; en producción, el SHA corto (7) del commit construido.
function buildSha(): string {
  const fromVercel = process.env.VERCEL_GIT_COMMIT_SHA;
  if (fromVercel) return fromVercel.slice(0, 7);
  try {
    return execSync("git rev-parse --short=7 HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "dev";
  }
}

export default defineConfig(({ command }) => ({
  plugins: [react()],
  define: {
    __BUILD_SHA__: JSON.stringify(command === "build" ? buildSha() : "dev"),
  },
}));
