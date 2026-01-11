#!/usr/bin/env bash
# build.sh: builds the system runtime and standard library.
set -euo pipefail

# Make sure we have an output directory.
mkdir -p bin

QLLC="npx ts-node ../bin/qllc.ts"
if [ "${1-}" == "--compiled" ]; then
  QLLC="node ../build/bin/qllc.js"
fi

echo "Compiling system..."
${QLLC} --library -o bin/system.qasm system.qll

echo "Compiling lib..."
${QLLC} --library -o bin/lib.qasm lib.qll

