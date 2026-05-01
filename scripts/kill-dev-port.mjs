#!/usr/bin/env node

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const DEFAULT_PORT = '5173';
const TERM_TIMEOUT_MS = 3000;

function parsePort(argv) {
  const port = argv[2] ?? DEFAULT_PORT;

  if (!/^\d+$/.test(port) || Number(port) <= 0 || Number(port) > 65535) {
    throw new Error(`Invalid port: ${port}`);
  }

  return port;
}

async function findListeningPids(port) {
  if (process.platform === 'win32') {
    throw new Error('kill-dev-port is not implemented for Windows yet');
  }

  try {
    const { stdout } = await execFileAsync('lsof', ['-nP', `-tiTCP:${port}`, '-sTCP:LISTEN']);
    return stdout
      .split('\n')
      .map((pid) => Number(pid.trim()))
      .filter((pid) => Number.isInteger(pid) && pid > 0 && pid !== process.pid);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 1) {
      return [];
    }

    throw error;
  }
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitForPortRelease(port, pid, timeoutMs) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const pids = await findListeningPids(port);

    if (!pids.includes(pid)) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return !(await findListeningPids(port)).includes(pid);
}

async function killPid(port, pid) {
  if (!isAlive(pid)) {
    return;
  }

  process.kill(pid, 'SIGTERM');

  if (!(await waitForPortRelease(port, pid, TERM_TIMEOUT_MS)) && isAlive(pid)) {
    process.kill(pid, 'SIGKILL');
    await waitForPortRelease(port, pid, 1000);
  }
}

async function main() {
  const port = parsePort(process.argv);
  const pids = await findListeningPids(port);

  if (pids.length === 0) {
    console.log(`Port ${port} is free.`);
    return;
  }

  console.log(`Closing port ${port}: ${pids.join(', ')}`);
  await Promise.all(pids.map((pid) => killPid(port, pid)));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
