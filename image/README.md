# Example disk image

This is an example disk image for use with the kernel.

First, build the image, from this directory. This will produce a
QFS v2 image of the `data` directory, while also compiling the user
binaries in `data/bin`.

```bash
./build.sh
```

Then, run the kernel with the image, from the root of the repository:

```bash
bun run bin/qvm.ts kernel/kernel.qbin --disk image/disk.qfs
```

For graphical programs (e.g. brickout), add display and keyboard support:

```bash
bun run bin/qvm.ts kernel/kernel.qbin --disk image/disk.qfs --display 320x200 --keyboard
```
