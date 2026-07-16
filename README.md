# lib-change-descent

The first part of how lkman is going to work...  This probably exists elsewhere much better.

# PHASE 1

## CONSTRAINTS

- [ ] only ever load and execute the very minimum required for the operation, no enterprise style bloat.. constructors, runtime, scope, constants, handles
- [ ] define tasks and the object shape...
- [ ] toleration, severity, security, reliability, resilence
- [ ] strict separation of invariant assertions (`invariant()`) for non-operation setup vs operation-controlled code that runs inside `try {} catch {}` with automatic `retry()` up to failure thresholds


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
- fixed limit custom byte size 

## STRING HEAP MITIGATION

**The Bottleneck:** Relying on `TextDecoder` to continuously convert `Uint8Array` string heaps back into native JavaScript strings for path comparisons will destroy our mechanical sympathy by triggering massive Garbage Collection (GC) pauses and CPU overhead.

**The Mitigation:** 
1. **Binary-First Processing:** Path comparisons and hashing (e.g., using BLAKE3) must be executed *directly* on the raw binary `Uint8Array` slices.
2. **Decode at the Edge:** We strictly reserve `TextDecoder` (and the instantiation of JS String objects) for the absolute edge of the application—only when rendering output to the UI or logging for humans.

**Codebase Strategy:**
When looking up a node by name, do not decode the node's `NamePointer` to a string. Instead, encode the target search string into binary *once*, hash it with BLAKE3, and compare the binary hashes against the tree's hash pointers.

## ARCHITECTURAL PARADIGM: DUAL STORAGE DESIGN

To balance robust offline state preservation with mechanical efficiency, `lib-change-descent` employs a split-storage model:

1. **Persistent State Storage (SQLite):** SQLite serves as the structured database for volume mappings, session profiles, historic configuration, and offline data indexing. It provides crash resilience and robust query support for slow/cold state transitions.
2. **In-Memory Active Workspace (Custom Binary Buffer & String Heap):** High-frequency descent comparisons and path traversals bypass the database and operate directly inside a fixed-stride binary workspace. This avoids the garbage collector (GC) entirely, ensuring high-concurrency performance and zero-allocation hot paths during active volume scans.

## CONCURRENCY & JOURNAL CONCERN

Since reading the native OS journal (e.g., Windows NTFS USN or Linux `fanotify`) will be the preferred mechanism for continuous volume monitoring, **this stream must be threaded and completely non-locking.** Because `lib-change-descent` is designed to be embedded as a high-performance library within larger applications, it cannot lock directory structures, hold restrictive file descriptors (`GENERIC_READ` without share flags), or block event loops while consuming journal streams. While many other filesystem tools inexplicably lock volume resources or freeze application threads during active monitoring, this library avoids blocking or locking behavior entirely by offloading native queries to dedicated worker runtimes (`src-zig.dev` / `Worker Isolate`) and sliding binary packets over `SharedArrayBuffer` memory pools.

## COMPOSED OPERATIONS & MICRO-PAUSES

To ensure the library executes the absolute minimum unique code per operation (`thisArg` context passing) while remaining resilient under heavy I/O, operations are designed as composed pipelines:
1. **Operation-Controlled Execution & Retries:** Every operation (and sub-operation) executes inside `try { ... } catch (err)` blocks where transient filesystem locks, volume delays, or resource contention automatically invoke `retry(ctx, err, attempt)`. We strictly avoid throwing uncatchable `invariant()` errors inside operation pipelines so retry logic can attempt recovery.
2. **Micro-Pauses (`libcd_micro_pause`):** Because complex operations are composed of smaller sub-operations (`thisArg` pipelines), step boundaries and retry backoff loops yield execution via micro-pauses. Profile modifiers (`+bg`: 10ms yield, `+fg`: 1ms yield, `-nolimits`: 0ms zero-pause) dynamically control yield durations, allowing the V8 event loop and host application to breathe without duplicating operational flow or stalling concurrent tasks.


