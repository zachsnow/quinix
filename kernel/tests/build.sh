#!/bin/bash
set -euo pipefail

# Build user test programs for the kernel
# Usage: ./build.sh <program.qll> [output-name]

if [ $# -lt 1 ]; then
  echo "Usage: $0 <program.qll> [output-name]"
  exit 1
fi

PROGRAM="$1"
BASENAME=$(basename "$PROGRAM" .qll)
OUTPUT="${2:-$BASENAME}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/../.."

echo "Compiling $PROGRAM..."
cd "$ROOT_DIR"
bun run bin/qllc.ts "$SCRIPT_DIR/$PROGRAM" lib/lib.qll lib/system.qll lib/std.qll lib/std.bare.qll

echo "Assembling..."
bun run bin/qasm.ts --nosystem -o "$SCRIPT_DIR/$OUTPUT" out.qasm lib/support.qasm

echo "Built: $SCRIPT_DIR/$OUTPUT"
