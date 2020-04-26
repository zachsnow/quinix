set -euo pipefail

echo "Building assembly parser..."
tspegjs -o src/assembly/parser.ts --custom-header-file src/assembly/parser.prelude.ts src/assembly/parser.pegjs

echo "Building lowlevel parsers..."
tspegjs --custom-header-file src/lowlevel/parser.prelude.ts \
    -o src/lowlevel/types-parser.ts \
    <(cat src/lowlevel/types-parser.pegjs src/lowlevel/base-parser.pegjs)

tspegjs --custom-header-file src/lowlevel/parser.prelude.ts \
    -o src/lowlevel/expressions-parser.ts \
    <(cat src/lowlevel/expressions-parser.pegjs src/lowlevel/types-parser.pegjs src/lowlevel/base-parser.pegjs)

tspegjs --custom-header-file src/lowlevel/parser.prelude.ts \
    -o src/lowlevel/statements-parser.ts \
    <(cat src/lowlevel/statements-parser.pegjs src/lowlevel/expressions-parser.pegjs src/lowlevel/types-parser.pegjs src/lowlevel/base-parser.pegjs)

tspegjs --custom-header-file src/lowlevel/parser.prelude.ts \
    -o src/lowlevel/parser.ts \
    <(cat src/lowlevel/parser.pegjs src/lowlevel/statements-parser.pegjs src/lowlevel/expressions-parser.pegjs src/lowlevel/types-parser.pegjs src/lowlevel/base-parser.pegjs)

echo "Compiling..."
tsc # For typechecking code that we don't build, e.g. tests.

echo "Building executables..."
tsc --build tsconfig.build.json
chmod u+x build/bin/*

echo "Building Quinix library..."
tsc --build tsconfig.lib.json

echo "Building libraries..."
(cd lib && ./build.sh "--compiled")

echo "Building kernel..."
(cd kernel && ./build.sh "--compiled")
