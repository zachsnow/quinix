#! /usr/bin/env ts-node
import fs from 'fs';
import path from 'path';

import { logger, readFiles, InternalError } from '../src/lib/util';
import { parseArguments } from '../src/lib/cli';
import { LowLevelProgram } from '../src/lowlevel/lowlevel';
import { parse } from '../src/lowlevel/parser';
import { parse as parseType } from '../src/lowlevel/types-parser';
import { parse as parseExpression } from '../src/lowlevel/expressions-parser';
import { parse as parseStatement } from '../src/lowlevel/statements-parser';
import { Expression } from '../src/lowlevel/expressions';
import { Statement } from '../src/lowlevel/statements';

const log = logger('qllc');

///////////////////////////////////////////////////////////////////////
// Configure CLI.
///////////////////////////////////////////////////////////////////////
interface Options {
  output: string;
  files: string[];
  types: boolean;
  statements: boolean;
  library: boolean;
  module: string;
  namespace?: string;
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
      types: {
        describe: 'parse types separated by ;;',
        type: 'boolean',
        default: false,
      },
      expressions: {
        describe: 'parse expressions separated by ;;',
        type: 'boolean',
        default: false,
      },
      statements: {
        describe: 'parse statements separated by ;;',
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
  },
);

///////////////////////////////////////////////////////////////////////

function parseKind<T>(kind: string, programTexts: string[], parser: (text: string) => T, compiler?: (obj: T) => void){
  let anyErrors = false;
  const objectTexts = programTexts.join('\n').split(';;');
  objectTexts.forEach((text) => {
    text = text.trim();
    if(!text){
      return;
    }
    try {
      let obj = parser(text);
      if(compiler){
        compiler(obj);
      }
    }
    catch(e){
      anyErrors = true;

      if(e.location){
        console.error(`error: "${text}"[${e.location.start.column}:${e.location.end.column}]: ${e.message}`);
      }
      else {
        console.error(e);
      }
    }
  });

  process.exit(anyErrors ? -1 : 0);
}

async function main(): Promise<number | undefined>{
  // Parse.
  const filenames = argv.files;
  const programTexts = await readFiles(filenames);

  // 2a. Parsing tests.
  if(argv.types){
    parseKind('type', programTexts, parseType);
  }
  else if(argv.expressions){
    parseKind('expression', programTexts, parseExpression, (e) => {
      const assemblyProgram = Expression.compile(e);
      console.info(`compiled: ${assemblyProgram}`);
    });
  }
  else if(argv.statements){
    parseKind('statement', programTexts, parseStatement, (s) => {
      const assemblyProgram = Statement.compile(s);
      console.info(`compiled: ${assemblyProgram}`);
    });
  }

  // 2b. Parse program texts and combine.
  const programs: LowLevelProgram[] = programTexts.map((programText, i) => {
    return LowLevelProgram.parse(programText, filenames[i], argv.namespace);
  });
  const program = LowLevelProgram.concat(programs, argv.namespace);

  // 3. Typecheck.
  const messages = program.typecheck();
  if(messages.length){
    process.stderr.write(`${messages}\n`);
  }
  if(messages.errors.length){
    return -1;
  }

  log(`program:\n${program}\n`);


  // TODO: option to turn warnings into errors?

  // 4. Compile.
  const module = argv.module || path.basename(argv.output, path.extname(argv.output));
  const assemblyProgram = program.compile(module, !argv.library);
  log(`compiled:\n${assemblyProgram}\n`);

  // 5. Write.
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
