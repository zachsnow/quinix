# build.sh: builds the system runtime and standard library.
set -euo pipefail

# Make sure we have an output directory.
mkdir -p bin

QLLC_PATH="../bin/qllc.ts"
if [ "${1-}" == "--compiled" ]; then
  QLLC_PATH="../build/bin/qllc.js"
fi

echo "Compiling system..."
${QLLC_PATH} --library -o bin/system.qasm system.qll

echo "Compiling lib..."
${QLLC_PATH} --library -o bin/lib.qasm lib.qll

