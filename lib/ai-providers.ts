export type AiProvider = "groq" | "mistral";

export interface AiStreamChunk {
  type: "chunk" | "done" | "error";
  content?: string;
  error?: string;
}

interface ProviderConfig {
  name: string;
  endpoint: string;
  models: Record<string, string>;
  defaultModel: string;
  maxTokensKey: string;
}

const PROVIDERS: Record<AiProvider, ProviderConfig> = {
  groq: {
    name: "Groq",
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    models: {
      "GPT-OSS 120B": "openai/gpt-oss-120b",
      "GPT-OSS 20B": "openai/gpt-oss-20b",
      "Qwen 3.6 27B": "qwen/qwen3.6-27b",
      "Qwen 3.8 27B": "qwen/qwen3.8-27b",
    },
    defaultModel: "openai/gpt-oss-120b",
    maxTokensKey: "max_completion_tokens",
  },
  mistral: {
    name: "Mistral",
    endpoint: "https://api.mistral.ai/v1/chat/completions",
    models: {
      "Mistral Small 4": "mistral-small-4-0-26-03",
      "Ministral 8B": "ministral-3-8b-25-12",
      "Ministral 3B": "ministral-3-3b-25-12",
    },
    defaultModel: "mistral-small-4-0-26-03",
    maxTokensKey: "max_tokens",
  },
};

export function getProviderConfig(provider: AiProvider): ProviderConfig {
  return PROVIDERS[provider];
}

export function getApiKey(provider: AiProvider): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(`exgit_${provider}_apikey`) ?? "";
}

export function setApiKey(provider: AiProvider, key: string): void {
  localStorage.setItem(`exgit_${provider}_apikey`, key);
}

export async function* streamAiResponse(
  provider: AiProvider,
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[],
): AsyncGenerator<AiStreamChunk> {
  const apiKey = getApiKey(provider);
  if (!apiKey) {
    yield { type: "error", error: `No ${PROVIDERS[provider].name} API key set. Open Settings to add one.` };
    return;
  }

  const config = PROVIDERS[provider];
  const allMessages = [
    { role: "system" as const, content: systemPrompt },
    ...messages,
  ];

  let response: Response;
  try {
    response = await fetch(config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.defaultModel,
        messages: allMessages,
        temperature: 0.3,
        [config.maxTokensKey]: 8192,
        stream: true,
      }),
    });
  } catch {
    yield { type: "error", error: "Network error. Check your internet connection." };
    return;
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    if (response.status === 401) {
      yield { type: "error", error: "Invalid API key. Check your key in Settings." };
    } else if (response.status === 429) {
      const reset = response.headers.get("x-ratelimit-reset-tokens");
      const wait = reset ? Math.ceil(Number(reset) / 1_000_000_000) : "a few";
      yield { type: "error", error: `Rate limited. Try again in ${wait}s.` };
    } else {
      yield { type: "error", error: `API error ${response.status}: ${body.slice(0, 200)}` };
    }
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    yield { type: "error", error: "No response stream." };
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;

        const data = trimmed.slice(6);
        if (data === "[DONE]") {
          yield { type: "done" };
          return;
        }

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            yield { type: "chunk", content: delta };
          }
        } catch {
          // skip malformed JSON lines
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  yield { type: "done" };
}
