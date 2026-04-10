#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: bash scripts/generate_admin_hash.sh '<plain_password>'"
  exit 1
fi

password="$1"
hash=$(printf '%s' "$password" | shasum -a 256 | awk '{print $1}')

echo "sha256\$$hash"
