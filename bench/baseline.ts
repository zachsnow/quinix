#!/usr/bin/env bun
/**
 * Baseline performance test - how fast can we iterate over a Uint32Array
 * and call a simple function for each element?
 *
 * Includes periodic await to simulate VM's peripheral yield behavior.
 * Compares against VM benchmark timings from baseline.json if available.
 */
import { loadBaseline } from './runner';

const ITERATIONS = 5;
const ARRAY_SIZE = 3_640_049;  // Match our benchmark cycle count
const YIELD_FREQUENCY = 10000;  // Yield every N iterations (matches VM peripheralFrequency)

// Simple function to simulate minimal per-element work
function step(value: number): number {
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
    sum = (sum + step(arr[i])) >>> 0;
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

  const sorted = [...times].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const medianMs = sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
  const medianRate = ARRAY_SIZE / (medianMs / 1000) / 1_000_000;
  console.log(`\nMedian: ${medianMs.toFixed(2)}ms (${medianRate.toFixed(2)} M ops/sec)`);

  // Compare against VM benchmark timings.
  const baseline = loadBaseline();
  if (baseline) {
    console.log('\n--- vs VM benchmarks (from baseline.json) ---');
    for (const [name, entry] of Object.entries(baseline.benchmarks)) {
      const overhead = entry.medianMs / medianMs;
      console.log(`  ${name.padEnd(14)} ${entry.medianMs}ms VM / ${medianMs.toFixed(1)}ms native = ${overhead.toFixed(2)}x overhead`);
    }
  }
}

main();
