#! /usr/bin/env bun
import fs from "fs";
import path from "path";

import { Memory } from "@/lib/types";
import { Operation } from "@/vm/instructions";
import { parseArguments } from "@server/cli";

///////////////////////////////////////////////////////////////////////
// Configure CLI.
///////////////////////////////////////////////////////////////////////
interface Options {
  binary: string;
  minLength: string;
  inline: boolean;
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
      inline: {
        describe: "also detect inline string initialization code",
        type: "boolean",
        default: true,
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

// Instruction encoding helpers
function getOpcode(word: number): number {
  return (word >>> 24) & 0xff;
}

function isConstantInstruction(word: number): boolean {
  return getOpcode(word) === Operation.CONSTANT;
}

function isStoreInstruction(word: number): boolean {
  return getOpcode(word) === Operation.STORE;
}

function isAddInstruction(word: number): boolean {
  return getOpcode(word) === Operation.ADD;
}

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

// Track which addresses have been reported to avoid duplicates
const reportedStrings = new Set<string>();

function reportString(address: number, codepoints: number[], type: string) {
  const key = `${address}:${codepoints.join(",")}`;
  if (reportedStrings.has(key)) {
    return;
  }
  reportedStrings.add(key);
  const addrStr = address.toString(16).padStart(8, "0");
  console.log(`0x${addrStr}: "${formatString(codepoints)}" (${type})`);
}

function findDataStrings(memory: Memory) {
  // Scan for data strings stored as:
  // [capacity: u32] [length: u32] [codepoints: u32 * length]
  let i = 0;
  while (i < memory.length - 2) {
    const capacity = memory[i];
    const length = memory[i + 1];

    if (
      capacity === length &&
      length >= minLength &&
      length < 10000 &&
      i + 2 + length <= memory.length
    ) {
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
        reportString(i, codepoints, "data");
        i += 2 + length;
        continue;
      }
    }

    i++;
  }
}

function findInlineStrings(memory: Memory) {
  // Scan for inline string initialization patterns:
  // constant rN <length>    ; 0x05NN0000 followed by length
  // store rM rN             ; 0x03MMNN00
  // add rM rM r62           ; 0x06MMMM3E (r62 = 0x3E = 62)
  // Then repeated for each character:
  //   constant rN <char>
  //   store rM rN
  //   add rM rM r62
  let i = 0;
  while (i < memory.length - 6) {
    // Look for: constant, immediate (length), store, add pattern
    if (!isConstantInstruction(memory[i])) {
      i++;
      continue;
    }

    const lengthImmediate = memory[i + 1];

    // Length should be reasonable
    if (lengthImmediate < minLength || lengthImmediate > 1000) {
      i++;
      continue;
    }

    // Check if next instructions are store, add
    if (!isStoreInstruction(memory[i + 2]) || !isAddInstruction(memory[i + 3])) {
      i++;
      continue;
    }

    // Now try to read the character sequence
    const codepoints: number[] = [];
    let j = i + 4; // Start after length pattern

    while (codepoints.length < lengthImmediate && j + 3 < memory.length) {
      // Expect: constant, immediate (char), store, add
      if (!isConstantInstruction(memory[j])) {
        break;
      }

      const charImmediate = memory[j + 1];
      if (!isPrintableAscii(charImmediate)) {
        break;
      }

      if (!isStoreInstruction(memory[j + 2])) {
        break;
      }

      // The add might be missing for the last character, or present
      codepoints.push(charImmediate);

      if (isAddInstruction(memory[j + 3])) {
        j += 4;
      } else {
        j += 3;
        break;
      }
    }

    // Check if we found a complete string
    if (codepoints.length >= minLength) {
      reportString(i, codepoints, "inline");
      i = j;
    } else {
      i++;
    }
  }
}

function main(): number {
  const filename = argv.binary;

  if (!filename.endsWith(".qbin")) {
    console.warn(`warning: non-standard extension ${path.extname(filename)}`);
  }

  const buffer = fs.readFileSync(filename);
  const memory = Memory.fromBytes(buffer);

  findDataStrings(memory);

  if (argv.inline) {
    findInlineStrings(memory);
  }

  return 0;
}

process.exit(main());
