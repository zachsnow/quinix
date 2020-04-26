#! /usr/bin/env ts-node
import fs from 'fs';

import { logger } from '../src/lib/util';
import { parseArguments } from '../src/lib/cli';
import { VM, Breakpoint } from '../src/vm/vm';
import { Memory, Address } from '../src/lib/base-types';
import { Program } from '../src/vm/instructions';

const log = logger('qvm');

///////////////////////////////////////////////////////////////////////
// Configure CLI.
///////////////////////////////////////////////////////////////////////
interface Options {
  binary: string;
  cycles?: number;
  break: string;
  'break-write': string;
}

const argv = parseArguments<Options>(
  'qvm',
  '$0 [binary]',
  'execute the given binary',
  {
    options:{
      cycles: {
        alias: 'c',
        describe: 'halt after number of cycles',
        type: 'number',
      },
      break: {
        alias: 'b',
        describe: 'break on address',
        type: 'string',
        default: '',
      },
      'break-write': {
        alias: 'w',
        describe: 'break on write',
        type: 'string',
        default: '',
      },
    },
    positional: {
      name: 'binary',
      describe: 'the binary to execute',
      type: 'string',
      demandOption: false,
    },
    loggers: ['qvm', 'vm', 'vm:debugger'],
  },
);

const breakpoints: Breakpoint[] = [];
if(argv.break){
  breakpoints.push({
    type: 'execute',
    address: Address.parse(argv.break),
  });
}
if(argv['break-write']){
  breakpoints.push({
    type: 'write',
    address: Address.parse(argv['break-write']),
  });
}

///////////////////////////////////////////////////////////////////////

// 1. Load file as binary, if passed. Otherwise just loads `halt`.
const filename = argv.binary;
let programData: Memory;
if(!filename){
  programData = new Memory();
}
else {
  const buffer = fs.readFileSync(filename);
  programData = Memory.fromBuffer(buffer);
}
log(`loaded binary:\n${programData}\n`);

// 2. Print decoded program.
const program = Program.decode(programData);
log(`decoded program:\n${program}\n`);

// 3. Run program.
const vm = new VM({
  debug: argv.verbose,
  breakpoints: breakpoints,
  cycles: argv.cycles,
});

vm.run(programData).then((r) => {
  log(`terminated: ${r}`);
  process.exit(r);
}, (e) => {
  log(`error: ${e}`);
  if(argv.verbose){
    log(`${e.stack}`);
  }
  process.exit(-1);
});
