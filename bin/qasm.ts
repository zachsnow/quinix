#! /usr/bin/env bun
import fs from "fs";
import path from "path";

import { AssemblyProgram } from "@/assembly/assembly";
import { logger } from "@/lib/logger";
import { InternalError } from "@/lib/util";
import { parseArguments } from "@server/cli";
import { readFiles } from "@server/fs";

const log = logger("qasm");

///////////////////////////////////////////////////////////////////////
// Configure CLI.
///////////////////////////////////////////////////////////////////////
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
if (!["bare", "user", "none"].includes(argv.target)) {
  console.error(`Error: Invalid target "${argv.target}". Must be bare, user, or none.`);
  process.exit(1);
}

///////////////////////////////////////////////////////////////////////

// Resolve the root directory (where shared/, bare/, user/ live).
function resolveRoot(): string {
  // We are in `./bin/`, running the TypeScript file directly with bun.
  let rootPath = path.resolve(__dirname, "..");
  if (!fs.existsSync(path.join(rootPath, "package.json"))) {
    rootPath = path.resolve(__dirname, "..", "..");
  }
  if (!fs.existsSync(path.join(rootPath, "package.json"))) {
    throw new InternalError("unable to locate project root");
  }
  return rootPath;
}

// Get all .qasm files from a directory.
function getQasmFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs.readdirSync(dir)
    .filter(f => f.endsWith(".qasm"))
    .map(f => path.join(dir, f))
    .sort();
}

// Get auto-include files for the given target.
function getTargetIncludes(target: string): string[] {
  if (target === "none") {
    return [];
  }

  const root = resolveRoot();
  const sharedFiles = getQasmFiles(path.join(root, "shared"));
  const targetFiles = getQasmFiles(path.join(root, target));

  return [...sharedFiles, ...targetFiles];
}

async function main(): Promise<number | undefined> {
  // Get auto-include files based on target (these go FIRST, especially entrypoint).
  const autoIncludes = getTargetIncludes(argv.target);

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
