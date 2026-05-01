import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { RuntimeServices } from '.././runtime/create-runtime-services.js';
type Unsubscribe = () => void;

function writeSseHeaders(reply: FastifyReply) {
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });
}

function writeSseFrame(reply: FastifyReply, payload: unknown) {
  reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function shouldCloseAfterFirstEvent(request: FastifyRequest) {
  return (request.query as { once?: string }).once === '1';
}

function streamEvents(
  request: FastifyRequest,
  reply: FastifyReply,
  subscribe: (listener: (payload: unknown) => void) => Unsubscribe
) {
  reply.hijack();
  writeSseHeaders(reply);

  let unsubscribe: Unsubscribe | null = null;
  unsubscribe = subscribe((payload) => {
    writeSseFrame(reply, payload);

    if (shouldCloseAfterFirstEvent(request)) {
      unsubscribe?.();
      reply.raw.end();
    }
  });

  request.raw.on('close', () => {
    unsubscribe?.();
  });
}

export async function registerEventRoutes(
  app: FastifyInstance,
  services: RuntimeServices
) {
  app.get('/api/events/scheduler', (request, reply) => {
    streamEvents(request, reply, services.subscribeSchedulerStatus);
  });

  app.get('/api/events/book-generation', (request, reply) => {
    streamEvents(request, reply, services.subscribeBookGeneration);
  });

  app.get('/api/events/execution-logs', (request, reply) => {
    streamEvents(request, reply, services.subscribeExecutionLogs);
  });
}
