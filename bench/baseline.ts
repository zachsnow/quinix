#!/usr/bin/env bun
/**
 * Baseline performance test - how fast can we iterate over a Uint32Array
 * and call a simple function for each element?
 *
 * Includes periodic await to simulate VM's peripheral yield behavior.
 */

const ITERATIONS = 5;
const ARRAY_SIZE = 3_640_049;  // Match our benchmark cycle count
const YIELD_FREQUENCY = 10000;  // Yield every N iterations (matches VM peripheralFrequency)

// Simple function to simulate minimal per-element work
function process(value: number): number {
  return (value + 1) >>> 0;
}

// Minimal async yield
function release(): Promise<void> {
  return new Promise((resolve) => queueMicrotask(resolve));
}

async function runOnce(arr: Uint32Array): Promise<{ timeMs: number; sum: number }> {
  let sum = 0;
  const start = performance.now();
  for (let i = 0; i < arr.length; i++) {
    sum = (sum + process(arr[i])) >>> 0;
    if (i % YIELD_FREQUENCY === 0) {
      await release();
    }
  }
  const end = performance.now();
  return { timeMs: end - start, sum };
}

async function main() {
  console.log(`Baseline: ${ARRAY_SIZE.toLocaleString()} iterations (yield every ${YIELD_FREQUENCY.toLocaleString()})\n`);

  const arr = new Uint32Array(ARRAY_SIZE);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = i;
  }

  // Warmup
  console.log("Warmup...");
  await runOnce(arr);

  // Benchmark
  console.log(`Running ${ITERATIONS} iterations...\n`);
  const times: number[] = [];

  for (let i = 0; i < ITERATIONS; i++) {
    const result = await runOnce(arr);
    times.push(result.timeMs);
    const rate = ARRAY_SIZE / (result.timeMs / 1000) / 1_000_000;
    console.log(`  [${i + 1}] ${result.timeMs.toFixed(2)}ms (${rate.toFixed(2)} M ops/sec)`);
  }

  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const avgRate = ARRAY_SIZE / (avg / 1000) / 1_000_000;
  console.log(`\nAverage: ${avg.toFixed(2)}ms (${avgRate.toFixed(2)} M ops/sec)`);
}

main();
