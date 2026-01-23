import { handleRequest } from '../index';

export default {
  async fetch(request: Request): Promise<Response> {
    return handleRequest(request);
  },
};
