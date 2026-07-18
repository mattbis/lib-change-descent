# lib-change-descent : Security & Resident Process Protection Manifest

## 1. Threat Model: Resident Process Prototype Pollution
Because `lib-change-descent` operates as a long-running (**resident**) engine monitoring complex filesystem activity across up to 21 active storage volumes, **prototype pollution (`__proto__`, `Object.prototype` injection)** is a critical threat vector to monitor.

In a transient command-line utility, a polluted prototype exits cleanly when the process terminates. In a long-running resident process, however, a poisoned `Object.prototype` stays permanently in memory across the lifetime of the Main Thread and Worker Isolates, potentially hijacking subsequent scan cycles, driver configurations, or volume discovery loops.

### ES Classes vs. Prototype Sugar
ES `class` definitions do not naturally protect against prototype bleeding. Under the hood, JavaScript classes and instances inherit via the prototype chain. If an attacker pollutes `Object.prototype` (for example, setting `Object.prototype.must_io_exclusive = true` or `Object.prototype.max_retries = 999`), those properties bleed into class instances and options structures unless explicitly guarded.

---

## 2. The Data-Oriented Advantage: TypedArrays are Immune
The classic prototype pollution exploit targets dynamic object property indexing (`obj[key] = value`). Because `lib-change-descent` strictly enforces **Data-Oriented Design** (`SharedArrayBuffer`, `Uint8Array`, `Int32Array`, and struct offset accessors inside `NODE_STRIDE`), the core engine loops are naturally immune:
* Numeric index writes on typed arrays (`u8_view[offset + 4] = 0x12`) never traverse or consult `Object.prototype`.
* Zero-GC binary comparators (`arg_slice_compare_fast`, `arg_slice_compare_secure_raw`) operate strictly on numeric bounds without allocating intermediate heap objects or inspecting property descriptors.

---

## 3. Pure MJS Mitigations Implemented Across `src-mjs.dev/`

To secure the boundaries where our high-performance engine interacts with standard JavaScript objects (CLI arguments, driver configurations, and internal registries), we enforce three strict, zero-dependency (`// 1p`, `// 2p`) runtime mitigations:

### A. Null-Prototype & `Map` Dictionaries (`Object.create(null)`)
Whenever the engine builds lookup tables for command-line arguments, string paths, or volume IDs, it avoids plain objects (`{}`):
* **`Map` Primitives:** Internal registries (`_known_volume_ids`, `_active_volumes` in `storage/libcd_volume.mjs`) use `new Map()`. `Map` lookups (`.get()`, `.set()`) use internal slots that completely bypass `Object.prototype`.
* **Null-Prototype Dictionaries:** For flat options and flag tables (`arg_parse_cli` in `lib/arg/libcd_arg.mjs`), dictionaries are initialized using `Object.create(null)` (or `var options = Object.create(null)`). With zero prototype chain, even if `Object.prototype` is poisoned, index lookups (`if (options[flag])`) remain 100% uncompromised.

### B. Safe Option Extraction (`arg_get_opt` & `Object.hasOwn`)
When parsing configuration objects passed from external tool drivers or class constructors (`options || {}`), standard destructuring or logical OR (`options.max_retries || 3`) can accidentally pull properties off a polluted `Object.prototype`.
We use our canonical option extractor [`arg_get_opt(opts, key, default_val)`](file:///i:/lib/usr/lib-change-descent/src-mjs.dev/lib/arg/libcd_arg.mjs#L59-L65), backed by `Object.hasOwn`:
```javascript
export function arg_get_opt(opts, key, default_val= null) {
    if (!opts || (typeof opts !== "object" && typeof opts !== "function")) return default_val
    return Object.hasOwn(opts, key) ? (opts[key] !== undefined ? opts[key] : default_val) : default_val
}
```
* **Constructors Guarded:** `class libcd_Volume` uses `arg_get_opt` to safely resolve `type`, `species`, and `hardware_id` without prototype bleeding.
* **Pipelines Guarded:** `operation_run_pipeline` in `libcd_operation.mjs` uses `arg_get_opt` to safely read `max_retries`, `skip_pre_check`, and `skip_post_check`.

### C. Deep Freezing Constant Tables (`Object.freeze`)
All static command maps, protocol operations, and vole masks are explicitly frozen upon export:
* **Worker IPC Protocol (`libcd_worker_op.mjs`):** `PROTOCOL_OP` (`START_SCAN`, `PAUSE`, `RESUME`, `TERMINATE`) is wrapped in `Object.freeze()`.
* **Vole Masks & Discover Strategies (`storage/libcd_volume.mjs`):** `LIBCD_VOLE_MASK` (and sub-maps `acl`, `read`, `speed`, `activity`, `history`), `LIBCD_VOL_SPECIES`, `LIBCD_VOL_TYPE`, and `LIBCD_VOL_DISCOVER_STRATEGY` are deeply frozen (`Object.freeze`).
* **Micro Pause & Precedence (`libcd_operation.mjs`, `libcd_configure.mjs`):** `libcd_micro_pause.factors` and `CONFIG_PRECEDENCE` are frozen to prevent runtime mutation.

---

## 4. Why Native Mitigations Win Over Post-Build Hardening (Babel/SWC)

We consciously choose to write code with these patterns in our source directory (`src-mjs.dev/`) rather than relying on complex post-compilation AST rewriting tools (`Babel`, `SWC`, `Terser` in `var/build`):
1. **Zero Build Complexity (`1p/2p` Discipline):** Our library ships raw MJS or bundled files (`no-semicolon`, zero unnecessary `3p` build dependencies). Requiring Babel to rewrite every `{}` into `Object.create(null)` slows down development and complicates our clean release channels.
2. **API Compatibility:** Automatic AST tools cannot distinguish when `{}` is intended for `JSON.stringify()` or a Node internal API (`node:fs`) versus an internal dictionary. Converting all `{}` to `Object.create(null)` automatically causes crashes when calling Node built-ins that expect `Object.prototype.toString`.
3. **Explicit Behavior & Self-Check Verification:** By explicitly using `arg_get_opt`, `new Map()`, and `Object.freeze()`, our self-check test harness (`src-mjs.dev/lib/test/libcd_self_check.0.mjs`) behaviorally asserts and verifies (`test("libcd_security")`) exact prototype pollution immunity directly on our source code (`node --test`).

### Optional Isolate Lockdown (`esbuild` Banner)
If generating a unified bundle for production deployment (`var/build/libcd_bundle.mjs`), `esbuild` can inject a lightweight **Runtime Isolate Freeze Banner** at the top of the bundle without any Babel AST overhead:
```javascript
// esbuild --banner:js configuration
"Object.freeze(Object.prototype); Object.freeze(Array.prototype);"
```
Freezing `Object.prototype` globally across the Isolate right at startup prevents any script within that compartment from mutating global prototypes, complementing our native source defenses cleanly.

---

## 5. Why `var` is Safe & Why We Keep Code Lockdown with Boot-Time `--frozen-intrinsics`

While some modern coding guidelines discourage **`var`** due to block-scoping concerns (`let`/`const`), `lib-change-descent` deliberately uses `var` across local functions and loops (`var i = 0`) for **mechanical sympathy**:
1. **Zero Temporal Dead Zone (`TDZ`):** Unlike `let`/`const`, `var` loop counters do not generate runtime TDZ initialization checks on every loop iteration inside V8 TurboFan, delivering unboxed C-like execution speed.
2. **ES Modules (`.mjs`) Scoping:** In Node.js ES Modules (`.mjs`), `var` statements are function- or module-scoped by definition. They **never leak** to `globalThis` (`window` or `global`), completely eliminating the historical scope pollution issues of browser script tags.

* By combining **boot-time `--frozen-intrinsics`** with our **in-code defensive practices (`Object.create(null)`, `Object.hasOwn`, and `arg_get_opt`)**, we guarantee that dictionary lookups execute with $O(1)$ direct key matching while the entire V8 runtime remains sealed at ring 0.

---

## 6. MJS $\leftrightarrow$ Zig Boundary Security & Seamless Fallback Architecture

To achieve maximum performance when querying ring-0 operating system journals (`FSCTL_QUERY_USN_JOURNAL` on Windows or `inotify`/`fanotify` on Linux), our architecture includes experimental native Zig modules (`src-zig.dev/journal_reader.zig`) alongside our pure MJS engine (`src-mjs.dev/`).

When data or control signals cross the **MJS $\leftrightarrow$ Zig boundary** (`stdio` IPC pipes, `SharedArrayBuffer`, or C-ABI `Node-API`), four strict security and stability boundaries are enforced:

### A. Fixed Binary Frames & Magic Byte Verification
To prevent out-of-bounds (`OOB`) buffer overruns or corrupted USN record crashes when reading from `SharedArrayBuffer` or IPC streams:
* Every binary packet crossing from Zig to MJS must begin with a packed header struct (`LibcdEventHeader`) containing exact length boundaries and our verification magic word (`magic_bytes = 0xCDCD`).
* Before parsing payload fields, the MJS receiver validates the header using our zero-GC fast comparator [`arg_parse_binary_header(u8_view, offset, MAGIC_BYTES)`](file:///i:/lib/usr/lib-change-descent/src-mjs.dev/lib/arg/libcd_arg.mjs#L51-L56). Malformed or unverified packets are rejected immediately without causing V8 memory corruption.

### B. Zero-Decode Hot Loop Protection (String Bomb Immunity)
Windows USN journal names (`WCHAR`) are arbitrary UTF-16LE strings. To prevent memory exhaustion or prototype poisoning via hidden control sequences:
* The MJS resident loop never decodes raw filenames inside hot detection bounds (`Never call TextDecoder or string comparators inside hot loop bounds`).
* Tracking, descent hashing, and entropy calculations (`descenthash_compute_single`) operate entirely on numeric IDs (`file_id`, `parent_id`, `mtime`). String decoding occurs strictly lazily when formatting visual graphs or user-facing logs (`render/libcd_change_graph.mjs`).

### C. IPC Handshake Authorization (`libcd_guard.mjs`)
Because low-level USN journal access (`CreateFileW` with `FILE_FLAG_BACKUP_SEMANTICS`) requires elevated system privileges:
* When MJS spawns the Zig helper process (`src-zig.dev/` or `src-zig.main/`), it initiates a session challenge verification using `arg_slice_compare_secure()` (`1p` `timingSafeEqual`).
* Unauthorized local scripts cannot tap into the Zig stream without possessing the active session token generated by the parent MJS process.

### D. Mandatory Pure MJS Fallback & Parity Guarantee
Our absolute architectural invariant is that **a native MJS version (`src-mjs.dev/` / `src-mjs.main/`) must always remain working and feature-complete standalone**:
* If `ctx.init()` discovers that the native Zig binary (`journal_reader`) is missing, fails signature verification, lacks OS elevation, or encounters a bus fault, the engine **gracefully downgrades to pure MJS polling (`+resident_mjs`) immediately**.
* No fatal exceptions are thrown across the boundary, guaranteeing uninterrupted resident monitoring across all supported volumes and operating systems.
