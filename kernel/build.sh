set -euo pipefail

QLLC_PATH="../bin/qllc.ts"
QASM_PATH="../bin/qasm.ts"
if [ "${1-}" == "--compiled" ]; then
  QLLC_PATH="../build/bin/qllc.js"
  QASM_PATH="../build/bin/qasm.js"
fi

echo "Compiling test kernel..."
${QLLC_PATH} test-kernel.qll

echo "Assembling kernel..."
${QASM_PATH} out.qasm support.qasm
