#!/usr/bin/env bash
set -euo pipefail

echo "Watching src/, lib/, bin/ for changes..."
echo "Extensions: .ts, .pegjs, .qll, .qasm"
echo ""
echo "Running initial build..."
./build.sh

echo ""
echo "Watching for changes..."
fswatch -e ".*" -i "\\.ts$" -i "\\.pegjs$" -i "\\.qll$" -i "\\.qasm$" src lib bin | while read -r file; do
  echo ""
  echo "Change detected: $file"
  echo "Running build..."
  ./build.sh
done
