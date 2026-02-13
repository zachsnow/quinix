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

async function main(): Promise<number> {
  const file = argv.file;
  const verbose = argv.verbose;

  console.log("Compiling...");
  const compileArgs = verbose ? ["-v", file] : [file];
  const compileResult = await $`bun run bin/qllc.ts ${compileArgs}`.quiet();
  if (compileResult.exitCode !== 0) {
    console.error(compileResult.stderr.toString());
    return compileResult.exitCode;
  }

  console.log("Assembling...");
  const asmResult = await $`bun run bin/qasm.ts out.qasm`.quiet();
  if (asmResult.exitCode !== 0) {
    console.error(asmResult.stderr.toString());
    return asmResult.exitCode;
  }

  console.log("Executing...");
  const vmArgs = verbose ? ["-v", "out.qbin", ...extraArgs] : ["out.qbin", ...extraArgs];
  const proc = Bun.spawn(["bun", "run", "bin/qvm.ts", ...vmArgs], {
    stdio: ["inherit", "inherit", "inherit"],
  });
  process.on("SIGINT", () => {
    proc.kill("SIGINT");
  });
  return await proc.exited;
}

main()
  .then((code) => {
    process.exit(code);
  })
  .catch((e) => {
    console.error(`error: ${e}`);
    process.exit(-1);
  });
