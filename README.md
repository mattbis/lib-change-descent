# lib-change-descent

The first part of how lkman is going to work...  This probably exists elsewhere much better.

## CONSTRAINTS

- [ ] only ever load and execute the very minimum required for the operation, no enterprise style bloat.. constructors, runtime, scope, constants, handles
- [ ] define tasks and the object shape...

## STRING HEAP MITIGATION (PHASE 1.3)

**The Bottleneck:** Relying on `TextDecoder` to continuously convert `Uint8Array` string heaps back into native JavaScript strings for path comparisons will destroy our mechanical sympathy by triggering massive Garbage Collection (GC) pauses and CPU overhead.

**The Mitigation:** 
1. **Binary-First Processing:** Path comparisons and hashing (e.g., using BLAKE3) must be executed *directly* on the raw binary `Uint8Array` slices.
2. **Decode at the Edge:** We strictly reserve `TextDecoder` (and the instantiation of JS String objects) for the absolute edge of the application—only when rendering output to the UI or logging for humans.

**Codebase Strategy:**
When looking up a node by name, do not decode the node's `NamePointer` to a string. Instead, encode the target search string into binary *once*, hash it with BLAKE3, and compare the binary hashes against the tree's hash pointers.

## WIP

- [ ] ~~TypeScript? depends whether it mangles the output too much, everything has to remain simple and exact, since GC is the enemy~~
- [ ] debug and dev/alpha consistency checks
- [ ] motion types and strategies
- [ ] os stuff
- [ ] offset test and playing
- [ ] page sizes (node size)
- [ ] text storage sizes
- [ ] max limits (views, node count, heap size) - would require aging hash probably or some kinda background clear of cache data, for the core operation - this might grow quite big - depending on the number of volumes. ( this is part of profiles mod +unlimited )
- [ ] session
- [ ] consistent error messages with code and standard `[THING]`
- [ ] shared buffer from host and protocol finish... something is not right here... probably need to get something working to revise it
- [ ] 3 revision for alpha?

performance isn't important - just that this allows integration with other systems and is aimed for function over filesystem
