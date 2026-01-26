set -euo pipefail

QLLC_PATH="../bin/qllc.ts"
QASM_PATH="../bin/qasm.ts"
if [ "${1-}" == "--compiled" ]; then
  QLLC_PATH="../build/bin/qllc.js"
  QASM_PATH="../build/bin/qasm.js"
fi

echo "Compiling kernel..."
${QLLC_PATH} --target=none kernel.qll alloc.qll support.qll scheduler.qll peripherals.qll process.qll memory.qll fs.qll syscall.qll console.qll shell.qll block.qll ../shared/std.qll ../shared/alloc.qll ../shared/buffered.qll

echo "Assembling kernel..."
${QASM_PATH} --target=none -o kernel.qbin out.qasm support.qasm
