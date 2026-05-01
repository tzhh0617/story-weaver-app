#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';

const rootDir = await mkdtemp(path.join(tmpdir(), 'story-weaver-browser-smoke-'));
const host = '127.0.0.1';
let serverProcess = null;

function pnpmCommand() {
  return process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: false,
      ...options,
    });

    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `${command} ${args.join(' ')} failed with ${signal ?? `code ${code}`}`
        )
      );
    });
  });
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.on('error', reject);
    server.listen(0, host, () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address === 'object') {
          resolve(address.port);
          return;
        }

        reject(new Error('Unable to allocate a smoke test port'));
      });
    });
  });
}

async function waitForHealth(baseUrl) {
  const deadline = Date.now() + 15000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // The server may still be starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(`Timed out waiting for ${baseUrl}/api/health`);
}

async function invoke(baseUrl, channel, payload) {
  const response = await fetch(`${baseUrl}/api/invoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel, payload }),
  });
  const body = await response.json();

  if (!response.ok) {
    throw new Error(body?.error ?? `Invoke failed with ${response.status}`);
  }

  return body.data;
}

async function verifyDatabase(bookId) {
  const { default: Database } = await import('better-sqlite3');
  const databaseFile = path.join(rootDir, 'data.db');
  const db = new Database(databaseFile, { readonly: true });

  try {
    const row = db
      .prepare(
        'SELECT id, idea, target_chapters AS targetChapters, words_per_chapter AS wordsPerChapter FROM books WHERE id = ?'
      )
      .get(bookId);

    if (!row) {
      throw new Error(`Book ${bookId} was not persisted to ${databaseFile}`);
    }

    if (row.targetChapters !== 1 || row.wordsPerChapter !== 300) {
      throw new Error(`Unexpected persisted book shape: ${JSON.stringify(row)}`);
    }
  } finally {
    db.close();
  }
}

async function stopServer() {
  if (!serverProcess || serverProcess.killed) {
    return;
  }

  serverProcess.kill('SIGTERM');

  await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      if (serverProcess && !serverProcess.killed) {
        serverProcess.kill('SIGKILL');
      }
      resolve();
    }, 3000);

    serverProcess?.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

async function main() {
  const port = await getFreePort();
  const baseUrl = `http://${host}:${port}`;

  console.log('Rebuilding SQLite native bindings for Node...');
  await run(pnpmCommand(), ['rebuild', 'better-sqlite3']);

  console.log('Building browser server smoke target...');
  await run(pnpmCommand(), ['run', 'build']);

  console.log(`Starting browser server on ${baseUrl}`);
  serverProcess = spawn(process.execPath, ['dist-server/server/main.js'], {
    stdio: 'inherit',
    shell: false,
    env: {
      ...process.env,
      STORY_WEAVER_ROOT_DIR: rootDir,
      STORY_WEAVER_SERVER_HOST: host,
      STORY_WEAVER_SERVER_PORT: String(port),
    },
  });

  await waitForHealth(baseUrl);

  const bookId = await invoke(baseUrl, 'book:create', {
    idea: 'Browser persistence smoke test',
    targetChapters: 1,
    wordsPerChapter: 300,
    viralStrategy: {
      readerPayoff: 'Verify browser server persistence',
      protagonistDesire: 'Persist through Fastify into SQLite',
      cadenceMode: 'fast',
    },
  });
  const books = await invoke(baseUrl, 'book:list');

  if (!Array.isArray(books) || !books.some((book) => book.id === bookId)) {
    throw new Error(`Created book ${bookId} was not returned by book:list`);
  }

  await verifyDatabase(bookId);
  console.log(`Browser persistence smoke passed for ${bookId}`);
}

try {
  await main();
} finally {
  await stopServer();
  await rm(rootDir, { recursive: true, force: true });
}
