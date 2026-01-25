#! /usr/bin/env bun
/**
 * qfs-add - Add a file to a QFS filesystem image
 *
 * Usage: bun run bin/qfs-add.ts <image.img> <host-file> [--name <name>]
 */
import fs from 'fs';
import path from 'path';

import { parseArguments } from '@server/cli';
import {
  DIRENT_USED,
  MAX_EXTENSION_LEN,
  MAX_FILENAME_LEN,
  parseFilename,
  QFS_MAGIC,
  QFSImage,
} from '@server/qfs';

interface Options {
  image: string;
  file: string;
  name: string;
}

const argv = parseArguments<Options>(
  'qfs-add',
  '$0 <image> <file>',
  'add a file to a QFS filesystem image',
  {
    options: {
      name: {
        alias: 'n',
        describe: 'filename in the image (defaults to source filename)',
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
  // positional arguments come as array, second one is the file
  const positionals = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));
  if (positionals.length < 2) {
    console.error('Error: missing host file path');
    process.exit(1);
  }
  const hostFilePath = positionals[1];

  // Determine filename in image
  let filename = argv.name || path.basename(hostFilePath);
  const { name, extension } = parseFilename(filename);

  if (name.length > MAX_FILENAME_LEN) {
    console.error(`Error: filename too long (max ${MAX_FILENAME_LEN} chars)`);
    process.exit(1);
  }
  if (extension.length > MAX_EXTENSION_LEN) {
    console.error(`Error: extension too long (max ${MAX_EXTENSION_LEN} chars)`);
    process.exit(1);
  }

  // Read the host file
  const fileData = fs.readFileSync(hostFilePath);
  console.log(`Adding file: ${name}${extension ? '.' + extension : ''}`);
  console.log(`  Size: ${fileData.length} bytes`);

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

    // Check if file already exists
    const existing = image.findDirEntry(name, extension);
    if (existing) {
      console.error(`Error: file '${name}${extension ? '.' + extension : ''}' already exists`);
      process.exit(1);
    }

    // Find a free directory entry
    const entryIndex = image.findFreeDirEntry();
    if (entryIndex === null) {
      console.error('Error: directory full (max 64 files)');
      process.exit(1);
    }

    // Write file data and get first sector
    const firstSector = image.writeFile(fileData);
    console.log(`  First sector: ${firstSector}`);

    // Create directory entry
    image.setDirEntry(entryIndex, {
      flags: DIRENT_USED,
      firstSector,
      size: fileData.length,
      name,
      extension,
    });

    console.log('Done.');
  } finally {
    image.close();
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
