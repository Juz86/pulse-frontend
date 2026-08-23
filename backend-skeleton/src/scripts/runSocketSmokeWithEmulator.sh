#!/usr/bin/env bash
set -euo pipefail

npm run dev:emulator >/tmp/pulse-backend-emulator.log 2>&1 &
pulse_backend_pid=$!

cleanup() {
  kill "$pulse_backend_pid" 2>/dev/null || true
  wait "$pulse_backend_pid" 2>/dev/null || true
}
trap cleanup EXIT

for _ in $(seq 1 20); do
  if curl --fail --silent http://127.0.0.1:3001/health >/dev/null; then
    npm run smoke:socket
    exit 0
  fi
  sleep 1
done

tail -80 /tmp/pulse-backend-emulator.log
exit 1
