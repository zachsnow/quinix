#! /usr/bin/env bun
/**
 * qfs-list - List files in a QFS filesystem image
 *
 * Usage: bun run bin/qfs-list.ts <image.img>
 */
import { parseArguments } from '@server/cli';
import { formatFilename, QFS_MAGIC, QFSImage } from '@server/qfs';

interface Options {
  image: string;
}

const argv = parseArguments<Options>(
  'qfs-list',
  '$0 <image>',
  'list files in a QFS filesystem image',
  {
    options: {},
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

    // List files
    const entries = image.listDirEntries();

    if (entries.length === 0) {
      console.log('(no files)');
      return;
    }

    console.log('Name            Size      Sector');
    console.log('--------------------------------');
    for (const { entry } of entries) {
      const name = formatFilename(entry).padEnd(16);
      const size = entry.size.toString().padStart(8);
      const sector = entry.firstSector.toString().padStart(6);
      console.log(`${name}${size}${sector}`);
    }
    console.log('--------------------------------');
    console.log(`${entries.length} file(s), ${sb.freeSectors} sectors free`);
  } finally {
    image.close();
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
