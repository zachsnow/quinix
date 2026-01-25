/**
 * QFS - Simple File System for Quinix
 *
 * Shared constants and utilities for QFS filesystem operations.
 */

// Sector size in bytes (128 words * 4 bytes/word = 512 bytes)
export const SECTOR_SIZE_WORDS = 128;
export const SECTOR_SIZE_BYTES = SECTOR_SIZE_WORDS * 4;

// Filesystem layout
export const SUPERBLOCK_SECTOR = 0;
export const FAT_START_SECTOR = 1;
export const FAT_SECTORS = 8;
export const ROOT_START_SECTOR = 9;
export const ROOT_SECTORS = 8;
export const DATA_START_SECTOR = 17;

// FAT entry values
export const FAT_FREE = 0x00000000;
export const FAT_END_OF_CHAIN = 0xffffffff;
export const FAT_RESERVED = 0xfffffffe;

// Directory entry flags
export const DIRENT_FREE = 0x00;
export const DIRENT_USED = 0x01;
export const DIRENT_DELETED = 0x80;

// Directory entry size in words (16 words = 64 bytes)
export const DIRENT_SIZE_WORDS = 16;
export const DIRENT_SIZE_BYTES = DIRENT_SIZE_WORDS * 4;

// Entries per sector
export const FAT_ENTRIES_PER_SECTOR = SECTOR_SIZE_WORDS; // 128 entries
export const DIRENT_PER_SECTOR = SECTOR_SIZE_WORDS / DIRENT_SIZE_WORDS; // 8 entries

// Total capacities
export const MAX_FAT_ENTRIES = FAT_SECTORS * FAT_ENTRIES_PER_SECTOR; // 1024
export const MAX_DIR_ENTRIES = ROOT_SECTORS * DIRENT_PER_SECTOR; // 64

// Magic number: 'QFS1' in little-endian
export const QFS_MAGIC = 0x51465331;
export const QFS_VERSION = 1;

// Filename limits
export const MAX_FILENAME_LEN = 8;
export const MAX_EXTENSION_LEN = 3;

/**
 * Calculate total sectors from file size in bytes
 */
export function sectorsFromFileSize(fileSize: number): number {
  return Math.floor(fileSize / SECTOR_SIZE_BYTES);
}

/**
 * Superblock structure (sector 0)
 */
export interface Superblock {
  magic: number; // 0x51465331 ('QFS1')
  version: number;
  sectorSize: number; // Words per sector
  totalSectors: number;
  fatStart: number;
  fatSectors: number;
  rootStart: number;
  rootSectors: number;
  dataStart: number;
  freeSectors: number;
}

/**
 * Directory entry structure
 */
export interface DirEntry {
  flags: number;
  firstSector: number;
  size: number; // File size in bytes
  name: string; // Up to 8 chars
  extension: string; // Up to 3 chars
}

/**
 * Read a 32-bit little-endian word from a buffer
 */
export function readWord(buffer: Buffer, offset: number): number {
  return buffer.readUInt32LE(offset);
}

/**
 * Write a 32-bit little-endian word to a buffer
 */
export function writeWord(buffer: Buffer, offset: number, value: number): void {
  buffer.writeUInt32LE(value >>> 0, offset);
}

/**
 * Read a null-terminated string from a buffer (words)
 */
export function readString(buffer: Buffer, wordOffset: number, maxWords: number): string {
  let str = '';
  for (let i = 0; i < maxWords; i++) {
    const word = readWord(buffer, (wordOffset + i) * 4);
    if (word === 0) {
      break;
    }
    // Each word is a single character in QLL
    const char = String.fromCharCode(word & 0xff);
    if (char === '\0') {
      break;
    }
    str += char;
  }
  return str;
}

/**
 * Write a null-terminated string to a buffer (one char per word)
 */
export function writeString(
  buffer: Buffer,
  wordOffset: number,
  maxWords: number,
  str: string
): void {
  for (let i = 0; i < maxWords; i++) {
    if (i < str.length) {
      writeWord(buffer, (wordOffset + i) * 4, str.charCodeAt(i));
    } else {
      writeWord(buffer, (wordOffset + i) * 4, 0);
    }
  }
}

/**
 * Read superblock from a sector buffer
 */
export function readSuperblock(buffer: Buffer): Superblock {
  return {
    magic: readWord(buffer, 0),
    version: readWord(buffer, 4),
    sectorSize: readWord(buffer, 8),
    totalSectors: readWord(buffer, 12),
    fatStart: readWord(buffer, 16),
    fatSectors: readWord(buffer, 20),
    rootStart: readWord(buffer, 24),
    rootSectors: readWord(buffer, 28),
    dataStart: readWord(buffer, 32),
    freeSectors: readWord(buffer, 36),
  };
}

/**
 * Write superblock to a sector buffer
 */
export function writeSuperblock(buffer: Buffer, sb: Superblock): void {
  writeWord(buffer, 0, sb.magic);
  writeWord(buffer, 4, sb.version);
  writeWord(buffer, 8, sb.sectorSize);
  writeWord(buffer, 12, sb.totalSectors);
  writeWord(buffer, 16, sb.fatStart);
  writeWord(buffer, 20, sb.fatSectors);
  writeWord(buffer, 24, sb.rootStart);
  writeWord(buffer, 28, sb.rootSectors);
  writeWord(buffer, 32, sb.dataStart);
  writeWord(buffer, 36, sb.freeSectors);
}

/**
 * Read directory entry from buffer at given word offset
 */
export function readDirEntry(buffer: Buffer, wordOffset: number): DirEntry {
  const byteOffset = wordOffset * 4;
  return {
    flags: readWord(buffer, byteOffset),
    firstSector: readWord(buffer, byteOffset + 4),
    size: readWord(buffer, byteOffset + 8),
    name: readString(buffer, wordOffset + 3, 8),
    extension: readString(buffer, wordOffset + 11, 4),
  };
}

/**
 * Write directory entry to buffer at given word offset
 */
export function writeDirEntry(buffer: Buffer, wordOffset: number, entry: DirEntry): void {
  const byteOffset = wordOffset * 4;
  writeWord(buffer, byteOffset, entry.flags);
  writeWord(buffer, byteOffset + 4, entry.firstSector);
  writeWord(buffer, byteOffset + 8, entry.size);
  writeString(buffer, wordOffset + 3, 8, entry.name);
  writeString(buffer, wordOffset + 11, 4, entry.extension);
  // Reserved words (2)
  writeWord(buffer, byteOffset + 60, 0);
}

/**
 * Parse a filename into name and extension parts
 */
export function parseFilename(filename: string): { name: string; extension: string } {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1 || lastDot === 0) {
    return {
      name: filename.substring(0, MAX_FILENAME_LEN),
      extension: '',
    };
  }
  return {
    name: filename.substring(0, lastDot).substring(0, MAX_FILENAME_LEN),
    extension: filename.substring(lastDot + 1).substring(0, MAX_EXTENSION_LEN),
  };
}

/**
 * Format a directory entry name for display
 */
export function formatFilename(entry: DirEntry): string {
  if (entry.extension) {
    return `${entry.name}.${entry.extension}`;
  }
  return entry.name;
}

/**
 * Calculate FAT sector and offset for a data sector index
 */
export function fatLocation(dataSector: number): { sector: number; offset: number } {
  const fatIndex = dataSector - DATA_START_SECTOR;
  const sector = FAT_START_SECTOR + Math.floor(fatIndex / FAT_ENTRIES_PER_SECTOR);
  const offset = (fatIndex % FAT_ENTRIES_PER_SECTOR) * 4;
  return { sector, offset };
}

/**
 * Calculate directory sector and offset for an entry index
 */
export function dirLocation(entryIndex: number): { sector: number; wordOffset: number } {
  const sector = ROOT_START_SECTOR + Math.floor(entryIndex / DIRENT_PER_SECTOR);
  const wordOffset = (entryIndex % DIRENT_PER_SECTOR) * DIRENT_SIZE_WORDS;
  return { sector, wordOffset };
}

/**
 * QFS Image class for reading/writing filesystem images
 */
export class QFSImage {
  private fd: number | null = null;
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  /**
   * Open the image file for reading and writing
   */
  async open(create: boolean = false): Promise<void> {
    const fs = await import('fs');
    const flags = create ? 'w+' : 'r+';
    this.fd = fs.openSync(this.filePath, flags);
  }

  /**
   * Close the image file
   */
  close(): void {
    if (this.fd !== null) {
      const fs = require('fs');
      fs.closeSync(this.fd);
      this.fd = null;
    }
  }

  /**
   * Read a sector from the image
   */
  readSector(lba: number): Buffer {
    if (this.fd === null) {
      throw new Error('Image not open');
    }
    const fs = require('fs');
    const buffer = Buffer.alloc(SECTOR_SIZE_BYTES);
    const bytesRead = fs.readSync(this.fd, buffer, 0, SECTOR_SIZE_BYTES, lba * SECTOR_SIZE_BYTES);
    if (bytesRead < SECTOR_SIZE_BYTES) {
      // Pad with zeros if reading beyond end of file
      buffer.fill(0, bytesRead);
    }
    return buffer;
  }

  /**
   * Write a sector to the image
   */
  writeSector(lba: number, buffer: Buffer): void {
    if (this.fd === null) {
      throw new Error('Image not open');
    }
    const fs = require('fs');
    fs.writeSync(this.fd, buffer, 0, SECTOR_SIZE_BYTES, lba * SECTOR_SIZE_BYTES);
  }

  /**
   * Read the superblock
   */
  getSuperblock(): Superblock {
    const buffer = this.readSector(SUPERBLOCK_SECTOR);
    return readSuperblock(buffer);
  }

  /**
   * Write the superblock
   */
  setSuperblock(sb: Superblock): void {
    const buffer = Buffer.alloc(SECTOR_SIZE_BYTES);
    writeSuperblock(buffer, sb);
    this.writeSector(SUPERBLOCK_SECTOR, buffer);
  }

  /**
   * Read a FAT entry
   */
  getFATEntry(dataSector: number): number {
    const { sector, offset } = fatLocation(dataSector);
    const buffer = this.readSector(sector);
    return readWord(buffer, offset);
  }

  /**
   * Write a FAT entry
   */
  setFATEntry(dataSector: number, value: number): void {
    const { sector, offset } = fatLocation(dataSector);
    const buffer = this.readSector(sector);
    writeWord(buffer, offset, value);
    this.writeSector(sector, buffer);
  }

  /**
   * Find a free data sector
   */
  allocateSector(): number | null {
    const sb = this.getSuperblock();
    for (let sector = DATA_START_SECTOR; sector < sb.totalSectors; sector++) {
      if (this.getFATEntry(sector) === FAT_FREE) {
        this.setFATEntry(sector, FAT_END_OF_CHAIN);
        sb.freeSectors--;
        this.setSuperblock(sb);
        return sector;
      }
    }
    return null;
  }

  /**
   * Free a chain of sectors
   */
  freeSectorChain(firstSector: number): void {
    const sb = this.getSuperblock();
    let sector = firstSector;
    while (sector !== FAT_END_OF_CHAIN && sector !== FAT_FREE) {
      const next = this.getFATEntry(sector);
      this.setFATEntry(sector, FAT_FREE);
      sb.freeSectors++;
      sector = next;
    }
    this.setSuperblock(sb);
  }

  /**
   * Read a directory entry by index
   */
  getDirEntry(index: number): DirEntry {
    const { sector, wordOffset } = dirLocation(index);
    const buffer = this.readSector(sector);
    return readDirEntry(buffer, wordOffset);
  }

  /**
   * Write a directory entry by index
   */
  setDirEntry(index: number, entry: DirEntry): void {
    const { sector, wordOffset } = dirLocation(index);
    const buffer = this.readSector(sector);
    writeDirEntry(buffer, wordOffset, entry);
    this.writeSector(sector, buffer);
  }

  /**
   * Find a directory entry by name
   */
  findDirEntry(name: string, extension: string): { index: number; entry: DirEntry } | null {
    for (let i = 0; i < MAX_DIR_ENTRIES; i++) {
      const entry = this.getDirEntry(i);
      if (
        entry.flags === DIRENT_USED &&
        entry.name === name &&
        entry.extension === extension
      ) {
        return { index: i, entry };
      }
    }
    return null;
  }

  /**
   * Find a free directory entry
   */
  findFreeDirEntry(): number | null {
    for (let i = 0; i < MAX_DIR_ENTRIES; i++) {
      const entry = this.getDirEntry(i);
      if (entry.flags === DIRENT_FREE || entry.flags === DIRENT_DELETED) {
        return i;
      }
    }
    return null;
  }

  /**
   * List all used directory entries
   */
  listDirEntries(): Array<{ index: number; entry: DirEntry }> {
    const entries: Array<{ index: number; entry: DirEntry }> = [];
    for (let i = 0; i < MAX_DIR_ENTRIES; i++) {
      const entry = this.getDirEntry(i);
      if (entry.flags === DIRENT_USED) {
        entries.push({ index: i, entry });
      }
    }
    return entries;
  }

  /**
   * Read file data following the FAT chain
   */
  readFile(entry: DirEntry): Buffer {
    if (entry.firstSector === 0) {
      return Buffer.alloc(0);
    }

    const chunks: Buffer[] = [];
    let sector = entry.firstSector;
    let remaining = entry.size;

    while (sector !== FAT_END_OF_CHAIN && sector !== FAT_FREE && remaining > 0) {
      const buffer = this.readSector(sector);
      const toRead = Math.min(remaining, SECTOR_SIZE_BYTES);
      chunks.push(buffer.subarray(0, toRead));
      remaining -= toRead;
      sector = this.getFATEntry(sector);
    }

    return Buffer.concat(chunks);
  }

  /**
   * Write file data, allocating sectors as needed
   */
  writeFile(data: Buffer): number {
    if (data.length === 0) {
      return 0;
    }

    let firstSector = 0;
    let prevSector = 0;
    let offset = 0;

    while (offset < data.length) {
      const sector = this.allocateSector();
      if (sector === null) {
        // Out of space - free what we allocated
        if (firstSector !== 0) {
          this.freeSectorChain(firstSector);
        }
        throw new Error('Out of disk space');
      }

      if (firstSector === 0) {
        firstSector = sector;
      } else {
        // Link previous sector to this one
        this.setFATEntry(prevSector, sector);
      }

      // Write data to sector
      const buffer = Buffer.alloc(SECTOR_SIZE_BYTES);
      const toWrite = Math.min(data.length - offset, SECTOR_SIZE_BYTES);
      data.copy(buffer, 0, offset, offset + toWrite);
      this.writeSector(sector, buffer);

      prevSector = sector;
      offset += SECTOR_SIZE_BYTES;
    }

    return firstSector;
  }
}
