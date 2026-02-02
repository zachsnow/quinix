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
bun run qvm kernel/kernel.qbin --disk image/disk.qfs
```
