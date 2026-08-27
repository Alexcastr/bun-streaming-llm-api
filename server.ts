import { groqService } from './services/groq';
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
  // Cerebras (eliminado: pasó a ser de pago)
  // Google Gemini
  // OpenRouter
  // otro servicio incluso local
];

let currentServiceIndex = 0;

// Reparte la carga arrancando por un proveedor distinto en cada petición, pero
// devuelve la rotación completa para poder recurrir al siguiente si el primero falla.
function getServicesInRotation(): AIService[] {
  if (services.length === 0) return [];

  const start = currentServiceIndex;
  currentServiceIndex = (currentServiceIndex + 1) % services.length;

  return [...services.slice(start), ...services.slice(0, start)];
}

// Groq puede señalar un rate limit dentro del stream, con las cabeceras ya en 200.
// Consumiendo el primer chunk antes de construir la Response, ese fallo todavía llega
// al catch y se convierte en un status real en lugar de una respuesta vacía.
async function startStream(source: AsyncIterable<string>): Promise<AsyncIterable<string>> {
  const iterator = source[Symbol.asyncIterator]();
  const first = await iterator.next();

  return (async function* () {
    if (first.done) return;
    yield first.value;

    while (true) {
      const next = await iterator.next();
      if (next.done) return;
      yield next.value;
    }
  })();
}

function getErrorStatus(error: unknown) {
  return (error as { status?: number } | null)?.status;
}

function getRetryAfter(error: unknown) {
  const headers = (error as { headers?: Headers | Record<string, string> } | null)?.headers;
  if (!headers) return undefined;
  if (typeof (headers as Headers).get === 'function') {
    return (headers as Headers).get('retry-after') ?? undefined;
  }
  return (headers as Record<string, string>)['retry-after'];
}

// Ningún proveedor pudo abrir el stream, así que todavía podemos devolver un status útil.
function upstreamErrorResponse(error: unknown, corsHeaders: Record<string, string>): Response {
  const status = getErrorStatus(error);

  if (status === 429) {
    const retryAfter = getRetryAfter(error);
    return new Response('Rate limit reached, retry shortly', {
      status: 429,
      headers: retryAfter ? { ...corsHeaders, 'Retry-After': retryAfter } : corsHeaders,
    });
  }

  return new Response('AI service unavailable', {
    status: 502,
    headers: corsHeaders,
  });
}

// Una vez abierto el stream ya no se puede cambiar el status: registramos el fallo y
// cerramos la respuesta, en vez de dejar la petición colgada sin traza.
async function* logStreamErrors(source: AsyncIterable<string>, serviceName: string) {
  try {
    for await (const chunk of source) {
      yield chunk;
    }
  } catch (error) {
    console.error(`${serviceName} stream failed mid-response:`, error);
  }
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

  if (req.method === 'POST' && pathname === '/api/chat') {
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

    const { messages } = (await req.json()) as { messages: ChatMessage[] };
    const finalMessages = withCvContext(messages);

    const rotation = getServicesInRotation();

    if (rotation.length === 0) {
      return new Response('No AI service configured', {
        status: 503,
        headers: corsHeaders,
      });
    }

    let stream: AsyncIterable<string> | undefined;
    let serviceName = '';
    let lastError: unknown;

    // startStream ya consumió el primer chunk, así que aquí se capturan también los
    // fallos que el proveedor solo revela una vez abierto el stream, como el rate limit.
    for (const candidate of rotation) {
      console.log(`Using ${candidate.name} service`);

      try {
        stream = await startStream(await candidate.chat(finalMessages));
        serviceName = candidate.name;
        break;
      } catch (error) {
        lastError = error;
        console.error(
          `${candidate.name} request failed (status ${getErrorStatus(error) ?? 'unknown'}):`,
          error,
        );
      }
    }

    if (!stream) {
      return upstreamErrorResponse(lastError, corsHeaders);
    }

    return new Response(logStreamErrors(stream, serviceName), {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        ...corsHeaders,
      },
    });
  }

  return new Response('Not found', {
    status: 404,
    headers: corsHeaders,
  });
}
