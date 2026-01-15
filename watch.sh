#!/usr/bin/env bash
set -euo pipefail

./build.sh

echo "Watching..."
fswatch src lib bin | while read -r file; do
  echo "Change detected: $file"
  ./build.sh
done
