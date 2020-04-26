# Quinix: A quarantine experiment

[Quinix](https://quinix.vein.io) is an enjoyable excursion into virtual machines, assemblers,
compilers, and operating systems.

### QPU

First thing's first: [let's design a CPU!](./docs/qpu.md)
The QPU is an idealized 32-bit RISC processor. It supports a more-or-less
arbitrary number of *peripherals*, which interact with it via direct memory
access.  It supports hardware and software *interrupts*, including a timer
and a generic software interrupt. It has a simple memory-mapping
unit (or MMU), to assist in the implementation of virtual memory.

### QVM

Now that we have in mind a simple arcitecture, [let's build a virtual machine!](./docs/qvm.md)

The Quinix virtual machine, or QVM, implements the QPU. It is implemented
in Typescript and runs both on node and in the browser. It models the memory of the system as a
`Uint32Array`. It supports just a few peripherals for now, including console input and output.

### QASM

Writing binaries for the QVM is pain, so [let's build an assembler!](./docs/qasm.md)

The Quinix assembler, or QASM, is a Typescript assembler that can assemble binaries to run
on the QVM.  It supports a fairly minimal assembly language -- it is not a "macro assembler",
but it does provide a few useful facilities, like labels for code locations and data,
that make it somewhat easier to write binaries for our virtual machine.

### QLL

Even writing assembly and assembling it with QASM can be tedious, but (for now) instead
of improving the experience (for instance, by adding pseudo-instructions that are compiled
to "native" instructions)... [Let's build a compiler!](./docs/qll.md)

The Quinix "low-level language", or QLL, is something like a simplified C. To be honest,
QLL is still pretty frustratingly low level, so we'll extend QLL as we go.

### Quinix OS

Finally, we have the tools we need... [Let's build an operating system!](./docs/qos.md)

## Local development

First, the install prerequisites and build the various parsers, executables, and runtimes:

```bash
$ npm i
$ ./build.sh
```

The executables are located at `./bin/` and by default run via `ts-node`.
Due to the slow startup time, you may prefer to run the built executables, which
are located at `./build/bin/`. To compile, assemble, and run a QLL program:

```bash
$ ./bin/qllc.ts -o file.qasm file.qll
$ ./bin/qasm.ts -o file.qbin file.qasm
$ ./bin/qvm.ts file.qbin
```

Run tests:

```bash
$ npm t
```

## Installing

I wouldn't do that if I were you.
