/**
 * QFS v2 - Simple File System for Quinix
 *
 * Features:
 * - Dynamic FAT sizing (configurable per-disk)
 * - 24-character filenames
 * - Subdirectory support
 * - Executable flag
 */

// Sector size in bytes (128 words * 4 bytes/word = 512 bytes)
export const SECTOR_SIZE_WORDS = 128;
export const SECTOR_SIZE_BYTES = SECTOR_SIZE_WORDS * 4;

// Superblock is always sector 0, FAT always starts at sector 1
export const SUPERBLOCK_SECTOR = 0;
export const FAT_START_SECTOR = 1;

// FAT entry values
export const FAT_FREE = 0x00000000;
export const FAT_END_OF_CHAIN = 0xffffffff;
export const FAT_RESERVED = 0xfffffffe;

// Directory entry flags
export const DIRENT_FREE = 0x00;
export const DIRENT_USED = 0x01;
export const DIRENT_DIRECTORY = 0x02;
export const DIRENT_EXECUTABLE = 0x04;
export const DIRENT_DELETED = 0x80;

// Directory entry size: 32 words = 128 bytes = 4 entries per sector
export const DIRENT_SIZE_WORDS = 32;
export const DIRENT_SIZE_BYTES = DIRENT_SIZE_WORDS * 4;

// Entries per sector
export const FAT_ENTRIES_PER_SECTOR = SECTOR_SIZE_WORDS; // 128 entries
export const DIRENT_PER_SECTOR = SECTOR_SIZE_WORDS / DIRENT_SIZE_WORDS; // 4 entries

// Filename limit (24 chars, one per word)
export const MAX_FILENAME_LEN = 24;

// Magic number: 'QFS2' in little-endian
export const QFS_MAGIC = 0x51465332;
export const QFS_VERSION = 2;

/**
 * Calculate total sectors from file size in bytes
 */
export function sectorsFromFileSize(fileSize: number): number {
  return Math.floor(fileSize / SECTOR_SIZE_BYTES);
}

/**
 * Calculate recommended FAT sectors for a given total sector count
 */
export function recommendedFatSectors(totalSectors: number): number {
  return Math.ceil(totalSectors / FAT_ENTRIES_PER_SECTOR);
}

/**
 * Superblock structure (sector 0)
 */
export interface Superblock {
  magic: number; // 0x51465332 ('QFS2')
  version: number;
  sectorSize: number; // Words per sector (128)
  totalSectors: number;
  fatStart: number; // Always 1
  fatSectors: number; // Configurable
  rootSector: number; // fatStart + fatSectors
  dataStart: number; // rootSector + 1
  freeSectors: number;
}

/**
 * Directory entry structure (32 words)
 */
export interface DirEntry {
  flags: number;
  firstSector: number;
  size: number; // File size in bytes, or entry count for directories
  name: string; // Up to 24 chars
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
 * Read a null-terminated string from a buffer (one char per word)
 */
export function readString(buffer: Buffer, wordOffset: number, maxWords: number): string {
  let str = '';
  for (let i = 0; i < maxWords; i++) {
    const word = readWord(buffer, (wordOffset + i) * 4);
    if (word === 0) {
      break;
    }
    str += String.fromCharCode(word & 0xff);
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
    rootSector: readWord(buffer, 24),
    dataStart: readWord(buffer, 28),
    freeSectors: readWord(buffer, 32),
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
  writeWord(buffer, 24, sb.rootSector);
  writeWord(buffer, 28, sb.dataStart);
  writeWord(buffer, 32, sb.freeSectors);
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
    // Word 3 is reserved
    name: readString(buffer, wordOffset + 4, MAX_FILENAME_LEN),
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
  writeWord(buffer, byteOffset + 12, 0); // Reserved
  writeString(buffer, wordOffset + 4, MAX_FILENAME_LEN, entry.name);
  // Words 28-31 are reserved
  for (let i = 28; i < 32; i++) {
    writeWord(buffer, byteOffset + i * 4, 0);
  }
}

/**
 * Check if a directory entry is a directory
 */
export function isDirectory(entry: DirEntry): boolean {
  return (entry.flags & DIRENT_DIRECTORY) !== 0;
}

/**
 * Check if a directory entry is executable
 */
export function isExecutable(entry: DirEntry): boolean {
  return (entry.flags & DIRENT_EXECUTABLE) !== 0;
}

/**
 * QFS Image class for reading/writing filesystem images
 */
export class QFSImage {
  private fd: number | null = null;
  private filePath: string;
  private cachedSuperblock: Superblock | null = null;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async open(create: boolean = false): Promise<void> {
    const fs = await import('fs');
    const flags = create ? 'w+' : 'r+';
    this.fd = fs.openSync(this.filePath, flags);
    this.cachedSuperblock = null;
  }

  close(): void {
    if (this.fd !== null) {
      const fs = require('fs');
      fs.closeSync(this.fd);
      this.fd = null;
      this.cachedSuperblock = null;
    }
  }

  readSector(lba: number): Buffer {
    if (this.fd === null) {
      throw new Error('Image not open');
    }
    const fs = require('fs');
    const buffer = Buffer.alloc(SECTOR_SIZE_BYTES);
    const bytesRead = fs.readSync(this.fd, buffer, 0, SECTOR_SIZE_BYTES, lba * SECTOR_SIZE_BYTES);
    if (bytesRead < SECTOR_SIZE_BYTES) {
      buffer.fill(0, bytesRead);
    }
    return buffer;
  }

  writeSector(lba: number, buffer: Buffer): void {
    if (this.fd === null) {
      throw new Error('Image not open');
    }
    const fs = require('fs');
    fs.writeSync(this.fd, buffer, 0, SECTOR_SIZE_BYTES, lba * SECTOR_SIZE_BYTES);
  }

  getSuperblock(): Superblock {
    if (this.cachedSuperblock) {
      return this.cachedSuperblock;
    }
    const buffer = this.readSector(SUPERBLOCK_SECTOR);
    this.cachedSuperblock = readSuperblock(buffer);
    return this.cachedSuperblock;
  }

  setSuperblock(sb: Superblock): void {
    const buffer = Buffer.alloc(SECTOR_SIZE_BYTES);
    writeSuperblock(buffer, sb);
    this.writeSector(SUPERBLOCK_SECTOR, buffer);
    this.cachedSuperblock = sb;
  }

  /**
   * Get FAT entry for a sector
   */
  getFATEntry(sector: number): number {
    const sb = this.getSuperblock();
    const fatIndex = sector;
    const fatSector = sb.fatStart + Math.floor(fatIndex / FAT_ENTRIES_PER_SECTOR);
    const offset = (fatIndex % FAT_ENTRIES_PER_SECTOR) * 4;
    const buffer = this.readSector(fatSector);
    return readWord(buffer, offset);
  }

  /**
   * Set FAT entry for a sector
   */
  setFATEntry(sector: number, value: number): void {
    const sb = this.getSuperblock();
    const fatIndex = sector;
    const fatSector = sb.fatStart + Math.floor(fatIndex / FAT_ENTRIES_PER_SECTOR);
    const offset = (fatIndex % FAT_ENTRIES_PER_SECTOR) * 4;
    const buffer = this.readSector(fatSector);
    writeWord(buffer, offset, value);
    this.writeSector(fatSector, buffer);
  }

  /**
   * Allocate a free sector
   */
  allocateSector(): number | null {
    const sb = this.getSuperblock();
    for (let sector = sb.dataStart; sector < sb.totalSectors; sector++) {
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
    while (sector !== FAT_END_OF_CHAIN && sector !== FAT_FREE && sector !== 0) {
      const next = this.getFATEntry(sector);
      this.setFATEntry(sector, FAT_FREE);
      sb.freeSectors++;
      sector = next;
    }
    this.setSuperblock(sb);
  }

  /**
   * Read directory entries from a directory sector chain
   */
  readDirectory(firstSector: number): Array<{ index: number; entry: DirEntry }> {
    const entries: Array<{ index: number; entry: DirEntry }> = [];
    let sector = firstSector;
    let globalIndex = 0;

    while (sector !== FAT_END_OF_CHAIN && sector !== FAT_FREE && sector !== 0) {
      const buffer = this.readSector(sector);
      for (let i = 0; i < DIRENT_PER_SECTOR; i++) {
        const entry = readDirEntry(buffer, i * DIRENT_SIZE_WORDS);
        if ((entry.flags & DIRENT_USED) !== 0) {
          entries.push({ index: globalIndex, entry });
        }
        globalIndex++;
      }
      sector = this.getFATEntry(sector);
    }

    return entries;
  }

  /**
   * Find entry in a directory by name
   */
  findInDirectory(
    dirSector: number,
    name: string
  ): { sector: number; slotIndex: number; entry: DirEntry } | null {
    let sector = dirSector;

    while (sector !== FAT_END_OF_CHAIN && sector !== FAT_FREE && sector !== 0) {
      const buffer = this.readSector(sector);
      for (let i = 0; i < DIRENT_PER_SECTOR; i++) {
        const entry = readDirEntry(buffer, i * DIRENT_SIZE_WORDS);
        if ((entry.flags & DIRENT_USED) !== 0 && entry.name === name) {
          return { sector, slotIndex: i, entry };
        }
      }
      sector = this.getFATEntry(sector);
    }

    return null;
  }

  /**
   * Find a free slot in a directory, extending if needed
   */
  findFreeSlot(dirSector: number): { sector: number; slotIndex: number } | null {
    let sector = dirSector;
    let prevSector = 0;

    while (sector !== FAT_END_OF_CHAIN && sector !== FAT_FREE && sector !== 0) {
      const buffer = this.readSector(sector);
      for (let i = 0; i < DIRENT_PER_SECTOR; i++) {
        const entry = readDirEntry(buffer, i * DIRENT_SIZE_WORDS);
        if (entry.flags === DIRENT_FREE || (entry.flags & DIRENT_DELETED) !== 0) {
          return { sector, slotIndex: i };
        }
      }
      prevSector = sector;
      sector = this.getFATEntry(sector);
    }

    // Need to allocate a new directory sector
    const newSector = this.allocateSector();
    if (newSector === null) {
      return null;
    }

    // Link it to the chain
    if (prevSector !== 0) {
      this.setFATEntry(prevSector, newSector);
    }

    // Clear the new sector
    const buffer = Buffer.alloc(SECTOR_SIZE_BYTES);
    this.writeSector(newSector, buffer);

    return { sector: newSector, slotIndex: 0 };
  }

  /**
   * Write a directory entry to a specific slot
   */
  writeDirEntryAt(sector: number, slotIndex: number, entry: DirEntry): void {
    const buffer = this.readSector(sector);
    writeDirEntry(buffer, slotIndex * DIRENT_SIZE_WORDS, entry);
    this.writeSector(sector, buffer);
  }

  /**
   * Resolve a path to a directory entry
   * Returns the parent directory sector and the entry, or null if not found
   */
  resolvePath(
    pathStr: string
  ): { parentSector: number; entry: DirEntry; sector: number; slotIndex: number } | null {
    const sb = this.getSuperblock();
    const parts = pathStr.split('/').filter((p) => p.length > 0);

    if (parts.length === 0) {
      // Root directory itself
      return {
        parentSector: 0,
        entry: {
          flags: DIRENT_USED | DIRENT_DIRECTORY,
          firstSector: sb.rootSector,
          size: 0,
          name: '',
        },
        sector: sb.rootSector,
        slotIndex: -1,
      };
    }

    let currentSector = sb.rootSector;
    let parentSector = 0;

    for (let i = 0; i < parts.length; i++) {
      const found = this.findInDirectory(currentSector, parts[i]);
      if (!found) {
        return null;
      }

      if (i === parts.length - 1) {
        // Final component
        return {
          parentSector: currentSector,
          entry: found.entry,
          sector: found.sector,
          slotIndex: found.slotIndex,
        };
      }

      // Must be a directory to continue
      if (!isDirectory(found.entry)) {
        return null;
      }

      parentSector = currentSector;
      currentSector = found.entry.firstSector;
    }

    return null;
  }

  /**
   * List entries in root directory (convenience method)
   */
  listDirEntries(): Array<{ index: number; entry: DirEntry }> {
    const sb = this.getSuperblock();
    return this.readDirectory(sb.rootSector);
  }

  /**
   * Find entry in root directory by name (convenience method)
   */
  findDirEntry(name: string): { index: number; entry: DirEntry } | null {
    const sb = this.getSuperblock();
    const found = this.findInDirectory(sb.rootSector, name);
    if (found) {
      return { index: found.slotIndex, entry: found.entry };
    }
    return null;
  }

  /**
   * Find free slot in root directory (convenience method)
   */
  findFreeDirEntry(): number | null {
    const sb = this.getSuperblock();
    const slot = this.findFreeSlot(sb.rootSector);
    return slot ? slot.slotIndex : null;
  }

  /**
   * Set entry in root directory (convenience method)
   */
  setDirEntry(index: number, entry: DirEntry): void {
    const sb = this.getSuperblock();
    // For simple cases, assume index maps directly to root sector
    const sector = sb.rootSector + Math.floor(index / DIRENT_PER_SECTOR);
    const slotIndex = index % DIRENT_PER_SECTOR;
    this.writeDirEntryAt(sector, slotIndex, entry);
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

    while (sector !== FAT_END_OF_CHAIN && sector !== FAT_FREE && sector !== 0 && remaining > 0) {
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
        if (firstSector !== 0) {
          this.freeSectorChain(firstSector);
        }
        throw new Error('Out of disk space');
      }

      if (firstSector === 0) {
        firstSector = sector;
      } else {
        this.setFATEntry(prevSector, sector);
      }

      const buffer = Buffer.alloc(SECTOR_SIZE_BYTES);
      const toWrite = Math.min(data.length - offset, SECTOR_SIZE_BYTES);
      data.copy(buffer, 0, offset, offset + toWrite);
      this.writeSector(sector, buffer);

      prevSector = sector;
      offset += SECTOR_SIZE_BYTES;
    }

    return firstSector;
  }

  /**
   * Create a new directory
   */
  createDirectory(parentSector: number, name: string): number | null {
    // Allocate a sector for the new directory
    const dirSector = this.allocateSector();
    if (dirSector === null) {
      return null;
    }

    // Clear the directory sector
    const buffer = Buffer.alloc(SECTOR_SIZE_BYTES);
    this.writeSector(dirSector, buffer);

    // Find a free slot in parent
    const slot = this.findFreeSlot(parentSector);
    if (slot === null) {
      this.freeSectorChain(dirSector);
      return null;
    }

    // Write the directory entry
    this.writeDirEntryAt(slot.sector, slot.slotIndex, {
      flags: DIRENT_USED | DIRENT_DIRECTORY,
      firstSector: dirSector,
      size: 0,
      name,
    });

    return dirSector;
  }
}
