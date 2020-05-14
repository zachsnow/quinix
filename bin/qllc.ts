#! /usr/bin/env ts-node
import fs from 'fs';
import path from 'path';

import { logger, readFiles, InternalError } from '../src/lib/util';
import { parseArguments } from '../src/lib/cli';
import { LowLevelProgram } from '../src/lowlevel/lowlevel';

const log = logger('qllc');

///////////////////////////////////////////////////////////////////////
// Configure CLI.
///////////////////////////////////////////////////////////////////////
interface Options {
  output: string;
  files: string[];
  library: boolean;
  module: string;
  namespace?: string;
  strict: boolean;
}

const argv = parseArguments<Options>(
  'qllc',
  '$0 <files..>',
  'compile the given files',
  {
    options: {
      output: {
        alias: 'o',
        describe: 'output path',
        type: 'string',
        default: 'out.qasm',
        demandOption: false,
      },
      library: {
        describe: 'compile as a library; exclude entrypoint',
        type: 'boolean',
        default: false,
      },
      module: {
        describe: 'module name',
        type: 'string',
        default: '',
      },
      namespace: {
        describe: 'the global namespace',
        type: 'string',
      },
      strict: {
        describe: 'treat warnings as errors',
        type: 'boolean',
        default: false,
      },
    },
    positional: {
      name: 'files',
      type: 'string',
      describe: 'the source files to compile',
      array: true,
      demandOption: true,
    },
    loggers: ['qllc', 'lowlevel'],
  },
);

///////////////////////////////////////////////////////////////////////

async function main(): Promise<number | undefined>{
  // Parse programs and combine.
  const filenames = argv.files;
  const programTexts = await readFiles(filenames);
  const programs: LowLevelProgram[] = programTexts.map((programText, i) => {
    return LowLevelProgram.parse(programText, filenames[i], argv.namespace);
  });
  const program = LowLevelProgram.concat(programs, argv.namespace);

  // Typecheck.
  const messages = program.typecheck();
  if(messages.length){
    process.stderr.write(`${messages}\n`);
  }
  if(messages.errors.length){
    return -1;
  }
  if(argv.strict && messages.warnings.length){
    return -1;
  }

  // Compile.
  const module = argv.module || path.basename(argv.output, path.extname(argv.output));
  const assemblyProgram = program.compile(module, !argv.library);
  log(`compiled:\n${assemblyProgram}\n`);

  // Emit compiled code.
  fs.writeFileSync(argv.output, assemblyProgram.toString(true));
}

main().then((r) => {
  process.exit(r || 0);
}).catch((e) => {
  if(e instanceof InternalError){
    // Compiler error.
    console.error(`error: ${e.message}\n${e.stack}`);
  }
  else if(e.location){
    // Syntax error.
    console.error(`error: ${e.location.filename}(${e.location.start.line})[${e.location.start.column}]: ${e.message}`);
  }
  else {
    // Uknown error.
    console.error(`error: unknown: ${e}\n${e.stack}`);
  }
  process.exit(-1);
});
