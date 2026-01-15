#!/usr/bin/env bash
set -euo pipefail

./build.sh

echo "Watching..."
fswatch -e "parser\\.ts$" -e "lib/bin/" src lib bin | while read -r file; do
  echo "Change detected: $file"
  ./build.sh
done
