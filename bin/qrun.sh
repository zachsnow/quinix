#! /usr/bin/env sh
set -euo pipefail

C_ARGS=( "$1" )
VM_ARGS=( "out.qbin" )
if [ "$1" == "-v" ]; then
    C_ARGS=( "-v" "$2" )
    VM_ARGS=( "-v" "out.qbin")
fi

echo "Compiling..."
./bin/qllc.ts ${C_ARGS[@]}
echo "Assembling..."
./bin/qasm.ts "out.qasm"
echo "Executing..."
./bin/qvm.ts "${VM_ARGS[@]}"
