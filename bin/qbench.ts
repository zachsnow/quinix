#! /usr/bin/env bun
/**
 * Performance benchmark harness for Quinix VM.
 * Compiles and runs a QLL program, reporting timing and instruction counts.
 */
import fs from "fs";
import path from "path";

import { logger } from "@/lib/logger";
import { Memory } from "@/lib/types";
import { LowLevelProgram } from "@/lowlevel/lowlevel";
import { AssemblyProgram } from "@/assembly/assembly";
import { getTargetIncludes, parseArguments } from "@server/cli";
import {
  DebugBreakPeripheral,
  DebugOutputPeripheral,
} from "@server/peripherals";
import { ClockPeripheral, Peripheral, TimerPeripheral } from "@/vm/peripherals";
import { VM } from "@/vm/vm";
import { readFiles } from "@server/fs";

const log = logger("qbench");

interface Options {
  file: string;
  iterations: number;
  warmup: number;
}

const argv = parseArguments<Options>(
  "qbench",
  "$0 <file>",
  "benchmark a QLL program",
  {
    options: {
      iterations: {
        alias: "n",
        describe: "number of benchmark iterations",
        type: "string",
        default: "5",
      },
      warmup: {
        alias: "w",
        describe: "number of warmup iterations",
        type: "string",
        default: "1",
      },
    },
    positional: {
      name: "file",
      type: "string",
      describe: "the QLL source file to benchmark",
      demandOption: true,
    },
  }
);

interface BenchResult {
  cycles: number;
  timeMs: number;
  cyclesPerSecond: number;
  exitCode: number;
}

async function runOnce(binary: Memory): Promise<BenchResult> {
  const peripherals: Peripheral[] = [
    new TimerPeripheral(),
    new ClockPeripheral(),
    new DebugBreakPeripheral(),
    new DebugOutputPeripheral(),
  ];

  const vm = new VM({
    debug: false,
    peripherals,
  });

  const start = performance.now();
  const exitCode = await vm.run(binary);
  const end = performance.now();

  const timeMs = end - start;
  const cycles = vm.stats.cycles;
  const cyclesPerSecond = cycles / (timeMs / 1000);

  return { cycles, timeMs, cyclesPerSecond, exitCode };
}

async function compileAndAssemble(file: string): Promise<Memory> {
  // Get auto-include files for bare target
  const autoIncludes = getTargetIncludes("bare", ".qll");
  const filenames = [...autoIncludes, file];

  // Parse QLL programs
  const programTexts = await readFiles(filenames);
  const programs: LowLevelProgram[] = programTexts.map((programText, i) => {
    return LowLevelProgram.parse(programText, filenames[i]);
  });
  const program = LowLevelProgram.concat(programs);

  // Typecheck
  const messages = program.typecheck();
  if (messages.errors.length) {
    throw new Error(`Typecheck failed:\n${messages}`);
  }

  // Compile to assembly
  const module = path.basename(file, path.extname(file));
  const assemblyProgram = program.compile(module);

  // Get auto-include assembly files for bare target
  const asmAutoIncludes = getTargetIncludes("bare", ".qasm");
  const asmTexts = await readFiles(asmAutoIncludes);
  const asmPrograms: AssemblyProgram[] = asmTexts.map((text, i) => {
    return AssemblyProgram.parse(text, asmAutoIncludes[i]);
  });

  // Combine: auto-includes first, then compiled program
  const combined = AssemblyProgram.concat([...asmPrograms, assemblyProgram]);

  // Assemble to binary
  const [asmMessages, binaryProgram] = combined.assemble();
  if (!binaryProgram) {
    throw new Error(`Assembly failed:\n${asmMessages}`);
  }

  return binaryProgram.encode();
}

async function main(): Promise<number> {
  const file = argv.file;
  const iterations = parseInt(argv.iterations as unknown as string, 10);
  const warmup = parseInt(argv.warmup as unknown as string, 10);

  // Compile
  console.log(`Compiling ${file}...`);
  let binary: Memory;
  try {
    binary = await compileAndAssemble(file);
  } catch (e: any) {
    console.error(e.message);
    return 1;
  }
  console.log(`Binary size: ${binary.length * 4} bytes\n`);

  // Warmup
  if (warmup > 0) {
    console.log(`Warmup (${warmup} iteration${warmup > 1 ? "s" : ""})...`);
    for (let i = 0; i < warmup; i++) {
      await runOnce(binary);
    }
  }

  // Benchmark
  console.log(`Running ${iterations} iteration${iterations > 1 ? "s" : ""}...\n`);
  const results: BenchResult[] = [];

  for (let i = 0; i < iterations; i++) {
    const result = await runOnce(binary);
    results.push(result);
    console.log(
      `  [${i + 1}] ${result.cycles.toLocaleString()} cycles in ${result.timeMs.toFixed(2)}ms ` +
      `(${(result.cyclesPerSecond / 1_000_000).toFixed(2)} MHz) exit=${result.exitCode}`
    );
  }

  // Statistics
  const times = results.map((r) => r.timeMs);
  const rates = results.map((r) => r.cyclesPerSecond);
  const cycles = results[0].cycles;

  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);

  const avgRate = rates.reduce((a, b) => a + b, 0) / rates.length;
  const minRate = Math.min(...rates);
  const maxRate = Math.max(...rates);

  console.log("\n--- Results ---");
  console.log(`Cycles:     ${cycles.toLocaleString()}`);
  console.log(`Time:       ${avgTime.toFixed(2)}ms avg (${minTime.toFixed(2)}ms - ${maxTime.toFixed(2)}ms)`);
  console.log(`Throughput: ${(avgRate / 1_000_000).toFixed(2)} MHz avg (${(minRate / 1_000_000).toFixed(2)} - ${(maxRate / 1_000_000).toFixed(2)} MHz)`);

  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    console.error(`error: ${e}`);
    if (e.stack) {
      console.error(e.stack);
    }
    process.exit(1);
  });
