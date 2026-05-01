import { describe, expect, it } from 'vitest';
import { buildServer } from '@story-weaver/backend';

describe('backend package entry', () => {
  it('exports the Fastify server builder', async () => {
    const server = await buildServer();

    try {
      const response = await server.inject({
        method: 'GET',
        url: '/api/health',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ ok: true });
    } finally {
      await server.close();
    }
  });
});
