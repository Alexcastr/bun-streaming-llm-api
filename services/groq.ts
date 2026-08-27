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
      max_completion_tokens: 4096,
      top_p: 1,
      stream: true,
      stop: null
    });

    return (async function* () {
      for await (const chunk of chatCompletion) {
        yield chunk.choices[0]?.delta?.content || ''
      }
    })()
  }
}
