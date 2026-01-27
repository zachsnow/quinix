#! /usr/bin/env bun
/**
 * qfs - QFS filesystem tool
 *
 * Usage:
 *   qfs create <image> [--sectors N] [--fat-sectors N]
 *   qfs add <image> <file> [--name <name>] [--exec]
 *   qfs mkdir <image> <path>
 *   qfs list <image> [path]
 *   qfs extract <image> <filename> [--output <path>]
 *   qfs dump <image>
 */
import fs from 'fs';
import path from 'path';

import {
  DIRENT_DIRECTORY,
  DIRENT_EXECUTABLE,
  DIRENT_PER_SECTOR,
  DIRENT_USED,
  FAT_END_OF_CHAIN,
  FAT_FREE,
  FAT_RESERVED,
  FAT_START_SECTOR,
  isDirectory,
  isExecutable,
  MAX_FILENAME_LEN,
  QFS_MAGIC,
  QFS_VERSION,
  QFSImage,
  recommendedFatSectors,
  SECTOR_SIZE_BYTES,
  SECTOR_SIZE_WORDS,
  writeSuperblock,
} from '@server/qfs';

interface Options {
  sectors: number;
  fatSectors: number;
  name: string;
  output: string;
  verbose: boolean;
  exec: boolean;
  from: string;
}

function printUsage(): void {
  console.log(`qfs - QFS filesystem tool

Usage:
  qfs create [image] [--sectors N]    Create empty filesystem (default: out.qfs)
  qfs create [image] --from <dir>     Create image from directory
  qfs add <image> <file> [--name N]   Add file to image
  qfs mkdir <image> <path>            Create directory
  qfs list <image> [path]             List files in image
  qfs extract <image> <file> [-o P]   Extract file from image
  qfs dump <image>                    Debug dump of image

Options:
  -h, --help         Show this help
  -v, --verbose      Verbose output
  -s, --sectors N    Total sectors for create (default: 1024)
  -f, --fat-sectors  FAT sectors (default: auto)
  --from DIR         Create image from directory contents
  -x, --exec         Mark file as executable (add)
  -n, --name NAME    Override filename (add)
  -o, --output PATH  Output path (extract)`);
}

function parseArgs(): { command: string; args: string[]; options: Options } {
  const argv = process.argv.slice(2);
  const options: Options = {
    sectors: 1024,
    fatSectors: 0,
    name: '',
    output: '',
    verbose: false,
    exec: false,
    from: '',
  };
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') {
      printUsage();
      process.exit(0);
    } else if (arg === '-s' || arg === '--sectors') {
      const val = argv[++i];
      options.sectors = parseInt(val, 10);
      if (isNaN(options.sectors)) {
        console.error(`Error: --sectors requires a number, got '${val}'`);
        process.exit(1);
      }
    } else if (arg === '-f' || arg === '--fat-sectors') {
      const val = argv[++i];
      options.fatSectors = parseInt(val, 10);
      if (isNaN(options.fatSectors)) {
        console.error(`Error: --fat-sectors requires a number, got '${val}'`);
        process.exit(1);
      }
    } else if (arg === '--from') {
      options.from = argv[++i] || '';
    } else if (arg === '-n' || arg === '--name') {
      options.name = argv[++i] || '';
    } else if (arg === '-o' || arg === '--output') {
      options.output = argv[++i] || '';
    } else if (arg === '-v' || arg === '--verbose') {
      options.verbose = true;
    } else if (arg === '-x' || arg === '--exec') {
      options.exec = true;
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

interface FileEntry {
  hostPath: string;
  qfsPath: string;
  isDir: boolean;
}

function scanDirectory(dirPath: string, prefix: string = ''): FileEntry[] {
  const entries: FileEntry[] = [];
  const items = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const item of items) {
    const hostPath = path.join(dirPath, item.name);
    const qfsPath = prefix ? `${prefix}/${item.name}` : item.name;

    if (item.isDirectory()) {
      entries.push({ hostPath, qfsPath, isDir: true });
      entries.push(...scanDirectory(hostPath, qfsPath));
    } else if (item.isFile()) {
      entries.push({ hostPath, qfsPath, isDir: false });
    }
  }

  return entries;
}

function calculateRequiredSectors(entries: FileEntry[]): number {
  let sectors = 0;

  // Count directory sectors (1 per directory, can grow)
  const dirs = entries.filter((e) => e.isDir);
  sectors += dirs.length;

  // Count file data sectors
  for (const entry of entries) {
    if (!entry.isDir) {
      const stat = fs.statSync(entry.hostPath);
      sectors += Math.ceil(stat.size / SECTOR_SIZE_BYTES);
    }
  }

  // Add some margin for directory growth
  sectors += Math.ceil(entries.length / DIRENT_PER_SECTOR);

  return sectors;
}

async function cmdCreate(args: string[], options: Options): Promise<void> {
  const outputPath = args[0] || 'out.qfs';

  // If --from is specified, scan directory first to determine size
  let filesToAdd: FileEntry[] = [];
  let totalSectors = options.sectors;

  if (options.from) {
    if (!fs.existsSync(options.from)) {
      console.error(`Error: directory '${options.from}' not found`);
      process.exit(1);
    }
    const stat = fs.statSync(options.from);
    if (!stat.isDirectory()) {
      console.error(`Error: '${options.from}' is not a directory`);
      process.exit(1);
    }

    filesToAdd = scanDirectory(options.from);
    const requiredDataSectors = calculateRequiredSectors(filesToAdd);

    // Calculate minimum total sectors needed
    const minFatSectors = recommendedFatSectors(requiredDataSectors + 100); // estimate
    const minTotalSectors = 1 + minFatSectors + 1 + requiredDataSectors + 50; // superblock + fat + root + data + margin

    if (totalSectors < minTotalSectors) {
      totalSectors = minTotalSectors;
    }

    console.log(`Scanning ${options.from}: ${filesToAdd.length} entries`);
  }

  const fatSectors = options.fatSectors > 0 ? options.fatSectors : recommendedFatSectors(totalSectors);
  const rootSector = FAT_START_SECTOR + fatSectors;
  const dataStart = rootSector + 1;

  if (totalSectors < dataStart + 1) {
    console.error(`Error: sectors must be at least ${dataStart + 1} for this FAT size`);
    process.exit(1);
  }

  console.log(`Creating QFS image: ${outputPath}`);
  console.log(`  Total sectors: ${totalSectors}`);
  console.log(`  Sector size: ${SECTOR_SIZE_BYTES} bytes (${SECTOR_SIZE_WORDS} words)`);
  console.log(`  Total size: ${totalSectors * SECTOR_SIZE_BYTES} bytes`);
  console.log(`  FAT sectors: ${fatSectors}`);
  console.log(`  Root sector: ${rootSector}`);
  console.log(`  Data start: ${dataStart}`);

  const freeSectors = totalSectors - dataStart;
  console.log(`  Data sectors: ${freeSectors}`);

  const fd = fs.openSync(outputPath, 'w');

  const superblockBuffer = Buffer.alloc(SECTOR_SIZE_BYTES);
  writeSuperblock(superblockBuffer, {
    magic: QFS_MAGIC,
    version: QFS_VERSION,
    sectorSize: SECTOR_SIZE_WORDS,
    totalSectors: totalSectors,
    fatStart: FAT_START_SECTOR,
    fatSectors: fatSectors,
    rootSector: rootSector,
    dataStart: dataStart,
    freeSectors: freeSectors,
  });
  fs.writeSync(fd, superblockBuffer, 0, SECTOR_SIZE_BYTES, 0);

  // Initialize FAT sectors (all zeros = FAT_FREE)
  const emptyBuffer = Buffer.alloc(SECTOR_SIZE_BYTES);
  for (let i = 0; i < fatSectors; i++) {
    fs.writeSync(fd, emptyBuffer, 0, SECTOR_SIZE_BYTES, (FAT_START_SECTOR + i) * SECTOR_SIZE_BYTES);
  }

  // Initialize root directory sector
  fs.writeSync(fd, emptyBuffer, 0, SECTOR_SIZE_BYTES, rootSector * SECTOR_SIZE_BYTES);

  fs.ftruncateSync(fd, totalSectors * SECTOR_SIZE_BYTES);
  fs.closeSync(fd);

  // If --from was specified, add all files
  if (options.from && filesToAdd.length > 0) {
    const image = new QFSImage(outputPath);
    await image.open();

    try {
      const sb = image.getSuperblock();

      // Process entries in order (directories first at each level)
      for (const entry of filesToAdd) {
        const parts = entry.qfsPath.split('/');
        const name = parts[parts.length - 1];

        if (name.length > MAX_FILENAME_LEN) {
          console.warn(`  Skipping '${entry.qfsPath}': name too long`);
          continue;
        }

        // Find parent directory sector
        let parentSector = sb.rootSector;
        for (let i = 0; i < parts.length - 1; i++) {
          const found = image.findInDirectory(parentSector, parts[i]);
          if (found && isDirectory(found.entry)) {
            parentSector = found.entry.firstSector;
          } else {
            console.error(`  Error: parent directory not found for ${entry.qfsPath}`);
            break;
          }
        }

        if (entry.isDir) {
          const newSector = image.createDirectory(parentSector, name);
          if (newSector === null) {
            console.error(`  Error creating directory: ${entry.qfsPath}`);
          } else {
            console.log(`  Created directory: ${entry.qfsPath}`);
          }
        } else {
          const fileData = fs.readFileSync(entry.hostPath);
          const slot = image.findFreeSlot(parentSector);
          if (slot === null) {
            console.error(`  Error: directory full for ${entry.qfsPath}`);
            continue;
          }

          const firstSector = image.writeFile(fileData);
          image.writeDirEntryAt(slot.sector, slot.slotIndex, {
            flags: DIRENT_USED,
            firstSector,
            size: fileData.length,
            name,
          });
          console.log(`  Added file: ${entry.qfsPath} (${fileData.length} bytes)`);
        }
      }
    } finally {
      image.close();
    }
  }

  console.log('Done.');
}

async function cmdAdd(args: string[], options: Options): Promise<void> {
  if (args.length < 2) {
    console.error('Usage: qfs add <image> <file> [--name <name>] [--exec]');
    process.exit(1);
  }

  const imagePath = args[0];
  const hostFilePath = args[1];

  const filename = options.name || path.basename(hostFilePath);

  if (filename.length > MAX_FILENAME_LEN) {
    console.error(`Error: filename too long (max ${MAX_FILENAME_LEN} chars)`);
    process.exit(1);
  }

  const fileData = fs.readFileSync(hostFilePath);
  console.log(`Adding file: ${filename}`);
  console.log(`  Size: ${fileData.length} bytes`);

  const image = new QFSImage(imagePath);
  await image.open();

  try {
    const sb = image.getSuperblock();
    if (sb.magic !== QFS_MAGIC) {
      console.error('Error: invalid QFS image (bad magic number)');
      process.exit(1);
    }

    const existing = image.findDirEntry(filename);
    if (existing) {
      console.error(`Error: file '${filename}' already exists`);
      process.exit(1);
    }

    const entryIndex = image.findFreeDirEntry();
    if (entryIndex === null) {
      console.error('Error: directory full');
      process.exit(1);
    }

    const firstSector = image.writeFile(fileData);
    console.log(`  First sector: ${firstSector}`);

    let flags = DIRENT_USED;
    if (options.exec) {
      flags |= DIRENT_EXECUTABLE;
    }

    image.setDirEntry(entryIndex, {
      flags,
      firstSector,
      size: fileData.length,
      name: filename,
    });

    console.log('Done.');
  } finally {
    image.close();
  }
}

async function cmdMkdir(args: string[]): Promise<void> {
  if (args.length < 2) {
    console.error('Usage: qfs mkdir <image> <path>');
    process.exit(1);
  }

  const imagePath = args[0];
  const dirPath = args[1];

  const image = new QFSImage(imagePath);
  await image.open();

  try {
    const sb = image.getSuperblock();
    if (sb.magic !== QFS_MAGIC) {
      console.error('Error: invalid QFS image (bad magic number)');
      process.exit(1);
    }

    const parts = dirPath.split('/').filter((p) => p.length > 0);
    if (parts.length === 0) {
      console.error('Error: invalid path');
      process.exit(1);
    }

    // Navigate to parent directory
    let currentSector = sb.rootSector;
    for (let i = 0; i < parts.length - 1; i++) {
      const found = image.findInDirectory(currentSector, parts[i]);
      if (!found) {
        console.error(`Error: parent directory '${parts[i]}' not found`);
        process.exit(1);
      }
      if (!isDirectory(found.entry)) {
        console.error(`Error: '${parts[i]}' is not a directory`);
        process.exit(1);
      }
      currentSector = found.entry.firstSector;
    }

    const dirName = parts[parts.length - 1];
    if (dirName.length > MAX_FILENAME_LEN) {
      console.error(`Error: directory name too long (max ${MAX_FILENAME_LEN} chars)`);
      process.exit(1);
    }

    // Check if already exists
    const existing = image.findInDirectory(currentSector, dirName);
    if (existing) {
      console.error(`Error: '${dirName}' already exists`);
      process.exit(1);
    }

    const newSector = image.createDirectory(currentSector, dirName);
    if (newSector === null) {
      console.error('Error: failed to create directory (disk full?)');
      process.exit(1);
    }

    console.log(`Created directory: ${dirPath}`);
    console.log(`  Sector: ${newSector}`);
    console.log('Done.');
  } finally {
    image.close();
  }
}

async function cmdList(args: string[]): Promise<void> {
  if (args.length < 1) {
    console.error('Usage: qfs list <image> [path]');
    process.exit(1);
  }

  const imagePath = args[0];
  const listPath = args[1] || '/';

  const image = new QFSImage(imagePath);
  await image.open();

  try {
    const sb = image.getSuperblock();
    if (sb.magic !== QFS_MAGIC) {
      console.error('Error: invalid QFS image (bad magic number)');
      process.exit(1);
    }

    // Resolve path to directory
    let dirSector: number;
    if (listPath === '/' || listPath === '') {
      dirSector = sb.rootSector;
    } else {
      const resolved = image.resolvePath(listPath);
      if (!resolved) {
        console.error(`Error: path '${listPath}' not found`);
        process.exit(1);
      }
      if (!isDirectory(resolved.entry)) {
        console.error(`Error: '${listPath}' is not a directory`);
        process.exit(1);
      }
      dirSector = resolved.entry.firstSector;
    }

    const entries = image.readDirectory(dirSector);

    if (entries.length === 0) {
      console.log('(no files)');
      return;
    }

    console.log('Type  Name                         Size      Sector');
    console.log('----------------------------------------------------');
    for (const { entry } of entries) {
      let typeChar = '-';
      if (isDirectory(entry)) {
        typeChar = 'd';
      } else if (isExecutable(entry)) {
        typeChar = 'x';
      }
      const name = entry.name.padEnd(24);
      const size = entry.size.toString().padStart(10);
      const sector = entry.firstSector.toString().padStart(8);
      console.log(`  ${typeChar}   ${name} ${size} ${sector}`);
    }
    console.log('----------------------------------------------------');
    console.log(`${entries.length} file(s), ${sb.freeSectors} sectors free`);
  } finally {
    image.close();
  }
}

async function cmdExtract(args: string[], options: Options): Promise<void> {
  if (args.length < 2) {
    console.error('Usage: qfs extract <image> <filename> [--output <path>]');
    process.exit(1);
  }

  const imagePath = args[0];
  const filename = args[1];

  const image = new QFSImage(imagePath);
  await image.open();

  try {
    const sb = image.getSuperblock();
    if (sb.magic !== QFS_MAGIC) {
      console.error('Error: invalid QFS image (bad magic number)');
      process.exit(1);
    }

    const resolved = image.resolvePath(filename);
    if (!resolved) {
      console.error(`Error: file '${filename}' not found`);
      process.exit(1);
    }

    if (isDirectory(resolved.entry)) {
      console.error(`Error: '${filename}' is a directory`);
      process.exit(1);
    }

    const data = image.readFile(resolved.entry);
    const outputPath = options.output || resolved.entry.name;
    fs.writeFileSync(outputPath, data);

    console.log(`Extracted: ${resolved.entry.name} -> ${outputPath}`);
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
    console.log(`  Root sector:   ${sb.rootSector}`);
    console.log(`  Data start:    ${sb.dataStart}`);
    console.log(`  Free sectors:  ${sb.freeSectors}`);

    if (sb.magic !== QFS_MAGIC) {
      console.error('\nInvalid QFS image, stopping.');
      process.exit(1);
    }

    console.log('\n=== FAT (non-free entries) ===');
    let fatCount = 0;
    for (let sector = sb.dataStart; sector < sb.totalSectors; sector++) {
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

    console.log('\n=== ROOT DIRECTORY ===');
    const entries = image.listDirEntries();
    if (entries.length === 0) {
      console.log('  (no entries)');
    } else {
      for (const { index, entry } of entries) {
        let flagStr = '';
        if (entry.flags & DIRENT_USED) {
          flagStr += 'U';
        }
        if (entry.flags & DIRENT_DIRECTORY) {
          flagStr += 'D';
        }
        if (entry.flags & DIRENT_EXECUTABLE) {
          flagStr += 'X';
        }
        flagStr = flagStr.padEnd(4);
        console.log(
          `  [${index.toString().padStart(2)}] ${flagStr} ${entry.name.padEnd(24)} size=${entry.size.toString().padStart(8)} sector=${entry.firstSector}`
        );
      }
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
    case 'mkdir':
      await cmdMkdir(args);
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
