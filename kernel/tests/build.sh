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

    cd "${ROOT_DIR}"

    # Compile with --target=user (auto-includes shared/*.qll and user/*.qll)
    bun run bin/qllc.ts --target=user -o "${SCRIPT_DIR}/${basename}.qasm" "${SCRIPT_DIR}/${program}"

    # Assemble with --target=user (auto-includes user/*.qasm for entrypoint and syscalls)
    bun run bin/qasm.ts --target=user -o "${SCRIPT_DIR}/${output}" "${SCRIPT_DIR}/${basename}.qasm"

    # Clean up intermediate file
    rm "${SCRIPT_DIR}/${basename}.qasm"

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
