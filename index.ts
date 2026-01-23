import { groqService } from './services/groq';
import { cerebrasService } from './services/cerebras';
// import { ollamaService } from './services/ollama'; // This one i got it in local
import type { AIService, ChatMessage } from './types';
import { withCvContext } from './cv-context';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.warn('Warning: API_KEY is not set in environment. All requests to /chat will be rejected with 401.');
}

const services: AIService[] = [
  // ollamaService,
  groqService,
  cerebrasService,
  // Google Gemini
  // OpenRouter
  // otro servicio incluso local
]
let currentServiceIndex = 0;

function getNextService() {
  const service = services[currentServiceIndex];
  currentServiceIndex = (currentServiceIndex + 1) % services.length;
  return service;
}

export async function handleRequest(req: Request): Promise<Response> {
  const { pathname } = new URL(req.url);

  const origin = req.headers.get('origin') || '*';
  const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
    'Access-Control-Allow-Credentials': 'true',
  };

  // Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (
    req.method === 'POST' &&
    (pathname === '/chat' || pathname === '/api/chat')
  ) {
    if (!API_KEY) {
      return new Response('Unauthorized: missing server API key configuration', {
        status: 401,
        headers: corsHeaders,
      });
    }

    const clientKey = req.headers.get('x-api-key');

    if (!clientKey || clientKey !== API_KEY) {
      return new Response('Unauthorized', {
        status: 401,
        headers: corsHeaders,
      });
    }

    const { messages } = await req.json() as { messages: ChatMessage[] };
    const finalMessages = withCvContext(messages);
    const service = getNextService();

    console.log(`Using ${service?.name} service`);
    const stream = await service?.chat(finalMessages);

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        ...corsHeaders,
      },
    });
  }

  return new Response("Not found", {
    status: 404,
    headers: corsHeaders,
  });
}

const server = Bun.serve({
  port: process.env.PORT ?? 3000,
  fetch: handleRequest,
});

console.log(`Server is running on ${server.url}`);
