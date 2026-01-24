#!/bin/bash
set -euo pipefail

# Build all user test programs for the kernel
# Usage: ./build.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="${SCRIPT_DIR}/../.."

build_program() {
    local program="$1"
    local basename="${program%.qll}"
    local output="${basename}.qbin"

    echo "Building ${program}..."

    # Compile
    cd "${ROOT_DIR}"
    bun run bin/qllc.ts --library "${SCRIPT_DIR}/${program}" lib/lib.qll lib/system.qll lib/std.qll lib/std.bare.qll

    # Assemble
    bun run bin/qasm.ts --nosystem -o "${SCRIPT_DIR}/${output}" lib/user.qasm out.qasm lib/support.qasm

    # Verify output is binary, not text
    if file "${SCRIPT_DIR}/${output}" | grep -q "text"; then
        echo "ERROR: ${output} is text, not binary!"
        exit 1
    fi

    echo "Built: ${output}"
}

# Build all .qll files in the tests directory
build_program "hello-a.qll"
build_program "hello-b.qll"

echo "All test programs built."
