#!/bin/bash
# Cleanup script for dev servers

echo "Cleaning up dev servers..."

# Kill processes on port 5173 (Vite)
lsof -ti:5173 | xargs kill -9 2>/dev/null

# Kill processes on port 5174 (backend)
lsof -ti:5174 | xargs kill -9 2>/dev/null

# Kill any Electron processes from story-weaver
pkill -9 -f "Electron.*story-weaver" 2>/dev/null

# Kill already-running concurrently node processes without matching this shell.
pkill -9 -f "node .*/concurrently/dist/bin/concurrently\\.js" 2>/dev/null

# Wait for ports to be released
sleep 2

# Verify
if lsof -i:5173 >/dev/null 2>&1 || lsof -i:5174 >/dev/null 2>&1; then
  echo "Warning: Ports still in use, forcing cleanup..."
  lsof -ti:5173 | xargs kill -9 2>/dev/null
  lsof -ti:5174 | xargs kill -9 2>/dev/null
  sleep 1
fi

echo "Cleanup complete"
