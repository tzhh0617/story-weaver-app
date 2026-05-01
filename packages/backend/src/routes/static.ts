import fastifyStatic from '@fastify/static';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';

function sendIndex(reply: FastifyReply, indexFile: string) {
  return reply
    .header('Content-Type', 'text/html; charset=utf-8')
    .send(createReadStream(indexFile));
}

export async function registerStaticRoutes(
  app: FastifyInstance,
  options: { staticDir: string }
) {
  const indexFile = path.join(options.staticDir, 'index.html');

  if (!existsSync(indexFile)) {
    return;
  }

  await app.register(fastifyStatic, {
    root: options.staticDir,
    prefix: '/',
  });

  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api/')) {
      return reply.status(404).send({ error: 'Not found' });
    }

    return sendIndex(reply, indexFile);
  });
}
