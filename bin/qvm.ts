#! /usr/bin/env bun
import fs from "fs";
import path from "path";

import { logger } from "@/lib/logger";
import { Address, Memory } from "@/lib/types";
import { Compiler } from "@/lowlevel/compiler";
import { Program } from "@/vm/instructions";
import { parseArguments } from "@server/cli";
import { Debugger } from "@server/debugger";
import {
  DebugBreakPeripheral,
  DebugFilePeripheral,
  DebugInputPeripheral,
  DebugOutputPeripheral,
} from "@server/peripherals";
import { TimerPeripheral } from "@/vm/peripherals";
import { Breakpoint, VM } from "@/vm/vm";

const log = logger("qvm");

///////////////////////////////////////////////////////////////////////
// Configure CLI.
///////////////////////////////////////////////////////////////////////
interface Options {
  binary: string;
  cycles?: string;
  break: string;
  "break-write": string;
  stats: boolean;
}

const argv = parseArguments<Options>(
  "qvm",
  "$0 [binary]",
  "execute the given binary",
  {
    options: {
      cycles: {
        alias: "c",
        describe: "halt after number of cycles",
        type: "string",
      },
      break: {
        alias: "b",
        describe: "break on address",
        type: "string",
        default: "",
      },
      "break-write": {
        alias: "w",
        describe: "break on write",
        type: "string",
        default: "",
      },
      stats: {
        alias: "s",
        describe: "display statistics",
        type: "boolean",
        default: false,
      },
    },
    positional: {
      name: "binary",
      describe: "the binary to execute",
      type: "string",
      demandOption: false,
    },
  }
);

const breakpoints: Breakpoint[] = [];
if (argv.break) {
  breakpoints.push({
    type: "execute",
    address: Address.parse(argv.break),
  });
}
if (argv["break-write"]) {
  breakpoints.push({
    type: "write",
    address: Address.parse(argv["break-write"]),
  });
}

///////////////////////////////////////////////////////////////////////

// 1. Load file as binary, if passed. Otherwise just loads `halt`.
const filename = argv.binary;
let programData: Memory;
if (!filename) {
  programData = new Memory();
} else {
  if (!filename.endsWith(".qbin")) {
    console.warn(`warning: non-standard extension ${path.extname(filename)}`);
  }
  const buffer = fs.readFileSync(filename);
  programData = Memory.fromBytes(buffer);
}
log.debug(`loaded binary:\n${programData}\n`);

// 2. Print decoded program.
const program = Program.decode(programData);
log.debug(`decoded program:\n${program}\n`);

// 3. Run program.
const vm = new VM({
  debug: argv.verbose,
  breakpoints: breakpoints,
  cycles: argv.cycles ? parseInt(argv.cycles, 10) : undefined,
  debuggerFactory: (vm, state, memory) => {
    return new Debugger(vm, state, memory);
  },
  peripherals: [
    new TimerPeripheral(),
    new DebugBreakPeripheral(),
    new DebugOutputPeripheral(),
    new DebugInputPeripheral(),
    new DebugFilePeripheral(),
  ],
});

vm.run(programData)
  .then(
    (r) => {
      log.debug(`terminated: ${r}`);
      switch (r) {
        case Compiler.NULL_ERROR:
          console.error("error: NULL_ERROR");
          break;
        case Compiler.BOUNDS_ERROR:
          console.error("error: BOUNDS_ERROR");
          break;
        case Compiler.CAPACITY_ERROR:
          console.error("error: CAPACITY_ERROR");
          break;
      }
      return Promise.resolve(r);
    },
    (e) => {
      log.debug(`error: ${e}`);
      if (argv.verbose) {
        log.debug(`${e.stack}`);
      }
      return Promise.resolve(-1);
    }
  )
  .then((r) => {
    if (argv.stats) {
      console.info(`\nVM statistics:\n${vm.stats}`);
    }
    process.exit(r);
  });

process.on("SIGINT", function () {
  vm.kill();
});
