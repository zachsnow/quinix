#!/usr/bin/env bash
# build.sh: builds the usermode library components.
set -euo pipefail

mkdir -p bin

QLLC="bun run ../bin/qllc.ts"

echo "Compiling lib (syscalls)..."
${QLLC} --library -o bin/lib.qasm lib.qll

echo "Compiling usermode allocator..."
${QLLC} --library -o bin/alloc.qasm alloc.qll ../shared/alloc.qll

echo "Compiling usermode console..."
${QLLC} --library -o bin/console.qasm console.qll lib.qll
