#! /usr/bin/env bun
/**
 * qfs-create - Create an empty QFS filesystem image
 *
 * Usage: bun run bin/qfs-create.ts <output.img> [--sectors N]
 */
import fs from 'fs';

import { parseArguments } from '@server/cli';
import {
  DATA_START_SECTOR,
  FAT_SECTORS,
  FAT_START_SECTOR,
  QFS_MAGIC,
  QFS_VERSION,
  ROOT_SECTORS,
  ROOT_START_SECTOR,
  SECTOR_SIZE_BYTES,
  SECTOR_SIZE_WORDS,
  writeSuperblock,
} from '@server/qfs';

interface Options {
  output: string;
  sectors: string;
}

const argv = parseArguments<Options>(
  'qfs-create',
  '$0 <output>',
  'create an empty QFS filesystem image',
  {
    options: {
      sectors: {
        alias: 's',
        describe: 'total number of sectors',
        type: 'string',
        default: '1024',
      },
    },
    positional: {
      name: 'output',
      describe: 'output image file path',
      type: 'string',
      demandOption: true,
    },
  }
);

async function main(): Promise<void> {
  const outputPath = argv.output;
  const totalSectors = parseInt(argv.sectors, 10);

  if (isNaN(totalSectors) || totalSectors < DATA_START_SECTOR + 1) {
    console.error(`Error: sectors must be at least ${DATA_START_SECTOR + 1}`);
    process.exit(1);
  }

  console.log(`Creating QFS image: ${outputPath}`);
  console.log(`  Total sectors: ${totalSectors}`);
  console.log(`  Sector size: ${SECTOR_SIZE_BYTES} bytes (${SECTOR_SIZE_WORDS} words)`);
  console.log(`  Total size: ${totalSectors * SECTOR_SIZE_BYTES} bytes`);

  // Calculate free data sectors
  const freeSectors = totalSectors - DATA_START_SECTOR;
  console.log(`  Data sectors: ${freeSectors}`);

  // Create the file
  const fd = fs.openSync(outputPath, 'w');

  // Write superblock (sector 0)
  const superblockBuffer = Buffer.alloc(SECTOR_SIZE_BYTES);
  writeSuperblock(superblockBuffer, {
    magic: QFS_MAGIC,
    version: QFS_VERSION,
    sectorSize: SECTOR_SIZE_WORDS,
    totalSectors: totalSectors,
    fatStart: FAT_START_SECTOR,
    fatSectors: FAT_SECTORS,
    rootStart: ROOT_START_SECTOR,
    rootSectors: ROOT_SECTORS,
    dataStart: DATA_START_SECTOR,
    freeSectors: freeSectors,
  });
  fs.writeSync(fd, superblockBuffer, 0, SECTOR_SIZE_BYTES, 0);

  // Write FAT sectors (all zeros = free)
  const emptyBuffer = Buffer.alloc(SECTOR_SIZE_BYTES);
  for (let i = 0; i < FAT_SECTORS; i++) {
    fs.writeSync(fd, emptyBuffer, 0, SECTOR_SIZE_BYTES, (FAT_START_SECTOR + i) * SECTOR_SIZE_BYTES);
  }

  // Write root directory sectors (all zeros = free entries)
  for (let i = 0; i < ROOT_SECTORS; i++) {
    fs.writeSync(fd, emptyBuffer, 0, SECTOR_SIZE_BYTES, (ROOT_START_SECTOR + i) * SECTOR_SIZE_BYTES);
  }

  // Extend file to full size
  fs.ftruncateSync(fd, totalSectors * SECTOR_SIZE_BYTES);

  fs.closeSync(fd);

  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
