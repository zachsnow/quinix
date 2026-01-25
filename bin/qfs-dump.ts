#! /usr/bin/env bun
/**
 * qfs-dump - Debug dump of a QFS filesystem image
 *
 * Usage: bun run bin/qfs-dump.ts <image.img>
 */
import { parseArguments } from '@server/cli';
import {
  DATA_START_SECTOR,
  FAT_END_OF_CHAIN,
  FAT_FREE,
  FAT_RESERVED,
  formatFilename,
  MAX_DIR_ENTRIES,
  QFS_MAGIC,
  QFSImage,
} from '@server/qfs';

interface Options {
  image: string;
}

const argv = parseArguments<Options>(
  'qfs-dump',
  '$0 <image>',
  'debug dump of a QFS filesystem image',
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

function hex(n: number): string {
  return '0x' + (n >>> 0).toString(16).padStart(8, '0');
}

async function main(): Promise<void> {
  const imagePath = argv.image;

  // Open the image
  const image = new QFSImage(imagePath);
  await image.open();

  try {
    // Read and display superblock
    const sb = image.getSuperblock();

    console.log('=== SUPERBLOCK ===');
    console.log(`  Magic:         ${hex(sb.magic)} ${sb.magic === QFS_MAGIC ? '(valid)' : '(INVALID)'}`);
    console.log(`  Version:       ${sb.version}`);
    console.log(`  Sector size:   ${sb.sectorSize} words`);
    console.log(`  Total sectors: ${sb.totalSectors}`);
    console.log(`  FAT start:     ${sb.fatStart}`);
    console.log(`  FAT sectors:   ${sb.fatSectors}`);
    console.log(`  Root start:    ${sb.rootStart}`);
    console.log(`  Root sectors:  ${sb.rootSectors}`);
    console.log(`  Data start:    ${sb.dataStart}`);
    console.log(`  Free sectors:  ${sb.freeSectors}`);

    if (sb.magic !== QFS_MAGIC) {
      console.error('\nInvalid QFS image, stopping.');
      process.exit(1);
    }

    // Display FAT entries (non-free only)
    console.log('\n=== FAT (non-free entries) ===');
    let fatCount = 0;
    for (let sector = DATA_START_SECTOR; sector < sb.totalSectors; sector++) {
      const entry = image.getFATEntry(sector);
      if (entry !== FAT_FREE) {
        let valueStr: string;
        if (entry === FAT_END_OF_CHAIN) {
          valueStr = 'END';
        } else if (entry === FAT_RESERVED) {
          valueStr = 'RESERVED';
        } else {
          valueStr = `-> ${entry}`;
        }
        console.log(`  Sector ${sector.toString().padStart(4)}: ${valueStr}`);
        fatCount++;
      }
    }
    if (fatCount === 0) {
      console.log('  (all sectors free)');
    }

    // Display directory entries
    console.log('\n=== DIRECTORY ENTRIES ===');
    let dirCount = 0;
    for (let i = 0; i < MAX_DIR_ENTRIES; i++) {
      const entry = image.getDirEntry(i);
      if (entry.flags !== 0) {
        const flagStr = entry.flags === 0x01 ? 'USED' : entry.flags === 0x80 ? 'DELETED' : hex(entry.flags);
        console.log(`  [${i.toString().padStart(2)}] ${flagStr.padEnd(8)} ${formatFilename(entry).padEnd(16)} size=${entry.size.toString().padStart(8)} sector=${entry.firstSector}`);
        dirCount++;
      }
    }
    if (dirCount === 0) {
      console.log('  (no entries)');
    }

  } finally {
    image.close();
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
