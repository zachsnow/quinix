#! /usr/bin/env bun
/**
 * qfs-extract - Extract a file from a QFS filesystem image
 *
 * Usage: bun run bin/qfs-extract.ts <image.img> <filename> [--output <path>]
 */
import fs from 'fs';

import { parseArguments } from '@server/cli';
import { formatFilename, parseFilename, QFS_MAGIC, QFSImage } from '@server/qfs';

interface Options {
  image: string;
  filename: string;
  output: string;
}

const argv = parseArguments<Options>(
  'qfs-extract',
  '$0 <image> <filename>',
  'extract a file from a QFS filesystem image',
  {
    options: {
      output: {
        alias: 'o',
        describe: 'output file path (defaults to filename)',
        type: 'string',
        default: '',
      },
    },
    positional: {
      name: 'image',
      describe: 'QFS image file',
      type: 'string',
      demandOption: true,
    },
  }
);

async function main(): Promise<void> {
  const imagePath = argv.image;
  // positional arguments come as array, second one is the filename
  const positionals = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));
  if (positionals.length < 2) {
    console.error('Error: missing filename');
    process.exit(1);
  }
  const filename = positionals[1];
  const { name, extension } = parseFilename(filename);

  // Open the image
  const image = new QFSImage(imagePath);
  await image.open();

  try {
    // Verify magic
    const sb = image.getSuperblock();
    if (sb.magic !== QFS_MAGIC) {
      console.error('Error: invalid QFS image (bad magic number)');
      process.exit(1);
    }

    // Find the file
    const found = image.findDirEntry(name, extension);
    if (!found) {
      console.error(`Error: file '${filename}' not found`);
      process.exit(1);
    }

    // Read file data
    const data = image.readFile(found.entry);

    // Write to output
    const outputPath = argv.output || formatFilename(found.entry);
    fs.writeFileSync(outputPath, data);

    console.log(`Extracted: ${formatFilename(found.entry)} -> ${outputPath}`);
    console.log(`  Size: ${data.length} bytes`);
  } finally {
    image.close();
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
