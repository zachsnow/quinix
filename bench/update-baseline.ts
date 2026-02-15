#!/usr/bin/env bun
/**
 * Regenerate bench/baseline.json by running each benchmark multiple times
 * and recording deterministic cycle counts and median wall-clock times.
 */
import {
  compileBench,
  runBenchmark,
  runKernelBenchmark,
  saveBaseline,
  type Baseline,
  type BaselineEntry,
} from './runner';

const ITERATIONS = 5;
const KERNEL_MAX_CYCLES = 5_000_000;

const QLL_BENCHMARKS = ['compute', 'memory'] as const;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

async function main() {
  const benchmarks: Record<string, BaselineEntry> = {};

  for (const name of QLL_BENCHMARKS) {
    console.log(`\n--- ${name} ---`);
    const binary = compileBench(name);
    const times: number[] = [];
    let cycles = 0;

    for (let i = 0; i < ITERATIONS; i++) {
      const result = await runBenchmark(binary);
      cycles = result.cycles;
      times.push(result.timeMs);
      const mhz = (result.cycles / (result.timeMs / 1000) / 1_000_000).toFixed(2);
      console.log(`  [${i + 1}] ${result.cycles.toLocaleString()} cycles, ${result.timeMs.toFixed(1)}ms (${mhz} MHz)`);
    }

    const med = median(times);
    benchmarks[name] = { cycles, medianMs: Math.round(med * 10) / 10 };
    console.log(`  median: ${med.toFixed(1)}ms`);
  }

  // Kernel benchmark.
  {
    const name = 'kernel-boot';
    console.log(`\n--- ${name} ---`);
    const times: number[] = [];
    let cycles = 0;

    for (let i = 0; i < ITERATIONS; i++) {
      const result = await runKernelBenchmark(KERNEL_MAX_CYCLES);
      cycles = result.cycles;
      times.push(result.timeMs);
      const mhz = (result.cycles / (result.timeMs / 1000) / 1_000_000).toFixed(2);
      console.log(`  [${i + 1}] ${result.cycles.toLocaleString()} cycles, ${result.timeMs.toFixed(1)}ms (${mhz} MHz)`);
    }

    const med = median(times);
    benchmarks[name] = { cycles, medianMs: Math.round(med * 10) / 10 };
    console.log(`  median: ${med.toFixed(1)}ms`);
  }

  const baseline: Baseline = { benchmarks };
  saveBaseline(baseline);
  console.log('\nWrote bench/baseline.json');
}

main().catch((e) => {
  console.error(e);
  throw e;
});
