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
  BlockDevicePeripheral,
  DebugBreakPeripheral,
  DebugFilePeripheral,
  DebugInputPeripheral,
  DebugOutputPeripheral,
  FileBlockStorage,
} from "@server/peripherals";
import { Peripheral, TimerPeripheral } from "@/vm/peripherals";
import { Breakpoint, VM, Watchpoint } from "@/vm/vm";

const log = logger("qvm");

///////////////////////////////////////////////////////////////////////
// Configure CLI.
///////////////////////////////////////////////////////////////////////
interface Options {
  binary: string;
  cycles?: string;
  size?: string;
  disk?: string;
  break: string;
  "break-write": string;
  watchpoint: string;
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
      size: {
        alias: "m",
        describe: "memory size in bytes (e.g. 0x100000 for 1MB)",
        type: "string",
      },
      disk: {
        alias: "d",
        describe: "QFS disk image file",
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
      watchpoint: {
        alias: "W",
        describe: "watch physical address range for writes (e.g. 0x2-0x43)",
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

const watchpoints: Watchpoint[] = [];
if (argv.watchpoint) {
  // Parse range format: 0x2-0x43 or 0x42 for single address
  const parts = argv.watchpoint.split("-");
  const low = Address.parse(parts[0]);
  const high = parts.length > 1 ? Address.parse(parts[1]) : low + 1;
  watchpoints.push({
    low,
    high,
    type: "write",
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

// 3. Create block device if disk image provided.
let blockDevice: BlockDevicePeripheral | null = null;
if (argv.disk) {
  const diskPath = argv.disk;
  const stat = fs.statSync(diskPath);
  const sectorSize = 128; // words per sector
  const sectorBytes = sectorSize * 4; // 512 bytes per sector
  const totalSectors = Math.floor(stat.size / sectorBytes);

  if (totalSectors < 1) {
    console.error(`error: disk image too small (${stat.size} bytes)`);
    process.exit(1);
  }

  log.debug(`disk: ${diskPath} (${totalSectors} sectors)`);
  const storage = new FileBlockStorage(diskPath, totalSectors, sectorSize);
  blockDevice = new BlockDevicePeripheral(storage, sectorSize);
}

// 4. Run program.
const peripherals: Peripheral[] = [
  new TimerPeripheral(),
  new DebugBreakPeripheral(),
  new DebugOutputPeripheral(),
  new DebugInputPeripheral(),
  new DebugFilePeripheral(filename ? path.dirname(filename) : "."),
];
if (blockDevice) {
  peripherals.push(blockDevice);
}

const vm = new VM({
  debug: argv.verbose,
  breakpoints: breakpoints,
  watchpoints: watchpoints,
  cycles: argv.cycles ? parseInt(argv.cycles, 10) : undefined,
  size: argv.size ? parseInt(argv.size, 10) : undefined,
  debuggerFactory: (vm, state, memory) => {
    return new Debugger(vm, state, memory);
  },
  peripherals,
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
