#!/usr/bin/env bash
set -euo pipefail

# Helper function to run peggy with ts-pegjs and custom header
run_peggy() {
    local header_file=$1
    local output=$2
    shift 2
    local inputs=("$@")

    local header
    header=$(cat "$header_file")
    local header_json
    header_json=$(echo "$header" | jq -Rs .)

    bun node_modules/.bin/peggy --plugin ts-pegjs \
        --extra-options "{\"tspegjs\": {\"customHeader\": $header_json, \"skipTypeComputation\": true}}" \
        -o "$output" "${inputs[@]}"
}

echo "Building assembly parser..."
run_peggy src/assembly/parser.prelude.ts src/assembly/parser.ts src/assembly/parser.pegjs

echo "Building lowlevel parsers..."

# Create temp directory for concatenated grammar files
TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT

cat src/lowlevel/types-parser.pegjs src/lowlevel/base-parser.pegjs > "$TMPDIR/types.pegjs"
run_peggy src/lowlevel/parser.prelude.ts src/lowlevel/types-parser.ts "$TMPDIR/types.pegjs"

cat src/lowlevel/expressions-parser.pegjs src/lowlevel/types-parser.pegjs src/lowlevel/base-parser.pegjs > "$TMPDIR/expressions.pegjs"
run_peggy src/lowlevel/parser.prelude.ts src/lowlevel/expressions-parser.ts "$TMPDIR/expressions.pegjs"

cat src/lowlevel/statements-parser.pegjs src/lowlevel/expressions-parser.pegjs src/lowlevel/types-parser.pegjs src/lowlevel/base-parser.pegjs > "$TMPDIR/statements.pegjs"
run_peggy src/lowlevel/parser.prelude.ts src/lowlevel/statements-parser.ts "$TMPDIR/statements.pegjs"

cat src/lowlevel/parser.pegjs src/lowlevel/statements-parser.pegjs src/lowlevel/expressions-parser.pegjs src/lowlevel/types-parser.pegjs src/lowlevel/base-parser.pegjs > "$TMPDIR/parser.pegjs"
run_peggy src/lowlevel/parser.prelude.ts src/lowlevel/parser.ts "$TMPDIR/parser.pegjs"

echo "Type checking core (no platform deps)..."
bunx tsc -p tsconfig.core.json --noEmit

echo "Type checking browser..."
bunx tsc -p tsconfig.browser.json --noEmit

echo "Type checking server..."
bunx tsc -p tsconfig.server.json --noEmit

echo "Building libraries..."
(cd lib && ./build.sh)

echo "Type checking std.bare.qll..."
bun run qllc --library --strict lib/std.bare.qll

echo "Building browser bundle..."
mkdir -p build
bun build src/platform/browser/index.ts --target=browser --format=esm --outfile=build/quinix.js

echo "Building CLI tools..."
for tool in qasm qllc qrun qvm; do
    bun build "bin/${tool}.ts" --target=bun --outfile="build/${tool}"
    chmod +x "build/${tool}"
done

echo "Done."
