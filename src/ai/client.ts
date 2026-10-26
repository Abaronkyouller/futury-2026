import { AI_MAX_TOKENS, AI_PROXY_PATH, AI_REQUEST_TIMEOUT_MS } from "../config/ai";
import type { ChatMessage } from "./prompt";

/**
 * Calls the OpenAI-compatible chat completions route through the Vite proxy.
 * The proxy adds the Bearer token, so no key is present in browser code.
 * Returns the raw assistant text; parsing happens in parse.ts.
 */
export async function chatCompletion(
  model: string,
  messages: ChatMessage[],
  temperature: number,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${AI_PROXY_PATH}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, temperature, max_tokens: AI_MAX_TOKENS }),
      signal: controller.signal,
    });
  } catch (e) {
    throw new Error(
      controller.signal.aborted
        ? `No answer within ${AI_REQUEST_TIMEOUT_MS / 1000} s.`
        : `Gateway not reachable (${(e as Error).message}). Is the app running via "npm run dev" or "npm run preview"?`,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const hint =
      res.status === 401 || res.status === 403
        ? " Check HAI_API_KEY in .env.local and restart the dev server."
        : res.status === 404
          ? " The proxy route or model name may be wrong."
          : res.status >= 500
            ? " The dev-server proxy could not reach the gateway (network, VPN or firewall?) or the gateway failed. See the terminal running npm run dev."
            : "";
    throw new Error(`Gateway answered ${res.status}.${hint} ${body.slice(0, 300)}`.trim());
  }

  const data: unknown = await res.json();
  const content = (data as { choices?: { message?: { content?: unknown } }[] })
    ?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("The gateway reply contains no message text.");
  }
  return content;
}
