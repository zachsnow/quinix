#! /usr/bin/env bun
import { $ } from "bun";
import { parseArguments } from "@server/cli";

interface Options {
  file: string;
  verbose: boolean;
  "--": string[];
}

const argv = parseArguments<Options>(
  "qrun",
  "$0 <file> [-- <qvm-args...>]",
  "compile and run the given file; uses --target=bare",
  {
    options: {
      verbose: {
        alias: "v",
        describe: "verbose output",
        type: "boolean",
        default: false,
      },
    },
    positional: {
      name: "file",
      type: "string",
      describe: "the source file to run",
      demandOption: true,
    },
  }
);

// Get any extra args after -- to pass to qvm
const extraArgs = argv["--"] || [];

const file = argv.file;
const verbose = argv.verbose;

console.log("Compiling...");
const compileArgs = verbose ? ["-v", file] : [file];
const compileResult = await $`bun run bin/qllc.ts ${compileArgs}`.quiet();
if (compileResult.exitCode !== 0) {
  console.error(compileResult.stderr.toString());
  process.exit(compileResult.exitCode);
}

console.log("Assembling...");
const asmResult = await $`bun run bin/qasm.ts out.qasm`.quiet();
if (asmResult.exitCode !== 0) {
  console.error(asmResult.stderr.toString());
  process.exit(asmResult.exitCode);
}

console.log("Executing...");
// Re-write process.argv so qvm.ts parses the right arguments,
// then import it directly. This keeps SDL in the same process,
// which is required on macOS for window creation.
const vmArgs = verbose ? ["-v", "out.qbin", ...extraArgs] : ["out.qbin", ...extraArgs];
process.argv = [process.argv[0], "bin/qvm.ts", ...vmArgs];
await import("./qvm.ts");
