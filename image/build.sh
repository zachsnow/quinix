#!/bin/bash
# Build the Quinix disk image
set -e

cd "$(dirname "$0")/.."

QLLC="bun run bin/qllc.ts"
QASM="bun run bin/qasm.ts"
QFS="bun run bin/qfs.ts"
QVM="bun run bin/qvm.ts"

echo "Building user programs..."

# Create output directory for compiled binaries
mkdir -p image/dist/bin

# Copy text files to dist
cp image/*.txt image/dist/ 2>/dev/null || true

# Compile and assemble each program
for src in image/bin/*.qll; do
  name=$(basename "$src" .qll)
  echo "  $name"

  # Compile QLL to QASM
  $QLLC --target=user "$src" -o "image/dist/bin/$name.qasm"

  # Assemble QASM to binary
  $QASM --target=user "image/dist/bin/$name.qasm" -o "image/dist/bin/$name.qbin"

  # Remove intermediate .qasm file
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
