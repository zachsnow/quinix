#! /usr/bin/env bun
import { $ } from 'bun';
import { parseArguments } from '../src/lib/cli';

interface Options {
  file: string;
  verbose: boolean;
}

const argv = parseArguments<Options>(
  'qrun',
  '$0 <file>',
  'compile and run the given file',
  {
    options: {
      verbose: {
        alias: 'v',
        describe: 'verbose output',
        type: 'boolean',
        default: false,
      },
    },
    positional: {
      name: 'file',
      type: 'string',
      describe: 'the source file to run',
      demandOption: true,
    },
  },
);

async function main(): Promise<number> {
  const file = argv.file;
  const verbose = argv.verbose;

  console.log('Compiling...');
  const compileArgs = verbose ? ['-v', file] : [file];
  const compileResult = await $`bun run bin/qllc.ts ${compileArgs}`.quiet();
  if (compileResult.exitCode !== 0) {
    console.error(compileResult.stderr.toString());
    return compileResult.exitCode;
  }

  console.log('Assembling...');
  const asmResult = await $`bun run bin/qasm.ts out.qasm`.quiet();
  if (asmResult.exitCode !== 0) {
    console.error(asmResult.stderr.toString());
    return asmResult.exitCode;
  }

  console.log('Executing...');
  const vmArgs = verbose ? ['-v', 'out.qbin'] : ['out.qbin'];
  const vmResult = await $`bun run bin/qvm.ts ${vmArgs}`;
  return vmResult.exitCode;
}

main().then((code) => {
  process.exit(code);
}).catch((e) => {
  console.error(`error: ${e}`);
  process.exit(-1);
});
