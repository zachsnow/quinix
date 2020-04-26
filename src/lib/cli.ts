import yargs from 'yargs';
import inspector from 'inspector';
import debug from 'debug';

interface DefaultOptions {
  verbose: boolean,
  inspect: boolean,
  loggers?: string,
}

type MultipleOptions = { [key: string]: yargs.Options };
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
  positional: yargs.PositionalOptions & { name: string },
  loggers?: string[],
}

function parseArguments<Options>(scriptName: string, usage: string, description: string, parseOptions: ParseOptions): yargs.Arguments<Options & DefaultOptions> {
  const options = parseOptions.options || {};
  const positional = parseOptions.positional;
  const argv = (yargs as yargs.Argv<Options & DefaultOptions>).scriptName(scriptName)
    .usage(usage, description, (yargs) => {
      return yargs
        .options(options)
        .options(defaultOptions)
        .positional(positional.name, positional)
    })
    .help()
    .strict(true)
    .argv;

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

  return argv;
}

export {
  parseArguments,
}
