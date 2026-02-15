#!/usr/bin/env bun
/**
 * Regenerate bench/bench.json by running each benchmark multiple times
 * and recording deterministic cycle counts and best wall-clock times.
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

    const best = Math.min(...times);
    benchmarks[name] = { cycles, bestMs: Math.round(best * 10) / 10 };
    console.log(`  best: ${best.toFixed(1)}ms`);
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

    const best = Math.min(...times);
    benchmarks[name] = { cycles, bestMs: Math.round(best * 10) / 10 };
    console.log(`  best: ${best.toFixed(1)}ms`);
  }

  const baseline: Baseline = { benchmarks };
  saveBaseline(baseline);
  console.log('\nWrote bench/bench.json');

  process.stdin.destroy();
}

main().catch((e) => {
  console.error(e);
  throw e;
});
