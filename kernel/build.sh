set -euo pipefail

QLLC_PATH="../bin/qllc.ts"
QASM_PATH="../bin/qasm.ts"
if [ "${1-}" == "--compiled" ]; then
  QLLC_PATH="../build/bin/qllc.js"
  QASM_PATH="../build/bin/qasm.js"
fi

echo "Compiling test kernel..."
${QLLC_PATH} test-kernel.qll support.qll

echo "Assembling test kernel..."
${QASM_PATH} -o test-kernel.qbin out.qasm support.qasm

echo "Compiling kernel..."
${QLLC_PATH} kernel.qll support.qll scheduler.qll peripherals.qll

echo "Assembling kernel..."
${QASM_PATH} -o kernel.qbin out.qasm support.qasm
