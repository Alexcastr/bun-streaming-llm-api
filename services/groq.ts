import { Groq } from 'groq-sdk';
import type { AIService, ChatMessage } from '../types';

const groq = new Groq();

const DEFAULT_GROQ_MODEL = 'qwen/qwen3.8-27b';

function getGroqModel() {
  return process.env.GROQ_MODEL ?? DEFAULT_GROQ_MODEL;
}

export const groqService: AIService = {
  name: 'Groq',
  async chat(messages: ChatMessage[]) {
    const chatCompletion = await groq.chat.completions.create({
      messages,
      model: getGroqModel(),
      temperature: 0.6,
      // Groq reserva prompt + max_completion_tokens contra el límite por minuto,
      // así que se mantiene ajustado al tamaño de respuesta que pide el system prompt.
      max_completion_tokens: 512,
      top_p: 1,
      stream: true,
      stop: null
    });

    return (async function* () {
      for await (const chunk of chatCompletion) {
        const delta = chunk.choices[0]?.delta as { content?: string | null; reasoning?: string | null } | undefined;
        // Los modelos compound entregan la respuesta en `reasoning` al hacer streaming,
        // el resto la entrega en `content`.
        yield delta?.content || delta?.reasoning || ''
      }
    })()
  }
}
