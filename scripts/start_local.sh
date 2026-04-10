#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  echo ""
  echo "Shutting down dev servers..."
  if [[ -n "${BACKEND_PID}" ]] && kill -0 "${BACKEND_PID}" 2>/dev/null; then
    kill "${BACKEND_PID}" 2>/dev/null || true
  fi
  if [[ -n "${FRONTEND_PID}" ]] && kill -0 "${FRONTEND_PID}" 2>/dev/null; then
    kill "${FRONTEND_PID}" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

if [[ ! -d "${ROOT_DIR}/.venv" ]]; then
  echo "Missing Python virtual environment at .venv"
  echo "Run: python3 -m venv .venv && source .venv/bin/activate && pip install -r backend/requirements.txt"
  exit 1
fi

if [[ ! -d "${ROOT_DIR}/frontend/node_modules" ]]; then
  echo "Missing frontend dependencies"
  echo "Run: cd frontend && npm install"
  exit 1
fi

echo "Starting backend on http://localhost:8000 ..."
(
  cd "${ROOT_DIR}/backend"
  source "${ROOT_DIR}/.venv/bin/activate"
  if [[ -f .env ]]; then
    set -a
    source .env
    set +a
  fi
  uvicorn main:app --reload --port 8000
) &
BACKEND_PID=$!

echo "Starting frontend on http://localhost:5173 ..."
(
  cd "${ROOT_DIR}/frontend"
  npm run dev
) &
FRONTEND_PID=$!

echo ""
echo "Dev stack started"
echo "- Backend:  http://localhost:8000"
echo "- Frontend: http://localhost:5173"
echo "Press Ctrl+C in this terminal to stop both"
echo ""

wait "${BACKEND_PID}" "${FRONTEND_PID}"
