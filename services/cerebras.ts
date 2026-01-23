import Cerebras from '@cerebras/cerebras_cloud_sdk';
import type { AIService, ChatMessage } from '../types';

const cerebras = new Cerebras();

const DEFAULT_CEREBRAS_MODEL = 'zai-glm-4.7';

function getCerebrasModel() {
  return process.env.CEREBRAS_MODEL ?? DEFAULT_CEREBRAS_MODEL;
}

export const cerebrasService: AIService = {
  name: 'Cerebras',
  async chat(messages: ChatMessage[]) {
    const model = getCerebrasModel();
    const stream = await cerebras.chat.completions.create({
      messages: messages as any,
      model,
      stream: true,
      max_completion_tokens: 40960,
      temperature: 0.6,
      top_p: 0.95
    });

    return (async function* () {
      for await (const chunk of stream) {
        yield (chunk as any).choices[0]?.delta?.content || ''
      }
    })()
  }
}
