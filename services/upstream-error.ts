// Los SDKs estilo OpenAI (Groq, OpenRouter, Cerebras…) exponen `status` y `headers` en
// sus errores, y server.ts se apoya en eso para traducir el fallo a un status HTTP y
// propagar el Retry-After. Los proveedores escritos a mano con fetch deben lanzar este
// error para encajar en el mismo mapeo.
export class UpstreamError extends Error {
  readonly status: number;
  readonly headers: Headers;

  constructor(serviceName: string, response: Response, body?: string) {
    super(
      `${serviceName} request failed: ${response.status} ${response.statusText}${body ? ` - ${body}` : ''}`,
    );

    this.name = 'UpstreamError';
    this.status = response.status;
    this.headers = response.headers;
  }
}
