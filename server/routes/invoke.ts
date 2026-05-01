import type { FastifyInstance } from 'fastify';
import { ipcInvokeChannels, type IpcInvokeChannel } from '../../src/shared/contracts.js';
import { dispatchInvoke } from '../channel-dispatch.js';
import type { RuntimeServices } from '../../src/runtime/create-runtime-services.js';
import type { createExportRegistry } from '../export-registry.js';

type ExportRegistry = ReturnType<typeof createExportRegistry>;

type InvokeBody = {
  channel?: unknown;
  payload?: unknown;
};

function isInvokeChannel(channel: unknown): channel is IpcInvokeChannel {
  return (
    typeof channel === 'string' &&
    (ipcInvokeChannels as readonly string[]).includes(channel)
  );
}

export async function registerInvokeRoutes(
  app: FastifyInstance,
  services: RuntimeServices,
  options?: { exportsRegistry?: ExportRegistry }
) {
  app.post<{ Body: InvokeBody }>('/api/invoke', async (request, reply) => {
    const { channel, payload } = request.body ?? {};

    if (!isInvokeChannel(channel)) {
      return reply.status(400).send({ error: 'Unsupported invoke channel' });
    }

    try {
      const data = await dispatchInvoke(services, channel, payload, {
        exportsRegistry: options?.exportsRegistry,
      });
      return { data };
    } catch (error) {
      return reply.status(400).send({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}
