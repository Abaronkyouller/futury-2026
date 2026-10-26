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
  maxTokens: number = AI_MAX_TOKENS,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${AI_PROXY_PATH}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
      signal: controller.signal,
    });
  } catch (e) {
    throw new Error(
      controller.signal.aborted
        ? `Keine Antwort innerhalb von ${AI_REQUEST_TIMEOUT_MS / 1000} s.`
        : `Gateway nicht erreichbar (${(e as Error).message}). Läuft die App über „npm run dev“ oder „npm run preview“?`,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const hint =
      res.status === 401 || res.status === 403
        ? " Prüfen Sie HAI_API_KEY in .env.local und starten Sie den Dev-Server neu."
        : res.status === 404
          ? " Proxy-Route oder Modellname sind vermutlich falsch."
          : res.status >= 500
            ? " Der Proxy des Dev-Servers hat das Gateway nicht erreicht (Netzwerk, VPN, Firewall?) oder das Gateway ist ausgefallen. Siehe Terminal von „npm run dev“."
            : "";
    throw new Error(`Gateway antwortete mit Status ${res.status}.${hint} ${body.slice(0, 300)}`.trim());
  }

  const data: unknown = await res.json();
  const content = (data as { choices?: { message?: { content?: unknown } }[] })
    ?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Die Gateway-Antwort enthält keinen Nachrichtentext.");
  }
  return content;
}
