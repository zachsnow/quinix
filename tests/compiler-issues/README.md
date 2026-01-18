# Compiler Issues Test Cases

This directory contains minimal test cases for each compiler issue documented in `docs/compiler-issues.md`.

## Running Tests

Each test case is a standalone QLL file that demonstrates a specific compiler issue. To test:

```bash
# Try to compile a test case
bun run bin/qllc.ts tests/compiler-issues/01-nested-namespace.qll

# Expected: compilation error matching the issue description
# After fix: should compile successfully
```

## Test Cases

| File | Issue | Priority | Status |
|------|-------|----------|--------|
| `01-nested-namespace.qll` | Nested namespace function resolution | High | Not Fixed |
| `02-array-negation.qll` | Negation on arrays | High | Not Fixed |
| `03-delete-sized-array.qll` | Delete on sized arrays | High | Not Fixed |
| `04-cast-byte-to-array.qll` | Cast byte to array type | Low | Not Fixed |
| `05-vector-null-init.qll` | Vector null initialization | Critical | Not Fixed |
| `06-delete-vector.qll` | Delete on vectors | Critical | Not Fixed |
| `07-delete-string.qll` | Delete on strings | High | Not Fixed |
| `08-delete-struct-array-field.qll` | Delete on struct array fields | Critical | Not Fixed |
| `09-unsafe-pointer-indexing.qll` | Unsafe indexing on generic pointers | Medium | Not Fixed |
| `10-template-inference-ilist.qll` | Template inference for intrusive lists | Medium | Not Fixed |

## Priority Guide

- **Critical**: Blocks kernel development, breaks standard library
- **High**: Causes workarounds, reduces code quality
- **Medium**: Has workarounds but inconvenient
- **Low**: Has acceptable workarounds

## Notes

Each test case includes:
- A comment describing the expected vs actual behavior
- The minimal code to reproduce the issue
- The exact error message (in comments)

When a compiler issue is fixed, the test case should compile and run successfully.
