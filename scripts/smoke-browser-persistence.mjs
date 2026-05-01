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

async function requestJson(baseUrl, route, options = {}) {
  const response = await fetch(`${baseUrl}${route}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const body = await response.json();

  if (!response.ok) {
    throw new Error(body?.error ?? `Request failed with ${response.status}`);
  }

  return body;
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
  serverProcess = spawn(process.execPath, ['packages/backend/dist/main.js'], {
    stdio: 'inherit',
    shell: false,
    env: {
      ...process.env,
      STORY_WEAVER_ROOT_DIR: rootDir,
      STORY_WEAVER_SERVER_HOST: host,
      STORY_WEAVER_SERVER_PORT: String(port),
      STORY_WEAVER_STATIC_DIR: path.resolve('packages/frontend/dist'),
    },
  });

  await waitForHealth(baseUrl);

  const createResult = await requestJson(baseUrl, '/api/books', {
    method: 'POST',
    body: JSON.stringify({
      idea: 'Browser persistence smoke test',
      targetChapters: 1,
      wordsPerChapter: 300,
      viralStrategy: {
        readerPayoff: 'Verify browser server persistence',
        protagonistDesire: 'Persist through Fastify into SQLite',
        cadenceMode: 'fast',
      },
    }),
  });
  const books = await requestJson(baseUrl, '/api/books');

  if (
    !Array.isArray(books) ||
    !books.some((book) => book.id === createResult.bookId)
  ) {
    throw new Error(
      `Created book ${createResult.bookId} was not returned by GET /api/books`
    );
  }

  await verifyDatabase(createResult.bookId);
  console.log(`Browser persistence smoke passed for ${createResult.bookId}`);
}

try {
  await main();
} finally {
  await stopServer();
  await rm(rootDir, { recursive: true, force: true });
}
