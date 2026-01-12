#! /usr/bin/env bun
import fs from 'fs';
import path from 'path';

import { logger } from '../src/lib/util';
import { parseArguments } from '../src/lib/cli';
import { VM, Breakpoint } from '../src/vm/vm';
import { Memory, Address } from '../src/lib/base-types';
import { Program } from '../src/vm/instructions';
import { Compiler } from '../src/lowlevel/compiler';

const log = logger('qvm');

///////////////////////////////////////////////////////////////////////
// Configure CLI.
///////////////////////////////////////////////////////////////////////
interface Options {
  binary: string;
  cycles?: string;
  break: string;
  'break-write': string;
  stats: boolean;
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
        type: 'string',
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
      stats: {
        alias: 's',
        describe: 'display statistics',
        type: 'boolean',
        default: false,
      }
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
  if(!filename.endsWith('.qbin')){
    console.warn(`warning: non-standard extension ${path.extname(filename)}`);
  }
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
  cycles: argv.cycles ? parseInt(argv.cycles, 10) : undefined,
});

vm.run(programData).then((r) => {
  log(`terminated: ${r}`);
  switch(r){
    case Compiler.NULL_ERROR:
      console.error('error: NULL_ERROR');
      break;
    case Compiler.BOUNDS_ERROR:
      console.error('error: BOUNDS_ERROR');
      break;
    case Compiler.CAPACITY_ERROR:
      console.error('error: CAPACITY_ERROR');
      break;
  }
  return Promise.resolve(r);
}, (e) => {
  log(`error: ${e}`);
  if(argv.verbose){
    log(`${e.stack}`);
  }
  return Promise.resolve(-1);
}).then((r) => {
  if(argv.stats){
    console.info(`\nVM statistics:\n${vm.stats}`);
  }
  process.exit(r);
});

process.on('SIGINT', function() {
  vm.kill();
});
