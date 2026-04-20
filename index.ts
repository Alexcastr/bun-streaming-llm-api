import { handleRequest } from './server';

const server = Bun.serve({
  port: process.env.PORT ?? 3000,
  idleTimeout: 120,
  fetch: handleRequest,
});

console.log(`Server is running on ${server.url}`);
