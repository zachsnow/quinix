#! /usr/bin/env bun
/**
 * qfs - QFS filesystem tool
 *
 * Usage:
 *   qfs create <image> [--sectors N]
 *   qfs add <image> <file> [--name <name>]
 *   qfs list <image>
 *   qfs extract <image> <filename> [--output <path>]
 *   qfs dump <image>
 */
import fs from 'fs';
import path from 'path';

import {
  DATA_START_SECTOR,
  DIRENT_USED,
  FAT_END_OF_CHAIN,
  FAT_FREE,
  FAT_RESERVED,
  FAT_SECTORS,
  FAT_START_SECTOR,
  formatFilename,
  MAX_DIR_ENTRIES,
  MAX_EXTENSION_LEN,
  MAX_FILENAME_LEN,
  parseFilename,
  QFS_MAGIC,
  QFS_VERSION,
  QFSImage,
  ROOT_SECTORS,
  ROOT_START_SECTOR,
  SECTOR_SIZE_BYTES,
  SECTOR_SIZE_WORDS,
  writeSuperblock,
} from '@server/qfs';

function printUsage(): void {
  console.log(`qfs - QFS filesystem tool

Usage:
  qfs create <image> [--sectors N]    Create empty filesystem image
  qfs add <image> <file> [--name N]   Add file to image
  qfs list <image>                    List files in image
  qfs extract <image> <file> [-o P]   Extract file from image
  qfs dump <image>                    Debug dump of image

Options:
  -h, --help     Show this help
  -v, --verbose  Verbose output`);
}

function parseArgs(): { command: string; args: string[]; options: Record<string, string> } {
  const args = process.argv.slice(2);
  const options: Record<string, string> = {};
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-h' || arg === '--help') {
      printUsage();
      process.exit(0);
    } else if (arg === '-s' || arg === '--sectors') {
      options.sectors = args[++i] || '1024';
    } else if (arg === '-n' || arg === '--name') {
      options.name = args[++i] || '';
    } else if (arg === '-o' || arg === '--output') {
      options.output = args[++i] || '';
    } else if (arg === '-v' || arg === '--verbose') {
      options.verbose = 'true';
    } else if (arg.startsWith('-')) {
      console.error(`Unknown option: ${arg}`);
      process.exit(1);
    } else {
      positional.push(arg);
    }
  }

  const command = positional[0] || '';
  return { command, args: positional.slice(1), options };
}

// ============================================================
// Commands
// ============================================================

async function cmdCreate(args: string[], options: Record<string, string>): Promise<void> {
  if (args.length < 1) {
    console.error('Usage: qfs create <image> [--sectors N]');
    process.exit(1);
  }

  const outputPath = args[0];
  const totalSectors = parseInt(options.sectors || '1024', 10);

  if (isNaN(totalSectors) || totalSectors < DATA_START_SECTOR + 1) {
    console.error(`Error: sectors must be at least ${DATA_START_SECTOR + 1}`);
    process.exit(1);
  }

  console.log(`Creating QFS image: ${outputPath}`);
  console.log(`  Total sectors: ${totalSectors}`);
  console.log(`  Sector size: ${SECTOR_SIZE_BYTES} bytes (${SECTOR_SIZE_WORDS} words)`);
  console.log(`  Total size: ${totalSectors * SECTOR_SIZE_BYTES} bytes`);

  const freeSectors = totalSectors - DATA_START_SECTOR;
  console.log(`  Data sectors: ${freeSectors}`);

  const fd = fs.openSync(outputPath, 'w');

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

  const emptyBuffer = Buffer.alloc(SECTOR_SIZE_BYTES);
  for (let i = 0; i < FAT_SECTORS; i++) {
    fs.writeSync(fd, emptyBuffer, 0, SECTOR_SIZE_BYTES, (FAT_START_SECTOR + i) * SECTOR_SIZE_BYTES);
  }
  for (let i = 0; i < ROOT_SECTORS; i++) {
    fs.writeSync(fd, emptyBuffer, 0, SECTOR_SIZE_BYTES, (ROOT_START_SECTOR + i) * SECTOR_SIZE_BYTES);
  }

  fs.ftruncateSync(fd, totalSectors * SECTOR_SIZE_BYTES);
  fs.closeSync(fd);

  console.log('Done.');
}

async function cmdAdd(args: string[], options: Record<string, string>): Promise<void> {
  if (args.length < 2) {
    console.error('Usage: qfs add <image> <file> [--name <name>]');
    process.exit(1);
  }

  const imagePath = args[0];
  const hostFilePath = args[1];

  let filename = options.name || path.basename(hostFilePath);
  const { name, extension } = parseFilename(filename);

  if (name.length > MAX_FILENAME_LEN) {
    console.error(`Error: filename too long (max ${MAX_FILENAME_LEN} chars)`);
    process.exit(1);
  }
  if (extension.length > MAX_EXTENSION_LEN) {
    console.error(`Error: extension too long (max ${MAX_EXTENSION_LEN} chars)`);
    process.exit(1);
  }

  const fileData = fs.readFileSync(hostFilePath);
  console.log(`Adding file: ${name}${extension ? '.' + extension : ''}`);
  console.log(`  Size: ${fileData.length} bytes`);

  const image = new QFSImage(imagePath);
  await image.open();

  try {
    const sb = image.getSuperblock();
    if (sb.magic !== QFS_MAGIC) {
      console.error('Error: invalid QFS image (bad magic number)');
      process.exit(1);
    }

    const existing = image.findDirEntry(name, extension);
    if (existing) {
      console.error(`Error: file '${name}${extension ? '.' + extension : ''}' already exists`);
      process.exit(1);
    }

    const entryIndex = image.findFreeDirEntry();
    if (entryIndex === null) {
      console.error('Error: directory full (max 64 files)');
      process.exit(1);
    }

    const firstSector = image.writeFile(fileData);
    console.log(`  First sector: ${firstSector}`);

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

async function cmdList(args: string[]): Promise<void> {
  if (args.length < 1) {
    console.error('Usage: qfs list <image>');
    process.exit(1);
  }

  const imagePath = args[0];
  const image = new QFSImage(imagePath);
  await image.open();

  try {
    const sb = image.getSuperblock();
    if (sb.magic !== QFS_MAGIC) {
      console.error('Error: invalid QFS image (bad magic number)');
      process.exit(1);
    }

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

async function cmdExtract(args: string[], options: Record<string, string>): Promise<void> {
  if (args.length < 2) {
    console.error('Usage: qfs extract <image> <filename> [--output <path>]');
    process.exit(1);
  }

  const imagePath = args[0];
  const filename = args[1];
  const { name, extension } = parseFilename(filename);

  const image = new QFSImage(imagePath);
  await image.open();

  try {
    const sb = image.getSuperblock();
    if (sb.magic !== QFS_MAGIC) {
      console.error('Error: invalid QFS image (bad magic number)');
      process.exit(1);
    }

    const found = image.findDirEntry(name, extension);
    if (!found) {
      console.error(`Error: file '${filename}' not found`);
      process.exit(1);
    }

    const data = image.readFile(found.entry);
    const outputPath = options.output || formatFilename(found.entry);
    fs.writeFileSync(outputPath, data);

    console.log(`Extracted: ${formatFilename(found.entry)} -> ${outputPath}`);
    console.log(`  Size: ${data.length} bytes`);
  } finally {
    image.close();
  }
}

function hex(n: number): string {
  return '0x' + (n >>> 0).toString(16).padStart(8, '0');
}

async function cmdDump(args: string[]): Promise<void> {
  if (args.length < 1) {
    console.error('Usage: qfs dump <image>');
    process.exit(1);
  }

  const imagePath = args[0];
  const image = new QFSImage(imagePath);
  await image.open();

  try {
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

// ============================================================
// Main
// ============================================================

async function main(): Promise<void> {
  const { command, args, options } = parseArgs();

  switch (command) {
    case 'create':
      await cmdCreate(args, options);
      break;
    case 'add':
      await cmdAdd(args, options);
      break;
    case 'list':
    case 'ls':
      await cmdList(args);
      break;
    case 'extract':
    case 'get':
      await cmdExtract(args, options);
      break;
    case 'dump':
      await cmdDump(args);
      break;
    default:
      printUsage();
      process.exit(command ? 1 : 0);
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
