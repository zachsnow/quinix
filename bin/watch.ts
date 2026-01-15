#!/usr/bin/env bun
import { watch } from 'fs';
import { spawn } from 'child_process';

let buildProcess: ReturnType<typeof spawn> | null = null;
let debounceTimer: Timer | null = null;

function runBuild() {
  if (buildProcess) {
    console.log('\nKilling previous build...');
    buildProcess.kill();
    buildProcess = null;
  }

  console.log('\nRunning build...');
  buildProcess = spawn('./build.sh', [], {
    stdio: 'inherit',
    shell: true,
  });

  buildProcess.on('exit', (code) => {
    buildProcess = null;
    if (code === 0) {
      console.log('\nBuild completed successfully. Watching for changes...');
    } else {
      console.log(`\nBuild failed with code ${code}. Watching for changes...`);
    }
  });
}

function debouncedBuild() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    runBuild();
  }, 100);
}

const watchPaths = ['src', 'lib', 'bin'];
const watchExtensions = ['.ts', '.pegjs', '.qll', '.qasm'];

console.log('Watching for changes in:', watchPaths.join(', '));
console.log('Watching extensions:', watchExtensions.join(', '));

for (const path of watchPaths) {
  watch(path, { recursive: true }, (event, filename) => {
    if (filename && watchExtensions.some(ext => filename.endsWith(ext))) {
      console.log(`\nChange detected: ${filename}`);
      debouncedBuild();
    }
  });
}

console.log('\nRunning initial build...');
runBuild();
