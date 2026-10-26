import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import type { ProxyOptions } from "vite";

/** Default hessian.ai inference gateway (OpenAI-compatible). Override with HAI_API_BASE. */
const DEFAULT_AI_GATEWAY = "https://hip-gw.hessian.ai";

/** Fallback if HAI_MODEL is not set. Can be overridden in .env.local. */
const DEFAULT_AI_MODEL = "vllm/Kolibri-1";

/** Path the frontend calls; must match AI_PROXY_PATH in src/config/ai.ts. */
const AI_PROXY_PATH = "/api/llm";

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // Only variables prefixed with HAI_ are read here. They are NOT exposed to the
  // browser bundle (Vite only exposes VITE_*), so the API key stays server-side.
  const env = loadEnv(mode, process.cwd(), "HAI_");
  const apiKey = env.HAI_API_KEY;
  const model = env.HAI_MODEL?.trim() || DEFAULT_AI_MODEL;
  if (!apiKey && command === "serve") {
    console.warn(
      "[ai-proxy] HAI_API_KEY is not set. Copy .env.example to .env.local and add the team key; AI calls will fail with 401 until then.",
    );
  }

  // Dev/preview proxy: /api/llm/* -> <gateway>/v1/* with the Bearer token injected.
  const proxy: Record<string, ProxyOptions> = {
    [AI_PROXY_PATH]: {
      target: env.HAI_API_BASE || DEFAULT_AI_GATEWAY,
      changeOrigin: true,
      rewrite: (path) => path.replace(new RegExp(`^${AI_PROXY_PATH}`), "/v1"),
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
    },
  };

  return {
    plugins: [react()],
    // The model name is not secret; HAI_API_KEY stays in the proxy only.
    define: { __HAI_MODEL__: JSON.stringify(model) },
    server: { proxy },
    preview: { proxy },
  };
});
