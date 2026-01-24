#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="${SCRIPT_DIR}/.."

# Build test programs
cd "${SCRIPT_DIR}/tests"
bash build.sh

# Build kernel
cd "${SCRIPT_DIR}"
bash build.sh

# Run kernel
cd "${SCRIPT_DIR}"
bun run "${ROOT_DIR}/bin/qvm.ts" kernel.qbin "$@"
