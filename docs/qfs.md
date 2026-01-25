# QFS - Quinix File System

QFS is a simple FAT-like file system for Quinix. It supports hierarchical directories, 24-character filenames, and executable flags.

## Features

- **Dynamic FAT sizing**: FAT size scales with disk size
- **Subdirectories**: Hierarchical directory structure
- **24-character filenames**: Single name field (no 8.3 restriction)
- **Executable flag**: Mark files as executable
- **Large disk support**: Up to 64MB+ with appropriate FAT sizing

## Disk Layout

```
Sector 0:           Superblock
Sectors 1..N:       FAT (N = ceil(totalSectors / 128))
Sector N+1:         Root directory (chainable)
Sectors N+2+:       Data sectors
```

**Sector size**: 128 words = 512 bytes

## Data Structures

### Superblock (sector 0)

| Offset (words) | Field        | Description                    |
|----------------|--------------|--------------------------------|
| 0              | magic        | 0x51465332 ('QFS2')            |
| 1              | version      | 2                              |
| 2              | sectorSize   | Words per sector (128)         |
| 3              | totalSectors | Total sectors on disk          |
| 4              | fatStart     | FAT start sector (always 1)    |
| 5              | fatSectors   | Number of FAT sectors          |
| 6              | rootSector   | Root directory sector          |
| 7              | dataStart    | First data sector              |
| 8              | freeSectors  | Free sector count              |

### FAT Entry (1 word)

Each FAT entry is a 32-bit word:

| Value        | Meaning           |
|--------------|-------------------|
| 0x00000000   | Free sector       |
| 0xFFFFFFFF   | End of chain      |
| 0xFFFFFFFE   | Reserved          |
| Other        | Next sector index |

The FAT contains one entry per data sector. Entry index corresponds to the sector number.

### Directory Entry (32 words = 128 bytes)

| Offset (words) | Field       | Description                    |
|----------------|-------------|--------------------------------|
| 0              | flags       | Entry flags (see below)        |
| 1              | firstSector | First sector of file/directory |
| 2              | size        | Size in bytes (files) or entries (dirs) |
| 3              | reserved    | Reserved                       |
| 4-27           | name        | Filename (1 char per word, null-terminated) |
| 28-31          | reserved    | Reserved                       |

4 directory entries fit in one sector.

**Flags**:

| Flag | Value | Description          |
|------|-------|----------------------|
| USED | 0x01  | Entry is in use      |
| DIR  | 0x02  | Entry is a directory |
| EXEC | 0x04  | File is executable   |
| DEL  | 0x80  | Entry is deleted     |

## Host Tools

The `qfs` command-line tool manages QFS images from the host system.

### Create an image

```bash
bun run bin/qfs.ts create disk.img --sectors 2048
```

Creates a 1MB disk image (2048 sectors * 512 bytes).

Options:
- `--sectors N`: Total sectors (default: 1024)
- `--fat-sectors N`: Override FAT size (default: auto)
- `--from DIR`: Populate image from directory contents

### Create an image from a directory

```bash
bun run bin/qfs.ts create disk.img --from /path/to/files
```

Scans the directory recursively, calculates the required size, and creates an image containing all files and subdirectories.

### Add a file

```bash
bun run bin/qfs.ts add disk.img myfile.txt
bun run bin/qfs.ts add disk.img program.qbin --exec --name app
```

Options:
- `--name NAME`: Override filename
- `--exec`: Mark as executable

### Create a directory

```bash
bun run bin/qfs.ts mkdir disk.img /mydir
bun run bin/qfs.ts mkdir disk.img /mydir/subdir
```

### List files

```bash
bun run bin/qfs.ts list disk.img
bun run bin/qfs.ts list disk.img /mydir
```

### Extract a file

```bash
bun run bin/qfs.ts extract disk.img myfile.txt
bun run bin/qfs.ts extract disk.img /mydir/file.txt --output localfile.txt
```

### Debug dump

```bash
bun run bin/qfs.ts dump disk.img
```

Shows superblock, FAT entries, and directory contents.

## Running with QVM

Use the `--disk` option to attach a QFS image as a block device:

```bash
bun run bin/qvm.ts program.qbin --disk disk.img
```

## Kernel Interface

The kernel provides file system operations through syscalls:

| Syscall | Number | Description              |
|---------|--------|--------------------------|
| OPEN    | 0x03   | Open file, returns handle |
| CLOSE   | 0x04   | Close handle             |
| READ    | 0x01   | Read from handle         |
| WRITE   | 0x02   | Write to handle          |

File handles start at 0x10 to avoid collision with standard I/O handles (0 = stdin, 1 = stdout).

## Limits

| Parameter          | Value  |
|--------------------|--------|
| Filename length    | 24 chars |
| Entries per sector | 4      |
| FAT entries/sector | 128    |
| Sector size        | 512 bytes |

Maximum disk size depends on FAT sizing:
- 8 FAT sectors: 1024 data sectors = 512KB
- 128 FAT sectors: 16384 data sectors = 8MB
- 1024 FAT sectors: 131072 data sectors = 64MB

## Implementation Files

- `src/platform/server/qfs.ts` - QFS library (host-side)
- `bin/qfs.ts` - CLI tool
- `kernel/block.qll` - Block device driver
- `kernel/fs.qll` - File system operations
