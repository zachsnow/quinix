#! /usr/bin/env bun
import fs from "fs";
import { $ } from "bun";

import { Memory } from "@/lib/types";
import { Compiler } from "@/lowlevel/compiler";
import {
  ClockPeripheral,
  DisplayPeripheral,
  Peripheral,
  TimerPeripheral,
} from "@/vm/peripherals";
import { VM } from "@/vm/vm";
import {
  DebugBreakPeripheral,
  DebugOutputPeripheral,
  DebugInputPeripheral,
  DebugFilePeripheral,
  KeypressPeripheral,
} from "@server/peripherals";
import { createSDLRenderer } from "@server/sdl-renderer";
import { createFileRenderer } from "@server/file-renderer";
import { Debugger } from "@server/debugger";
import { parseArguments } from "@server/cli";

interface Options {
  file: string;
  verbose: boolean;
  cycles?: string;
  display?: string;
  "display-scale"?: string;
  "display-file"?: string;
  keyboard: boolean;
}

const argv = parseArguments<Options>(
  "qrun",
  "$0 <file>",
  "compile and run the given file; uses --target=bare",
  {
    options: {
      verbose: {
        alias: "v",
        describe: "verbose output",
        type: "boolean",
        default: false,
      },
      cycles: {
        alias: "c",
        describe: "halt after number of cycles",
        type: "string",
      },
      display: {
        alias: "D",
        describe: "enable display peripheral (WIDTHxHEIGHT, e.g. 320x200)",
        type: "string",
      },
      "display-scale": {
        describe: "display window scale factor (default: 2)",
        type: "string",
      },
      "display-file": {
        describe: "write display to PPM file instead of SDL window",
        type: "string",
      },
      keyboard: {
        alias: "k",
        describe: "enable keyboard peripheral (requires --display)",
        type: "boolean",
        default: false,
      },
    },
    positional: {
      name: "file",
      type: "string",
      describe: "the source file to run",
      demandOption: true,
    },
  }
);

async function main(): Promise<number> {
  const file = argv.file;
  const verbose = argv.verbose;

  // 1. Compile QLL to QASM.
  console.log("Compiling...");
  const compileArgs = verbose ? ["-v", file] : [file];
  const compileResult = await $`bun run bin/qllc.ts ${compileArgs}`
    .quiet()
    .nothrow();
  if (compileResult.exitCode !== 0) {
    console.error(compileResult.stderr.toString());
    return compileResult.exitCode;
  }

  // 2. Assemble QASM to binary.
  console.log("Assembling...");
  const asmResult = await $`bun run bin/qasm.ts out.qasm`.quiet().nothrow();
  if (asmResult.exitCode !== 0) {
    console.error(asmResult.stderr.toString());
    return asmResult.exitCode;
  }

  // 3. Run the binary in-process.
  console.log("Executing...");
  const programData = Memory.fromBytes(fs.readFileSync("out.qbin"));

  // Create keyboard peripheral if requested.
  let keypressPeripheral: KeypressPeripheral | null = null;
  if (argv.keyboard) {
    keypressPeripheral = new KeypressPeripheral();
  }

  // Create display peripheral if enabled.
  let displayCleanup: (() => void) | null = null;
  let displayPeripheral: DisplayPeripheral | null = null;
  if (argv.display) {
    const match = argv.display.match(/^(\d+)x(\d+)$/);
    if (!match) {
      console.error(
        "error: display format should be WIDTHxHEIGHT (e.g. 320x200)"
      );
      return 1;
    }
    const width = parseInt(match[1], 10);
    const height = parseInt(match[2], 10);

    if (argv["display-file"]) {
      const renderer = createFileRenderer(argv["display-file"]);
      displayPeripheral = new DisplayPeripheral(width, height, renderer);
    } else {
      const scale = argv["display-scale"]
        ? parseInt(argv["display-scale"], 10)
        : 2;
      try {
        const { renderer, cleanup } = createSDLRenderer(
          "Quinix Display",
          scale,
          keypressPeripheral?.onKeyState
        );
        displayCleanup = cleanup;
        displayPeripheral = new DisplayPeripheral(width, height, renderer);
      } catch (e) {
        console.error(`error: failed to initialize display: ${e}`);
        console.error("hint: make sure SDL2 is installed (brew install sdl2)");
        return 1;
      }
    }
  }

  // Build peripheral array.
  const peripherals: Peripheral[] = [
    new TimerPeripheral(),
    new ClockPeripheral(),
    new DebugBreakPeripheral(),
    new DebugOutputPeripheral(),
    new DebugInputPeripheral(),
    new DebugFilePeripheral("."),
  ];
  if (displayPeripheral) {
    peripherals.push(displayPeripheral);
  }
  if (keypressPeripheral) {
    if (!displayPeripheral) {
      console.error("error: --keyboard requires --display");
      return 1;
    }
    peripherals.push(keypressPeripheral);
  }

  // Create and run VM.
  const vm = new VM({
    debug: verbose,
    cycles: argv.cycles ? parseInt(argv.cycles, 10) : undefined,
    debuggerFactory: (vm, state, memory) => {
      return new Debugger(vm, state, memory);
    },
    peripherals,
  });

  process.on("SIGINT", () => {
    vm.kill();
    if (displayCleanup) {
      displayCleanup();
    }
  });

  try {
    const r = await vm.run(programData);
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
    if (displayCleanup) {
      displayCleanup();
    }
    return r;
  } catch (e) {
    if (verbose) {
      console.error(`error: ${e}`);
    }
    if (displayCleanup) {
      displayCleanup();
    }
    return -1;
  }
}

main()
  .then((code) => {
    process.exit(code);
  })
  .catch((e) => {
    console.error(`error: ${e}`);
    process.exit(-1);
  });
