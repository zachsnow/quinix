# Quinix Low-level Language

The Quinix low-level language, QLL, is a simple, statically typed C-like language.

The Quinix low-level language compiler, QLLC, takes `.qll` files and generates assembly
programs (`.qasm` files) suitable for assembly using the [Quinix assembler.](./qasm.md)

## Technical details

### Stack frames

```
argument 1          : the first function argument.
...
argument n          : the last function argument.

return address      : the return address to jump to at the end of the function.

local n             : storage for the first local.
...
local 1             : storage for the last local.

temporary storage   : any temporary storage needed; 0 for now.
...
temporary storage

callee save 1       : the first callee-saved register.
...
callee save n       : the last callee-saved register.

stack frame address : address of return address on stack.
```

For functions that return non-integral values, we must provide a *destination*
for the function to store the return value. This is passed like an argument,
and return statements in the body of the function are compiled to write to
this destination before returning:

```
return          : the *address* of the return value; like a "0th" argument.
argument 1      : the first function argument.
...
argument n      : the last function argument.
...
```
