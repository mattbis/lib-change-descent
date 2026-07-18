## project channels (.dev / .main / .testing)

- in this project we strictly organize source code and verification harnesses into dedicated channels...
- `src-mjs.dev` / `src-zig.dev`: active development, prototypes, and fast iteration implementations...
- `src-mjs.main` / `src-zig.main`: stable, hardened, production-ready modules...
- `src-mjs.testing` / `src-zig.testing`: dedicated verification harnesses, behavioral tests, and invariant check suites...
- keep language concerns separated across `mjs` and `zig` channels...

## space-prefixed function naming (`volume_imprint`, `volume_has_mask`)

- functions exported within a module/space must be named or prefixed after their space/path within the library...
- for example in `libcd_volume.mjs`, functions must be named `volume_imprint`, `volume_has_mask`, `volume_add_mask`, `volume_clear_mask` instead of broad names like `clear_mask` or generic `imprint`...
- this makes every function globally distinct, uniformly searchable (`grep`), and easily traceable to its exact library coordinate across hot paths and dual surface class wrappers...

## runtime operation

- it executes a function that is the current operation, some stuff happens in order, sections then are async, worker, sync and just the calls that are needed... they are compiled, when one of the entry function triggers a cycle, and the lifecycle... keep this in mind , and how lib/internal/operation is changed .... TODO (matt): given a host_id() and a computer_id() it should be possible in context of path and stuff to optimise... possible? 

## logging : chalkpack or console

- they do the same thign except chalkpack allows some extra presentation and features, and i want to use it in the premise, the output of the cli is the log,.. yo udont need to log that much when your system should be logging anyway... as ai - agents, third party whatever..... so long as that is dated and rotated.... the same calls are automatically streamed to file, not, or written some other way in phase v2 for now its just this way... with those operations.. 

## logging: manifest as imut

- it tried to do something... its always the same formatting and direct calls....

- includes the core operations

- imut log is just for core operations, exernal calls, and low level things.. for example, a timed operation is not suitable for imut log. its meant to be a manifest historic data harvestable for debugging / investigation / historical purposes, not for a log of operations over time.  a test run could take 1-2 hours, and we don't want to keep a running log of all that.
- and that always happens, no matter what the user does... 

## logging: user

- built as streamed files - but using the built in fs stuff - chalkpack and when +trace +debug +verbose ... includes a lot of data... ( its best to compress this dir or use a mountable file system that is one file )
- the main databases and files is not for this purpose... but is an option... creating another process to handle this? TODO (matt): sqlite runtime, and more logging questions...  
- we might also have a mode that sends debug reports when `+send_debug` is active... dispatching structured diagnostic snapshots, memory canary dumps, or invariant failure manifests directly to a remote endpoint or collection target when something unexpected happens...

## testing: invariant and behavioral

- invariant assertions (`libcd_invariant.mjs`, `run_self_check`) are wired around operations (`pre_op_check` / post) and inside critical memory boundaries... they guard our strict expectations when dev/alpha flags are active...
- i don't expect any runtime errors whatsoever... if an invariant throws or memory alignment fails, that is a catastrophic bug that should never reach production...
- tests are strictly behavioral... they verify what the library actually does with state, buffer layouts, and operations over time, not rigid mocks or checking if expected errors are thrown... if the code throws, it is borked...
- self-check orchestrators run continuously around execution cycles, ensuring that buffers, stride canaries (`0xAA`), database connections, and volume storage paths remain 100% sound and uncorrupted...

## os journal & concurrency

- since the os journal (USN / fanotify) will be the preferred way to make this work, it will still have to be threaded, and not locking like other tools.. since its a library...
- worker threads consume and stream journal structs over shared memory without locking directories, freezing file descriptors, or blocking the consumer application...

## bitwise & memory quirks

- you gotta read `doc/mjs_bitwise_quirks.md` before modifying bitwise flags or raw memory buffers... js coerces operands to 32-bit signed integers during bitwise math, which can silently overflow or mangle float pointers...
- restrict bitwise math strictly to `Uint8Array` / `Int32Array` (`Atomics.or`, `Atomics.and`)... never apply bitwise operations to `Float64Array` (`mtime`, `size`) or 64-bit timestamps without BigInt arrays...

## naming don't have a bunch of random functions

- group functions by the topic ( ie usually the folder they live in ) - and the name of the file

- prefer `descenthash_compute_single()` instead of `compute_single_hash()` this makes searching for a group much easier

## import denotation (1p / 2p / 3p)

- imports across our modules must be categorized and clearly denoted using `// 1p`, `// 2p`, and `// 3p` comments above import groups:
- `// 1p` (first-party): built-in runtime modules (`node:fs`, `node:path`, `node:test`, `node:assert`, etc.).
- `// 2p` (second-party): imports from our own library codebase (`../self_check/libcd_self_check.mjs`, `../storage/libcd_volume.mjs`, etc.).
- `// 3p` (third-party): static external packages vendored and checked directly into our repository under `3p/` (e.g., `../3p/hugging-face-blake3-wasm/...`).

