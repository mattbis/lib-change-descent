# lib-change-descent

The first part of how lkman is going to work...  This probably exists elsewhere much better.

# PHASE 1

## CONSTRAINTS

- [ ] only ever load and execute the very minimum required for the operation, no enterprise style bloat.. constructors, runtime, scope, constants, handles
- [ ] define tasks and the object shape...

## WIP

- [ ] ~~TypeScript? depends whether it mangles the output too much, everything has to remain simple and exact, since GC is the enemy~~
- [ ] memory layout & bounds: node stride, text storage sizes, and offset testing
- [ ] scale limits: max views, node count, and heap size (needs cache aging/clearing for massive multi-volume profiles to prevent heap blowouts)
- [ ] os interop & concurrency: os filters and resolving the shared buffer host protocol (needs a working prototype to revise)
- [ ] engine core: motion types, strategies, and session management
- [ ] diagnostics & release: dev/alpha consistency checks, standardized error codes `[THING]`, targeting 3 revisions for alpha
- [ ] codify masks... that are the mechanical description of controlling byte codes to change behaviour

performance isn't important - just that this allows integration with other systems and is aimed for function over filesystem

# PHASE 2

- schema generation on use case, its static, but still architecture phase ( 1 )

## STRING HEAP MITIGATION

**The Bottleneck:** Relying on `TextDecoder` to continuously convert `Uint8Array` string heaps back into native JavaScript strings for path comparisons will destroy our mechanical sympathy by triggering massive Garbage Collection (GC) pauses and CPU overhead.

**The Mitigation:** 
1. **Binary-First Processing:** Path comparisons and hashing (e.g., using BLAKE3) must be executed *directly* on the raw binary `Uint8Array` slices.
2. **Decode at the Edge:** We strictly reserve `TextDecoder` (and the instantiation of JS String objects) for the absolute edge of the application—only when rendering output to the UI or logging for humans.

**Codebase Strategy:**
When looking up a node by name, do not decode the node's `NamePointer` to a string. Instead, encode the target search string into binary *once*, hash it with BLAKE3, and compare the binary hashes against the tree's hash pointers.
