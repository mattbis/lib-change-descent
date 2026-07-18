# lib-change-descent

#### status: initial

The first part of how lkman is going to work...  This probably exists elsewhere much better.

## PROJECT PHASES & ROADMAP

### Phase 1: Pure JS Core (`src-mjs.dev`) & Zero-GC Foundation
**Goal:** Complete the native Node.js (`1p/2p`) shared memory pool and verify zero-allocation assumptions.
- [x] Shared Memory Accessors (`node_buffer` & `string_heap`)
- [x] `libcd_self_check.0.mjs` & Integrity Verification
- [ ] Cache-Line Padding for Control Buffers (prevent false sharing)

### Phase 2: Decent Descent Float Hash Engine
**Goal:** Implement the mathematical float hashing engine across all volume species (`Fixed`, `Volatile`, `Virtual`).
- [x] Node & Directory Fractional Hashing ($K_1 \dots K_4$ scale in $[0,1)$ domain)
- [x] Volume Species Adaptation (Behavioral Vole Masks & incremental hash bubbling)
- [x] Operation Lifecycle micro-pause yields and try/catch retry boundaries

### Phase 3: Native Zig Subprocess Integration (`src-zig.dev`)
**Goal:** Achieve maximum mechanical sympathy via native OS kernels for near-zero CPU overhead change monitoring.
- [ ] Windows NTFS USN Journal Reader (`libcd-journal.exe`)
- [ ] Linux VFS Stream & `fanotify` Hook
- [ ] Stream Consumer (`libcd_os_journal.mjs`) & Unprivileged Fallbacks

### Phase 4: Dual Surface Polish & Production Verification
**Goal:** Lock in tree-shaking, publish forensic logging, and benchmark against industry standards.
- [ ] Tree-Shaking Verification (Dual Surface API class extraction)
- [ ] Immutable Manifest Storage (flush thresholds)
- [ ] Comprehensive Benchmarking & Stress Testing vs Chokidar


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


