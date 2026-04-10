#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! command -v minikube >/dev/null 2>&1; then
  echo "minikube not found. Install minikube to use this one-click Kubernetes flow."
  exit 1
fi

if ! command -v kubectl >/dev/null 2>&1; then
  echo "kubectl not found. Install kubectl to use this one-click Kubernetes flow."
  exit 1
fi

cd "${ROOT_DIR}"

echo "Ensuring minikube is running..."
minikube start

echo "Building local images inside minikube..."
minikube image build -t marketanalysis-backend:local -f backend/Dockerfile backend
minikube image build -t marketanalysis-frontend:local -f frontend/Dockerfile frontend

echo "Applying Kubernetes manifests..."
kubectl apply -f k8s/backend.yaml
kubectl apply -f k8s/frontend.yaml

echo "Starting backend port-forward on localhost:8000 ..."
kubectl port-forward svc/smpa-backend 8000:8000 >/tmp/smpa-k8s-portforward.log 2>&1 &
PF_PID=$!

echo ""
echo "Kubernetes stack started"
echo "- Frontend: http://$(minikube ip):30517"
echo "- Backend:  http://localhost:8000 (via port-forward)"
echo "- Port-forward PID: ${PF_PID}"
echo ""
echo "To stop:"
echo "1) kill ${PF_PID}"
echo "2) kubectl delete -f k8s/frontend.yaml -f k8s/backend.yaml"
