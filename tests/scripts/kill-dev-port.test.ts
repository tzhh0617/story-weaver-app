import { spawn } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

const scriptPath = path.resolve(__dirname, '../../scripts/kill-dev-port.mjs');

async function readFirstLine(stream: NodeJS.ReadableStream): Promise<string> {
  let buffer = '';

  for await (const chunk of stream) {
    buffer += String(chunk);
    const lineEnd = buffer.indexOf('\n');
    if (lineEnd !== -1) {
      return buffer.slice(0, lineEnd).trim();
    }
  }

  throw new Error('Process ended before writing a line');
}

describe('kill-dev-port script', () => {
  test('terminates a process listening on the requested port', async () => {
    const serverProcess = spawn(
      process.execPath,
      [
        '-e',
        [
          "const net = require('node:net');",
          'const server = net.createServer();',
          "server.listen(0, '127.0.0.1', () => console.log(server.address().port));",
          'process.stdin.resume();',
        ].join(' '),
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );

    try {
      const port = await readFirstLine(serverProcess.stdout);
      expect(Number(port)).toBeGreaterThan(0);

      const serverExit = once(serverProcess, 'exit') as Promise<[number | null, NodeJS.Signals | null]>;
      const cleanupProcess = spawn(process.execPath, [scriptPath, port], {
        cwd: path.resolve(__dirname, '../..'),
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const [cleanupCode] = (await once(cleanupProcess, 'exit')) as [number | null, NodeJS.Signals | null];
      expect(cleanupCode).toBe(0);

      const [, signal] = await serverExit;
      expect(signal).toBe('SIGTERM');
    } finally {
      if (!serverProcess.killed) {
        serverProcess.kill('SIGKILL');
      }
    }
  });
});
