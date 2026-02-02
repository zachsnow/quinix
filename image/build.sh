#!/bin/bash
# Build the Quinix disk image
set -e

cd "$(dirname "$0")/.."

QLLC="bun run bin/qllc.ts"
QASM="bun run bin/qasm.ts"
QFS="bun run bin/qfs.ts"
QVM="bun run bin/qvm.ts"

# Clean and copy data to dist.
rm -rf image/dist
cp -r image/data image/dist

echo "Building user programs..."

# Find and compile all .qll files in dist.
find image/dist -name '*.qll' | while read src; do
  dir=$(dirname "$src")
  name=$(basename "$src" .qll)
  echo "  $src"

  # Compile QLL to QASM
  $QLLC --target=user "$src" -o "$dir/$name.qasm"

  # Assemble QASM to binary
  $QASM --target=user "$dir/$name.qasm" -o "$dir/$name.qbin"

  # Remove source and intermediate files
  rm "$src" "$dir/$name.qasm"
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
