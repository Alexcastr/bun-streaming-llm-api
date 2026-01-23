import { handleRequest } from '../server';

export default {
  async fetch(request: Request): Promise<Response> {
    return handleRequest(request);
  },
};
