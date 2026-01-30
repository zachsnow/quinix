#! /usr/bin/env bun
import fs from "fs";

import { disassemble } from "@/assembly/disassembly";
import { parseArguments } from "@server/cli";

interface Options {
  output: string;
  file: string;
}

const argv = parseArguments<Options>(
  "qdasm",
  "$0 <file>",
  "disassemble a binary to QASM",
  {
    options: {
      output: {
        alias: "o",
        describe: "output path",
        type: "string",
        default: "out.qasm",
      },
    },
    positional: {
      name: "file",
      describe: "the binary file to disassemble",
      type: "string",
      demandOption: true,
    },
  }
);

async function main(): Promise<void> {
  const bytes = await fs.promises.readFile(argv.file);
  const qasm = disassemble(new Uint8Array(bytes));

  if (argv.output === "-") {
    process.stdout.write(qasm);
  } else {
    await fs.promises.writeFile(argv.output, qasm, "utf-8");
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(-1);
  });
