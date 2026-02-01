# Plan: Rename `byte` to `word` in Quinix

> **Status:** Deferred. This plan documents the work needed if we decide to rename `byte` to `word` in the future.

## Rationale

Quinix is a 32-bit word-addressable VM where the smallest addressable unit is 32 bits. The QLL language currently names this type `byte`, which is misleading since modern convention associates "byte" with 8-bit octets. A more accurate name would be `word`.

---

## Summary

Rename the `byte` type to `word` across all three Quinix repositories.

**Approach:** Clean break (no backward compatibility period) - the project is educational and all repos are under single control.

---

## Phase 1: Core Compiler (quinix)

### 1.1 Parser Grammar
- `src/lowlevel/base-parser.pegjs`
  - Line 68: `ByteToken` → `WordToken` in Tokens rule
  - Line 82: Rename rule, change `"byte"` → `"word"`
- `src/lowlevel/types-parser.pegjs`
  - Line 10: `ByteToken` → `WordToken`

### 1.2 Type System
- `src/lowlevel/types.ts`
  - Line 167: `Builtins` array: `'byte'` → `'word'`
  - Line 1232: `export const Byte` → `export const Word`
  - Lines 1063-1064, 1177-1178: `Type.Byte` → `Type.Word` in slice checks
  - Line 110: `isConvertibleTo(Type.Byte)` → `Type.Word`

### 1.3 Expression Type Checking
- `src/lowlevel/expressions.ts` (~16 locations)
  - All `Type.Byte` → `Type.Word`

### 1.4 Type Registry
- `src/lowlevel/lowlevel.ts`
  - Line 1048-1049: `Type.Byte` → `Type.Word` for bool/string aliases

### 1.5 Rebuild
```bash
./build.sh  # Regenerates parsers
```

---

## Phase 2: Tests (quinix)

- `src/lowlevel/types.test.ts` (~83 occurrences)
- `src/lowlevel/expressions.test.ts` (~21 occurrences)
- `src/lowlevel/lowlevel.test.ts` (~373 occurrences)

**Strategy:** Find/replace `\bbyte\b` → `word`

```bash
bun test  # Verify all pass
```

---

## Phase 3: QLL Source Files (quinix)

**91 files, ~687 occurrences**

Priority order:
1. `shared/std.qll`, `shared/alloc.qll`, `shared/buffered.qll`
2. `bare/*.qll`, `user/*.qll`
3. `kernel/*.qll`
4. `examples/**/*.qll`, `tests/**/*.qll`

**Strategy:** Batch replace in each directory

---

## Phase 4: Documentation (quinix)

- `docs/qll.md` (~39 occurrences) - primary type reference
- `docs/qpu.md`, `docs/qvm.md`, `docs/qasm.md`, `docs/qfs.md`
- `CLAUDE.md`

---

## Phase 5: VS Code Extension (quinix-vscode)

Single change:
- `syntaxes/qll.tmLanguage.json` line 41:
  ```
  \\b(struct|void|byte|bool|string)\\b
  ```
  →
  ```
  \\b(struct|void|word|bool|string)\\b
  ```

---

## Phase 6: Website (quinix-site)

### 6.1 Series Articles (21 files, ~220 occurrences)
- Special attention: `src/series/09-lowlevel-language.md` lines 113-114 - remove acknowledgment about renaming
- All series files with QLL examples

### 6.2 JavaScript
- `src/js/app.js` line 89: storage types list

### 6.3 Bundled Compiler
- `src/js/lib/quinix.js` - regenerated from quinix build
- Run `./build.sh` in quinix-site after quinix changes complete

---

## Execution Order

1. **quinix** - all phases 1-4, commit
2. **quinix-vscode** - phase 5, commit
3. **quinix-site** - phase 6, commit

---

## Verification

| Phase | Verification |
|-------|--------------|
| 1 | `./build.sh` succeeds |
| 2 | `bun test` passes |
| 3 | `bun run bin/qrun.ts examples/lowlevel/hello-world.qll` works |
| 4 | Manual review |
| 5 | Open .qll file, verify `word` highlighted |
| 6 | Website demo compiles/runs with `word` type |

Final check: `grep -r '\bbyte\b' --include='*.qll' --include='*.ts' --include='*.md'` finds no stray references.
