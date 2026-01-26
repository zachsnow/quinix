#! /usr/bin/env bun
import fs from "fs";
import path from "path";

import { logger } from "@/lib/logger";
import { InternalError } from "@/lib/util";
import { LowLevelProgram } from "@/lowlevel/lowlevel";
import { parseArguments } from "@server/cli";
import { readFiles } from "@server/fs";

const log = logger("qllc");

///////////////////////////////////////////////////////////////////////
// Configure CLI.
///////////////////////////////////////////////////////////////////////
interface Options {
  output: string;
  files: string[];
  target: string;
  module: string;
  strict: boolean;
}

const argv = parseArguments<Options>(
  "qllc",
  "$0 <files..>",
  "compile the given files",
  {
    options: {
      output: {
        alias: "o",
        describe: "output path",
        type: "string",
        default: "out.qasm",
        demandOption: false,
      },
      target: {
        alias: "t",
        describe: "target: bare, user, or none",
        type: "string",
        default: "bare",
      },
      module: {
        describe: "module name",
        type: "string",
        default: "",
      },
      strict: {
        describe: "treat warnings as errors",
        type: "boolean",
        default: false,
      },
    },
    positional: {
      name: "files",
      type: "string",
      describe: "the source files to compile",
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

// Get all .qll files from a directory.
function getQllFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs.readdirSync(dir)
    .filter(f => f.endsWith(".qll"))
    .map(f => path.join(dir, f))
    .sort();
}

// Get auto-include files for the given target.
function getTargetIncludes(target: string): string[] {
  if (target === "none") {
    return [];
  }

  const root = resolveRoot();
  const sharedFiles = getQllFiles(path.join(root, "shared"));
  const targetFiles = getQllFiles(path.join(root, target));

  return [...sharedFiles, ...targetFiles];
}

async function main(): Promise<number | undefined> {
  // Get auto-include files based on target.
  const autoIncludes = getTargetIncludes(argv.target);

  // Parse programs and combine (auto-includes first, then user files).
  const filenames = [...autoIncludes, ...argv.files];
  const programTexts = await readFiles(filenames);
  const programs: LowLevelProgram[] = programTexts.map((programText, i) => {
    return LowLevelProgram.parse(programText, filenames[i]);
  });
  const program = LowLevelProgram.concat(programs);

  // Typecheck.
  const messages = program.typecheck();
  if (messages.length) {
    process.stderr.write(`${messages}\n`);
  }
  if (messages.errors.length) {
    return -1;
  }
  if (argv.strict && messages.warnings.length) {
    return -1;
  }

  // Compile.
  const module =
    argv.module || path.basename(argv.output, path.extname(argv.output));
  const assemblyProgram = program.compile(module);
  log.debug(`compiled:\n${assemblyProgram}\n`);

  // Emit compiled code.
  fs.writeFileSync(argv.output, assemblyProgram.toString(true));
}

main()
  .then((r) => {
    process.exit(r || 0);
  })
  .catch((e) => {
    if (e instanceof InternalError) {
      // Compiler error.
      console.error(`error: ${e.message}\n${e.stack}`);
    } else if (e.location) {
      // Syntax error.
      console.error(
        `error: ${e.location.filename}(${e.location.start.line})[${e.location.start.column}]: ${e.message}`
      );
    } else {
      // Uknown error.
      console.error(`error: unknown: ${e}\n${e.stack}`);
    }
    process.exit(-1);
  });
