#!/usr/bin/env bun
/**
 * Benchmark runner for Quinix VM.
 *
 * CLI usage:
 *   bun run bench/bench.ts           — run benchmarks, diff against committed baseline
 *   bun run bench/bench.ts --update  — regenerate bench/bench.json
 *
 * Also exports helpers for bench.test.ts.
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

import { Memory } from '@/lib/types';
import { VM } from '@/vm/vm';
import { ClockPeripheral, Peripheral, TimerPeripheral } from '@/vm/peripherals';
import {
  BlockDevicePeripheral,
  DebugBreakPeripheral,
  DebugFilePeripheral,
  DebugInputPeripheral,
  DebugOutputPeripheral,
  FileBlockStorage,
} from '@/platform/server/peripherals';
import { SECTOR_SIZE_WORDS, sectorsFromFileSize } from '@/platform/server/qfs';
import { compileQLLToBinary } from '@/tests/helpers';

// === Constants ===

const BENCH_DIR = path.resolve(__dirname);
const KERNEL_BIN = path.resolve(__dirname, '..', 'kernel', 'kernel.qbin');
const DISK_IMAGE = path.resolve(__dirname, '..', 'image', 'disk.qfs');
const BASELINE_PATH = path.join(BENCH_DIR, 'bench.json');

export const KERNEL_MAX_CYCLES = 5_000_000;
export const BENCH_RUNS = 5;
export const QLL_BENCHMARKS = ['compute', 'memory'] as const;

// === Types ===

export interface BenchResult {
  cycles: number;
  timeMs: number;
}

export interface BaselineEntry {
  cycles: number;
  bestMs: number;
}

export interface Baseline {
  benchmarks: Record<string, BaselineEntry>;
}

// === Runner ===

export function compileBench(name: string): Uint32Array {
  const file = path.join(BENCH_DIR, `${name}.qll`);
  const source = fs.readFileSync(file, 'utf-8');
  const result = compileQLLToBinary(source, { filename: file });
  if (!result.success || !result.binary) {
    throw new Error(`Failed to compile ${name}: ${result.errors.join('\n')}`);
  }
  return result.binary;
}

export async function runBenchmark(binary: Uint32Array, maxCycles?: number): Promise<BenchResult> {
  const peripherals: Peripheral[] = [
    new TimerPeripheral(),
    new ClockPeripheral(),
    new DebugBreakPeripheral(),
    new DebugOutputPeripheral(),
  ];

  const vm = new VM({
    debug: false,
    peripherals,
    cycles: maxCycles,
  });

  const start = performance.now();
  await vm.run(binary);
  const end = performance.now();

  return { cycles: vm.stats.cycles, timeMs: end - start };
}

/**
 * Run the kernel binary as a benchmark. The kernel boots, enters the shell,
 * receives "exit" on stdin, and halts. With cycle-based peripherals the
 * cycle count is fully deterministic.
 */
export async function runKernelBenchmark(maxCycles: number): Promise<BenchResult> {
  const kernelBytes = fs.readFileSync(KERNEL_BIN);
  const binary = Memory.fromBytes(new Uint8Array(kernelBytes));

  const stat = fs.statSync(DISK_IMAGE);
  const totalSectors = sectorsFromFileSize(stat.size);
  const storage = new FileBlockStorage(DISK_IMAGE, totalSectors, SECTOR_SIZE_WORDS);

  const peripherals: Peripheral[] = [
    new TimerPeripheral(),
    new ClockPeripheral(),
    new DebugBreakPeripheral(),
    new DebugOutputPeripheral(),
    new DebugInputPeripheral(['exit']),
    new DebugFilePeripheral(path.dirname(KERNEL_BIN)),
    new BlockDevicePeripheral(storage, SECTOR_SIZE_WORDS),
  ];

  const vm = new VM({
    debug: false,
    peripherals,
    cycles: maxCycles,
  });

  const start = performance.now();
  await vm.run(binary);
  const end = performance.now();

  return { cycles: vm.stats.cycles, timeMs: end - start };
}

// === Baseline I/O ===

export function loadBaseline(): Baseline | null {
  if (!fs.existsSync(BASELINE_PATH)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf-8'));
}

export function loadCommittedBaseline(): Baseline | null {
  try {
    const json = execSync('git show HEAD:bench/bench.json', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function saveBaseline(baseline: Baseline): void {
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n');
}

// === Formatting ===

function formatMHz(cycles: number, ms: number): string {
  return (cycles / (ms / 1000) / 1_000_000).toFixed(2);
}

function formatPct(current: number, baseline: number): string {
  const pct = ((current - baseline) / baseline) * 100;
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

// === CLI: run ===

function printResult(name: string, result: BenchResult, entry: BaselineEntry | undefined) {
  console.log(`--- ${name} ---`);
  console.log(`  ${result.cycles.toLocaleString()} cycles  ${result.timeMs.toFixed(1)}ms  ${formatMHz(result.cycles, result.timeMs)} MHz`);

  if (entry) {
    console.log(`  baseline: ${entry.cycles.toLocaleString()} cycles  ${entry.bestMs}ms`);

    if (result.cycles !== entry.cycles) {
      const delta = result.cycles - entry.cycles;
      const sign = delta > 0 ? '+' : '';
      console.log(`  cycles: CHANGED ${sign}${delta.toLocaleString()} (${formatPct(result.cycles, entry.cycles)})`);
    } else {
      console.log(`  cycles: match`);
    }

    console.log(`  timing: ${formatPct(result.timeMs, entry.bestMs)}`);
  }
  console.log();
}

async function run() {
  const baseline = loadCommittedBaseline();
  if (!baseline) {
    console.log('No committed bench.json found. Run `bun run bench:update` and commit.\n');
  }

  for (const name of QLL_BENCHMARKS) {
    const binary = compileBench(name);
    const result = await runBenchmark(binary);
    printResult(name, result, baseline?.benchmarks[name]);
  }

  const kernelResult = await runKernelBenchmark(KERNEL_MAX_CYCLES);
  printResult('kernel-boot', kernelResult, baseline?.benchmarks['kernel-boot']);

  process.stdin.destroy();
}

// === CLI: update ===

async function update() {
  const benchmarks: Record<string, BaselineEntry> = {};

  for (const name of QLL_BENCHMARKS) {
    console.log(`\n--- ${name} ---`);
    const binary = compileBench(name);
    const times: number[] = [];
    let cycles = 0;

    for (let i = 0; i < BENCH_RUNS; i++) {
      const result = await runBenchmark(binary);
      cycles = result.cycles;
      times.push(result.timeMs);
      console.log(`  [${i + 1}] ${result.cycles.toLocaleString()} cycles, ${result.timeMs.toFixed(1)}ms (${formatMHz(result.cycles, result.timeMs)} MHz)`);
    }

    const best = Math.min(...times);
    benchmarks[name] = { cycles, bestMs: Math.round(best * 10) / 10 };
    console.log(`  best: ${best.toFixed(1)}ms`);
  }

  {
    const name = 'kernel-boot';
    console.log(`\n--- ${name} ---`);
    const times: number[] = [];
    let cycles = 0;

    for (let i = 0; i < BENCH_RUNS; i++) {
      const result = await runKernelBenchmark(KERNEL_MAX_CYCLES);
      cycles = result.cycles;
      times.push(result.timeMs);
      console.log(`  [${i + 1}] ${result.cycles.toLocaleString()} cycles, ${result.timeMs.toFixed(1)}ms (${formatMHz(result.cycles, result.timeMs)} MHz)`);
    }

    const best = Math.min(...times);
    benchmarks[name] = { cycles, bestMs: Math.round(best * 10) / 10 };
    console.log(`  best: ${best.toFixed(1)}ms`);
  }

  saveBaseline({ benchmarks });
  console.log('\nWrote bench/bench.json');

  process.stdin.destroy();
}

// === Main ===

const isMain = process.argv[1]?.endsWith('bench.ts') && !process.argv[1]?.endsWith('bench.test.ts');
if (isMain) {
  const doUpdate = process.argv.includes('--update');
  (doUpdate ? update : run)().catch((e) => {
    console.error(e);
    throw e;
  });
}
