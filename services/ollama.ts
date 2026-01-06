import type { AIService, ChatMessage } from '../types';

const DEFAULT_OLLAMA_BASE_URL = 'http://127.0.0.1:11434';
const DEFAULT_OLLAMA_MODEL = 'gpt-oss:20b';
const OLLAMA_GEMMA_MODEL = 'gemma3:1b';

function getOllamaConfig() {
  return {
    baseUrl: (process.env.OLLAMA_BASE_URL ?? DEFAULT_OLLAMA_BASE_URL).replace(/\/+$/, ''),
    model: process.env.OLLAMA_MODEL ?? OLLAMA_GEMMA_MODEL,
  };
}

export const ollamaService: AIService = {
  name: 'Ollama',
  async chat(messages: ChatMessage[]) {
    const { baseUrl, model } = getOllamaConfig();

    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      throw new Error(
        `Ollama request failed: ${res.status} ${res.statusText}${errorText ? ` - ${errorText}` : ''}`,
      );
    }

    const body = res.body;
    if (!body) {
      throw new Error('Ollama response has no body');
    }

    return (async function* () {
      const reader = body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);

          if (!line) continue;

          try {
            const obj = JSON.parse(line) as any;
            const delta = obj?.message?.content ?? '';
            if (delta) yield delta;
            if (obj?.done === true) return;
          } catch {
            // If we can't parse yet, keep buffering.
            // (Ollama streams JSON per line; partial lines can occur across chunks.)
            buffer = `${line}\n${buffer}`;
            break;
          }
        }
      }

      const tail = buffer.trim();
      if (tail) {
        try {
          const obj = JSON.parse(tail) as any;
          const delta = obj?.message?.content ?? '';
          if (delta) yield delta;
        } catch {
          // ignore
        }
      }
    })();
  },
};
