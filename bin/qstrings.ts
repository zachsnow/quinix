#! /usr/bin/env bun
import fs from "fs";
import path from "path";

import { Memory } from "@/lib/types";
import { parseArguments } from "@server/cli";

///////////////////////////////////////////////////////////////////////
// Configure CLI.
///////////////////////////////////////////////////////////////////////
interface Options {
  binary: string;
  minLength: string;
}

const argv = parseArguments<Options>(
  "qstrings",
  "$0 <binary>",
  "extract strings from a binary file",
  {
    options: {
      minLength: {
        alias: "n",
        describe: "minimum string length",
        type: "string",
        default: "4",
      },
    },
    positional: {
      name: "binary",
      describe: "the binary file to analyze",
      type: "string",
      demandOption: true,
    },
  }
);

///////////////////////////////////////////////////////////////////////

const minLength = parseInt(argv.minLength, 10);

function isPrintableAscii(codepoint: number): boolean {
  // Printable ASCII range: space (0x20) to tilde (0x7E)
  // Also allow common control chars: tab (0x09), newline (0x0A), carriage return (0x0D)
  return (
    (codepoint >= 0x20 && codepoint <= 0x7e) ||
    codepoint === 0x09 ||
    codepoint === 0x0a ||
    codepoint === 0x0d
  );
}

function formatString(codepoints: number[]): string {
  return codepoints
    .map((c) => {
      if (c === 0x0a) {
        return "\\n";
      }
      if (c === 0x0d) {
        return "\\r";
      }
      if (c === 0x09) {
        return "\\t";
      }
      return String.fromCodePoint(c);
    })
    .join("");
}

function main(): number {
  const filename = argv.binary;

  if (!filename.endsWith(".qbin")) {
    console.warn(`warning: non-standard extension ${path.extname(filename)}`);
  }

  const buffer = fs.readFileSync(filename);
  const memory = Memory.fromBytes(buffer);

  // Scan for strings. Strings are stored as:
  // [capacity: u32] [length: u32] [codepoints: u32 * length]
  // For string literals, capacity == length.
  let i = 0;
  while (i < memory.length - 2) {
    const capacity = memory[i];
    const length = memory[i + 1];

    // Check if this looks like a string header:
    // - capacity == length (typical for literals)
    // - length is reasonable (>= minLength, not huge)
    // - enough data remaining
    if (
      capacity === length &&
      length >= minLength &&
      length < 10000 &&
      i + 2 + length <= memory.length
    ) {
      // Check if all following codepoints are printable ASCII
      let isString = true;
      const codepoints: number[] = [];

      for (let j = 0; j < length; j++) {
        const codepoint = memory[i + 2 + j];
        if (!isPrintableAscii(codepoint)) {
          isString = false;
          break;
        }
        codepoints.push(codepoint);
      }

      if (isString) {
        const address = i.toString(16).padStart(8, "0");
        console.log(`0x${address}: "${formatString(codepoints)}"`);
        // Skip past this string
        i += 2 + length;
        continue;
      }
    }

    i++;
  }

  return 0;
}

process.exit(main());
