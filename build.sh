#!/usr/bin/env bash
set -euo pipefail

echo "Building assembly parser..."
npx tspegjs -o src/assembly/parser.ts --custom-header-file src/assembly/parser.prelude.ts src/assembly/parser.pegjs

echo "Building lowlevel parsers..."

# Create temp directory for concatenated grammar files
TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT

cat src/lowlevel/types-parser.pegjs src/lowlevel/base-parser.pegjs > "$TMPDIR/types.pegjs"
npx tspegjs --custom-header-file src/lowlevel/parser.prelude.ts \
    -o src/lowlevel/types-parser.ts \
    "$TMPDIR/types.pegjs"

cat src/lowlevel/expressions-parser.pegjs src/lowlevel/types-parser.pegjs src/lowlevel/base-parser.pegjs > "$TMPDIR/expressions.pegjs"
npx tspegjs --custom-header-file src/lowlevel/parser.prelude.ts \
    -o src/lowlevel/expressions-parser.ts \
    "$TMPDIR/expressions.pegjs"

cat src/lowlevel/statements-parser.pegjs src/lowlevel/expressions-parser.pegjs src/lowlevel/types-parser.pegjs src/lowlevel/base-parser.pegjs > "$TMPDIR/statements.pegjs"
npx tspegjs --custom-header-file src/lowlevel/parser.prelude.ts \
    -o src/lowlevel/statements-parser.ts \
    "$TMPDIR/statements.pegjs"

cat src/lowlevel/parser.pegjs src/lowlevel/statements-parser.pegjs src/lowlevel/expressions-parser.pegjs src/lowlevel/types-parser.pegjs src/lowlevel/base-parser.pegjs > "$TMPDIR/parser.pegjs"
npx tspegjs --custom-header-file src/lowlevel/parser.prelude.ts \
    -o src/lowlevel/parser.ts \
    "$TMPDIR/parser.pegjs"

echo "Compiling..."
npx tsc # For typechecking code that we don't build, e.g. tests.

echo "Building executables..."
npx tsc --build tsconfig.build.json
chmod u+x build/bin/*

echo "Skipping building library..."
# tsc --build tsconfig.lib.json

echo "Building libraries..."
(cd lib && ./build.sh "--compiled")

echo "Skipping kernel (known issues)..."
# (cd kernel && ./build.sh "--compiled")
