#!/bin/bash
# Build the Quinix disk image
set -e

cd "$(dirname "$0")/.."

QLLC="bun run bin/qllc.ts"
QASM="bun run bin/qasm.ts"
QFS="bun run bin/qfs.ts"
QVM="bun run bin/qvm.ts"

# Clean and copy static data to dist.
rm -rf image/dist
cp -r image/data image/dist
mkdir -p image/dist/bin

echo "Building user programs..."

# Compile portable examples (examples/*.qll) and user-only examples (examples/user/*.qll).
for src in examples/*.qll examples/user/*.qll; do
  [ -f "$src" ] || continue
  name=$(basename "$src" .qll)
  echo "  $src -> bin/$name.qbin"

  # Compile QLL to QASM
  $QLLC --target=user "$src" -o "image/dist/bin/$name.qasm"

  # Assemble QASM to binary
  $QASM --target=user "image/dist/bin/$name.qasm" -o "image/dist/bin/$name.qbin"

  # Remove intermediate file
  rm "image/dist/bin/$name.qasm"
done

echo "Creating disk image..."

# Create QFS image from the dist directory
$QFS create image/disk.qfs --from image/dist

echo ""
echo "Done. Image: image/disk.qfs"
echo ""
$QFS list image/disk.qfs
echo ""
echo "To run: $QVM kernel/kernel.qbin --disk image/disk.qfs"
