import yargs, { Argv, Arguments, Options, PositionalOptions } from 'yargs';
import { hideBin } from 'yargs/helpers';
import inspector from 'inspector';
import debug from 'debug';

interface DefaultOptions {
  verbose: boolean,
  inspect: boolean,
  loggers?: string,
}

type MultipleOptions = { [key: string]: Options };
const defaultOptions: MultipleOptions = {
  verbose: {
    alias: 'v',
    describe: 'enable verbose output',
    type: 'boolean',
    default: false,
  },
  loggers: {
    description: 'comma-separated list of loggers to include in verbose output',
    type: 'string',
  },
  inspect: {
    alias: 'i',
    describe: 'run inspector',
    type: 'boolean',
    default: false,
  },
};

type ParseOptions = {
  options?: MultipleOptions,
  positional: PositionalOptions & { name: string },
  loggers?: string[],
}

function parseArguments<Options>(scriptName: string, usage: string, description: string, parseOptions: ParseOptions): Arguments<Options & DefaultOptions> {
  const options = parseOptions.options || {};
  const positional = parseOptions.positional;
  const argv = (yargs(hideBin(process.argv)) as Argv<Options & DefaultOptions>).scriptName(scriptName)
    .usage(usage, description, (yargs: Argv<Options & DefaultOptions>) => {
      return yargs
        .options(options)
        .options(defaultOptions)
        .positional(positional.name, positional)
    })
    .help()
    .strict(true)
    .parseSync();

  if(argv.verbose){
    if(parseOptions.loggers){
      const loggers: string | undefined = argv.loggers;
      debug.enable(loggers ? loggers : parseOptions.loggers.join(','));
    }
    else {
      debug.enable(scriptName);
    }
  }

  if(argv.inspect){
    inspector.open(9999, undefined, true);
  }

  return argv as Arguments<Options & DefaultOptions>;
}

export {
  parseArguments,
}
