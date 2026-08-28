#!/usr/bin/env bash
# Always bind the portal to one port. If it is taken, stop the occupant and retry.
set -euo pipefail
PORT="${PORT:-3000}"

free_port() {
  local pids
  pids=$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)
  if [[ -n "${pids}" ]]; then
    echo "Port ${PORT} is taken (${pids}). Stopping those processes."
    # shellcheck disable=SC2086
    kill ${pids} 2>/dev/null || true
    sleep 0.4
    pids=$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)
    if [[ -n "${pids}" ]]; then
      # shellcheck disable=SC2086
      kill -9 ${pids} 2>/dev/null || true
    fi
  fi
}

free_port
export PORT
exec npx next dev --turbopack --port "${PORT}"
