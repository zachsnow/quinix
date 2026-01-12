#! /usr/bin/env bun
import fs from 'fs';
import path from 'path';

import { logger, readFiles, parseFile, InternalError } from '../src/lib/util';
import { parseArguments } from '../src/lib/cli';
import { AssemblyProgram } from '../src/assembly/assembly';
import { parse, SyntaxError } from '../src/assembly/parser';

const log = logger('qasm');

///////////////////////////////////////////////////////////////////////
// Configure CLI.
///////////////////////////////////////////////////////////////////////
interface Options {
  output: string;
  assemble: boolean;
  std: boolean;
  nosystem: boolean;
  files: string[];
}

const argv = parseArguments<Options>('qasm',
  '$0 <files..>',
  'assemble and link the given files',
  {
    options: {
      output: {
        alias: 'o',
        describe: 'output path',
        type: 'string',
        default: 'out.qbin',
      },
      assemble: {
        alias: 'a',
        describe: 'output assembly, not binary',
        type: 'boolean',
        default: false,
      },
      std: {
        describe: "include the standard library; it doesn't do much yet",
        type: 'boolean',
        default: false,
      },
      nosystem: {
        describe: 'do not include the system runtime',
        type: 'boolean',
        default: false,
      },
    },
    positional: {
      name: 'files',
      describe: 'the source files to assemble',
      type: 'string',
      array: true,
      demandOption: true,
    },
  },
);

///////////////////////////////////////////////////////////////////////
let libraryPath: string | undefined = undefined;
function resolveLibrary(filename: string){
  if(!libraryPath){
    // We are either in `./bin/`, because we are running the Typescript
    // file directly with ts-node, or we are in `./build/bin/`, because
    // we are running a build.
    libraryPath = path.resolve(__dirname, '..');
    if(!fs.existsSync(path.join(libraryPath, 'package.json'))){
      libraryPath = path.resolve(__dirname, '..', '..');
    }
    if(!fs.existsSync(path.join(libraryPath, 'package.json'))){
      throw new InternalError('unable to locate library');
    }
    libraryPath = path.join(libraryPath, 'lib', 'bin');
  }

  const fullPath = path.join(libraryPath, filename);
  if(!fs.existsSync(fullPath)){
    throw new Error(`unable to locate library ${filename}; library path ${libraryPath}`);
  }

  return fullPath;
}

async function main(): Promise<number | undefined> {
  const filenames = argv.files;

  if(argv.std){
    filenames.push(resolveLibrary('std.qasm'));
  }
  if(!argv.nosystem){
    filenames.push(resolveLibrary('system.qasm'));
  }

  // Parse.
  const programTexts = await readFiles(filenames);
  const assemblyPrograms: AssemblyProgram[] = programTexts.map((programText, i) => {
    return AssemblyProgram.parse(programText, filenames[i]);
  });

  // Build.
  const assemblyProgram = AssemblyProgram.concat(assemblyPrograms);
  log(`assembly program:\n${assemblyProgram}\n`);

  // Assemble.
  const [messages, program] = assemblyProgram.assemble();
  if(!program){
    process.stderr.write(`${messages || 'internal error'}\n`);
    return -1;
  }

  log(`assembled program:\n${program}\n`);

  // Output.
  if(!argv.assemble){
    await fs.promises.writeFile(argv.output, program.encode().toBuffer());
    return;
  }
  else {
    // HACK: nicer default filename.
    const output = argv.output === 'out.qbin' ? 'out.qasm' : argv.output;
    await fs.promises.writeFile(output, assemblyProgram.toAssembly(), 'utf-8');
    return;
  }
}

main().then((r) => {
  process.exit(r || 0);
}).catch((e) => {
  if(e.location){
    console.error(`${e.location.filename}(${e.location.start.line}): ${e.message}`);
  }
  else {
    console.error(e);
  }
  process.exit(-1);
});
