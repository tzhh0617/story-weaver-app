#!/bin/bash
# Cleanup script for dev servers

echo "Cleaning up dev servers..."

protected_pids=" "
protected_pgids=" "
current_pid=$$
while true; do
  protected_pids="$protected_pids$current_pid "
  current_pgid=$(ps -o pgid= -p "$current_pid" 2>/dev/null | tr -d ' ')
  if [ -n "$current_pgid" ]; then
    protected_pgids="$protected_pgids$current_pgid "
  fi

  parent_pid=$(ps -o ppid= -p "$current_pid" 2>/dev/null | tr -d ' ')

  if [ -z "$parent_pid" ] || [ "$parent_pid" -le 1 ]; then
    break
  fi

  current_pid=$parent_pid
done

is_protected_pid() {
  case "$protected_pids" in
    *" $1 "*) return 0 ;;
    *) return 1 ;;
  esac
}

is_protected_pgid() {
  case "$protected_pgids" in
    *" $1 "*) return 0 ;;
    *) return 1 ;;
  esac
}

kill_process_group() {
  process_id=$1
  process_group_id=$(ps -o pgid= -p "$process_id" 2>/dev/null | tr -d ' ')

  if [ -z "$process_group_id" ] || is_protected_pgid "$process_group_id"; then
    kill -9 "$process_id" 2>/dev/null
    return
  fi

  kill -9 "-$process_group_id" 2>/dev/null
}

kill_matching_processes() {
  pattern=$1

  pgrep -f "$pattern" 2>/dev/null | while read -r process_id; do
    if [ -z "$process_id" ] || is_protected_pid "$process_id"; then
      continue
    fi

    kill_process_group "$process_id"
  done
}

# Kill processes on port 5173 (Vite)
lsof -ti:5173 | xargs kill -9 2>/dev/null

# Kill processes on port 5174 (backend)
lsof -ti:5174 | xargs kill -9 2>/dev/null

# Kill any Electron processes from story-weaver
pkill -9 -f "Electron.*story-weaver" 2>/dev/null

# Kill stale dev wrappers before they can spawn a new frontend after cleanup.
kill_matching_processes "node .*/pnpm dev$"
kill_matching_processes "node .*/pnpm run dev$"
kill_matching_processes "sh -c bash scripts/cleanup-dev\\.sh && concurrently"
kill_matching_processes "node .*/concurrently/dist/bin/concurrently\\.js"

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
