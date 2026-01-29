#! /usr/bin/env bun
import fs from "fs";

import { AssemblyProgram } from "@/assembly/assembly";
import { logger } from "@/lib/logger";
import { getTargetIncludes, isValidTarget, parseArguments } from "@server/cli";
import { readFiles } from "@server/fs";

const log = logger("qasm");

interface Options {
  output: string;
  assemble: boolean;
  target: string;
  files: string[];
}

const argv = parseArguments<Options>(
  "qasm",
  "$0 <files..>",
  "assemble and link the given files",
  {
    options: {
      output: {
        alias: "o",
        describe: "output path",
        type: "string",
        default: "out.qbin",
      },
      assemble: {
        alias: "a",
        describe: "output assembly, not binary",
        type: "boolean",
        default: false,
      },
      target: {
        alias: "t",
        describe: "target: bare, user, or none",
        type: "string",
        default: "bare",
      },
    },
    positional: {
      name: "files",
      describe: "the source files to assemble",
      type: "string",
      array: true,
      demandOption: true,
    },
  }
);

// Validate target
if (!isValidTarget(argv.target)) {
  console.error(`Error: Invalid target "${argv.target}". Must be bare, user, or none.`);
  process.exit(1);
}

///////////////////////////////////////////////////////////////////////

async function main(): Promise<number | undefined> {
  // Get auto-include files based on target (these go FIRST, especially entrypoint).
  const autoIncludes = getTargetIncludes(argv.target, ".qasm");

  // Combine: auto-includes first, then user files.
  const filenames = [...autoIncludes, ...argv.files];

  // Parse.
  const programTexts = await readFiles(filenames);
  const assemblyPrograms: AssemblyProgram[] = programTexts.map(
    (programText, i) => {
      return AssemblyProgram.parse(programText, filenames[i]);
    }
  );

  // Build.
  const assemblyProgram = AssemblyProgram.concat(assemblyPrograms);
  log.debug(`assembly program:\n${assemblyProgram}\n`);

  // Assemble.
  const [messages, program] = assemblyProgram.assemble();
  if (!program) {
    process.stderr.write(`${messages || "internal error"}\n`);
    return -1;
  }

  log.debug(`assembled program:\n${program}\n`);

  // Output.
  if (!argv.assemble) {
    await fs.promises.writeFile(argv.output, program.encode().toBytes());
    return;
  } else {
    // HACK: nicer default filename.
    const output = argv.output === "out.qbin" ? "out.qasm" : argv.output;
    await fs.promises.writeFile(output, assemblyProgram.toAssembly(), "utf-8");
    return;
  }
}

main()
  .then((r) => {
    process.exit(r || 0);
  })
  .catch((e) => {
    if (e.location) {
      console.error(
        `${e.location.filename}(${e.location.start.line}): ${e.message}`
      );
    } else {
      console.error(e);
    }
    process.exit(-1);
  });
