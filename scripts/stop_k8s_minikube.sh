#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "${ROOT_DIR}"
echo "Deleting Kubernetes resources..."
kubectl delete -f k8s/frontend.yaml -f k8s/backend.yaml --ignore-not-found
