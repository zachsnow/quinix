import fs from "fs";
import inspector from "inspector";
import path from "path";
import { parseArgs } from "util";
import { setVerbose } from "@/lib/logger";
import { InternalError } from "@/lib/util";

interface DefaultOptions {
  verbose: boolean;
  inspect: boolean;
  help: boolean;
}

type OptionType = "string" | "boolean";

interface OptionConfig {
  alias?: string;
  describe?: string;
  type: OptionType;
  default?: string | boolean | number;
  array?: boolean;
  demandOption?: boolean;
}

type OptionsConfig = { [key: string]: OptionConfig };

interface PositionalConfig {
  name: string;
  describe?: string;
  type?: "string";
  array?: boolean;
  demandOption?: boolean;
}

interface ParseOptions {
  options?: OptionsConfig;
  positional: PositionalConfig;
}

function printHelp(
  scriptName: string,
  usage: string,
  description: string,
  parseOptions: ParseOptions
): void {
  console.log(`${scriptName} - ${description}\n`);
  console.log(`Usage: ${usage.replace("$0", scriptName)}\n`);
  console.log("Options:");

  const allOptions: OptionsConfig = {
    ...parseOptions.options,
    verbose: {
      alias: "v",
      describe: "enable verbose output",
      type: "boolean",
      default: false,
    },
    inspect: {
      alias: "i",
      describe: "run inspector",
      type: "boolean",
      default: false,
    },
    help: {
      alias: "h",
      describe: "show help",
      type: "boolean",
      default: false,
    },
  };

  for (const [name, config] of Object.entries(allOptions)) {
    const alias = config.alias ? `-${config.alias}, ` : "    ";
    const defaultStr =
      config.default !== undefined ? ` [default: ${config.default}]` : "";
    console.log(
      `  ${alias}--${name.padEnd(16)} ${config.describe || ""}${defaultStr}`
    );
  }

  if (parseOptions.positional) {
    console.log(`\nPositional arguments:`);
    const p = parseOptions.positional;
    const required = p.demandOption ? " (required)" : "";
    console.log(`  ${p.name.padEnd(20)} ${p.describe || ""}${required}`);
  }
}

function parseArguments<Options>(
  scriptName: string,
  usage: string,
  description: string,
  parseOptions: ParseOptions
): Options & DefaultOptions {
  const userOptions = parseOptions.options || {};

  // Build parseArgs config
  const options: {
    [key: string]: {
      type: "string" | "boolean";
      short?: string;
      multiple?: boolean;
      default?: string | boolean;
    };
  } = {};

  // Add user options
  for (const [name, config] of Object.entries(userOptions)) {
    const type = config.type === "boolean" ? "boolean" : "string";
    options[name] = { type };
    if (config.alias) {
      options[name].short = config.alias;
    }
    if (config.array) {
      options[name].multiple = true;
    }
    if (config.default !== undefined && type === "boolean") {
      options[name].default = config.default as boolean;
    }
  }

  // Add default options
  options.verbose = { type: "boolean", short: "v", default: false };
  options.inspect = { type: "boolean", short: "i", default: false };
  options.help = { type: "boolean", short: "h", default: false };

  let parsed;
  try {
    parsed = parseArgs({
      options,
      allowPositionals: true,
      strict: true,
    });
  } catch (e: any) {
    console.error(`Error: ${e.message}`);
    printHelp(scriptName, usage, description, parseOptions);
    process.exit(1);
  }

  const { values, positionals } = parsed;

  // Handle help
  if (values.help) {
    printHelp(scriptName, usage, description, parseOptions);
    process.exit(0);
  }

  // Apply defaults for string/number options
  for (const [name, config] of Object.entries(userOptions)) {
    if (values[name] === undefined && config.default !== undefined) {
      (values as any)[name] = config.default;
    }
  }

  // Handle positional
  const positionalConfig = parseOptions.positional;
  if (positionalConfig.array) {
    (values as any)[positionalConfig.name] = positionals;
  } else {
    (values as any)[positionalConfig.name] = positionals[0];
  }

  // Check required positional
  if (positionalConfig.demandOption) {
    const val = (values as any)[positionalConfig.name];
    if (val === undefined || (Array.isArray(val) && val.length === 0)) {
      console.error(
        `Error: Missing required positional argument: ${positionalConfig.name}`
      );
      printHelp(scriptName, usage, description, parseOptions);
      process.exit(1);
    }
  }

  // Handle verbose logging
  if (values.verbose) {
    setVerbose(true);
  }

  // Handle inspector
  if (values.inspect) {
    inspector.open(9999, undefined, true);
  }

  return values as Options & DefaultOptions;
}

// Valid compilation targets.
const VALID_TARGETS = ["bare", "user", "none"] as const;
type Target = (typeof VALID_TARGETS)[number];

function isValidTarget(target: string): target is Target {
  return VALID_TARGETS.includes(target as Target);
}

// Resolve the root directory (where shared/, bare/, user/ live).
function resolveRoot(): string {
  // We are in `./bin/`, running the TypeScript file directly with bun.
  let rootPath = path.resolve(__dirname, "..");
  if (!fs.existsSync(path.join(rootPath, "package.json"))) {
    rootPath = path.resolve(__dirname, "..", "..");
  }
  if (!fs.existsSync(path.join(rootPath, "package.json"))) {
    throw new InternalError("unable to locate project root");
  }
  return rootPath;
}

// Get all files with the given extension from a directory.
function getFilesWithExtension(dir: string, extension: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(extension))
    .map((f) => path.join(dir, f))
    .sort();
}

// Get auto-include files for the given target.
function getTargetIncludes(target: Target, extension: string): string[] {
  if (target === "none") {
    return [];
  }
  const root = resolveRoot();
  const sharedFiles = getFilesWithExtension(path.join(root, "shared"), extension);
  const targetFiles = getFilesWithExtension(path.join(root, target), extension);
  return [...sharedFiles, ...targetFiles];
}

export {
  getFilesWithExtension,
  getTargetIncludes,
  isValidTarget,
  parseArguments,
  resolveRoot,
  VALID_TARGETS,
};
export type { Target };
