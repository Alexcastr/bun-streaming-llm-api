# openai-bun-api

API mínima en Bun que expone un endpoint de chat con respuesta en streaming (SSE). Internamente alterna entre proveedores (Groq y Cerebras) en cada request.

## Requisitos

- Tener instalado **Bun**
- Tener al menos **una API key** válida para los proveedores configurados (Groq y/o Cerebras)

## Instalación

```bash
bun install
```

## Variables de entorno

- `PORT` (opcional): puerto del servidor. Por defecto `3000`.

Ollama (local):

- `OLLAMA_BASE_URL` (opcional): URL de tu Ollama. Por defecto `http://127.0.0.1:11434`.
- `OLLAMA_MODEL` (opcional): modelo a usar. Por defecto `gpt-oss:20b`.

Para que los SDKs puedan autenticar, define las variables de entorno que cada proveedor espera.
En la práctica, normalmente son:

- Groq: `GROQ_API_KEY`
- Cerebras: `CEREBRAS_API_KEY`

Si usas otros nombres/formatos, ajusta según la documentación de cada SDK/proveedor.

Ejemplo (Windows PowerShell):

```powershell
$env:GROQ_API_KEY="TU_API_KEY"
$env:CEREBRAS_API_KEY="TU_API_KEY"
$env:OLLAMA_BASE_URL="http://127.0.0.1:11434"
# Los modelos deben estar descargados en local para OLLAMA 👇
$env:OLLAMA_MODEL="gpt-oss:20b"
$env:OLLAMA_GEMMA_MODEL="gemma3:1"

$env:PORT="3000"
```

## Arrancar el proyecto

- Desarrollo (watch):

```bash
bun dev
```

- Modo start:

```bash
bun run start
```

El servidor levanta en `http://localhost:3000` (o el `PORT` que definas).

## Uso (Postman)

Endpoint:

- `POST http://localhost:3000/chat`

Headers:

- `Content-Type: application/json`

Body (raw JSON):

```json
{
	"messages": [
		{
			"role": "user",
			"content": "resuelve fibonacci"
		}
	]
}
```

Nota: la respuesta se envía como streaming con `Content-Type: text/event-stream` (SSE). En algunos clientes verás llegar el texto por partes.

## Ejemplo con cURL

Usa `-N` para no bufferizar y ver el stream:

```bash
curl -N http://localhost:3000/chat \
	-H "Content-Type: application/json" \
	-d '{"messages":[{"role":"user","content":"resuelve fibonacci"}]}'
```
