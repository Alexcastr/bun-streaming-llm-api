import { handleRequest } from './server';

const server = Bun.serve({
  port: process.env.PORT ?? 3000,
  fetch: handleRequest,
});

console.log(`Server is running on ${server.url}`);
