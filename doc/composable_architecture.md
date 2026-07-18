# Composable Architecture & Dynamic Function Composition (`lib-change-descent`)

As `lib-change-descent` scales across operating systems, storage controllers, and resident subprocesses, we face a fundamental tension in modern JavaScript: **High-level abstraction vs. Mechanical sympathy**.

We want modular, composable building blocks (filters, descent hashing, behavioral vole masks, security checks, and operation pipelines). However, in V8 TurboFan, layering many high-level functions (`pipeline(step1(step2(step3(ctx))))`) introduces destructive performance bottlenecks:
* **Function Call Overhead:** Every nested function call pushes a new stack frame, allocates execution contexts, and interrupts instruction cache continuity.
* **`thisArg` Context & Scope Chain Costs:** Passing contexts through multi-layered wrappers or deeply inherited classes forces V8 to perform dynamic scope lookups and de-opt monomorphic hot paths.
* **Garbage Collection (GC) Pressure:** Transient closures and intermediate callback arrays generate short-lived objects that trigger micro-GC pauses during multi-million node scans (`NODE_STRIDE`).

To achieve both **developer-facing modularity** and **C-like execution speed**, `lib-change-descent` embraces **Dynamic Function Composition (`The String Trick with Context`)**.

---

## 1. Dynamic Function Composition: "The String Trick with Context"

Instead of executing arrays of callback functions inside hot loops at runtime, our architecture separates **Pipeline Definition** from **Hot-Loop Execution**.

At session startup, profile selection (`+resident`, `+bg`, `+fg`), or configuration parsing, the library dynamically generates specialized hot loops by assembling source code snippets into a **single, flat, monomorphic function block using `new Function(...)`**:

```javascript
/**
 * Conceptual Example: Dynamic Pipeline Compilation
 * Combines modular steps into a single C-like flattened function without intermediate stack frames.
 */
export function compile_descent_pipeline(steps, options = {}) {
    let code = `
        // Monomorphic flattened execution context
        const u8 = ctx.u8_view;
        const i32 = ctx.i32_view;
        const stride = ${options.stride || 32};
        const count = ctx.node_cursor;

        for (let i = 0; i < count; i++) {
            const base = i * stride;
    `;

    for (const step of steps) {
        if (step.type === 'filter_check') {
            code += `
            // Inlined fast filter bit/prefix check (no function call overhead)
            if ((u8[base] & ${step.mask}) === 0) continue;
            `;
        } else if (step.type === 'descent_hash') {
            code += `
            // Inlined float/counthash accumulation
            i32[(base + 12) >> 2] = (i32[(base + 12) >> 2] ^ ${step.seed}) + i;
            `;
        }
    }

    code += `
        }
        return true;
    `;

    // Compile once via V8 JIT into unboxed C-like machine code
    return new Function('ctx', code);
}
```

### Why "The String Trick" Wins in V8
1. **Zero Stack Frame Bloat:** By flattening 5–10 modular operations into a single continuous `for` loop body, we eliminate intermediate function invocations completely. V8 sees one single loop and inlines all memory accessors.
2. **Pre-Resolved Constants & Offsets:** Magic numbers, `NODE_STRIDE` offsets, filter bit masks (`LIBCD_VOLE_MASK`), and yield boundaries (`micro_pause`) are baked directly into the compiled code string as literal numeric constants (`32`, `0x10`), allowing TurboFan to generate optimal branch-free assembly.
3. **Monomorphic `ctx` Memory Access:** The compiled function takes a single `ctx` argument containing pre-bound `SharedArrayBuffer` views (`u8_view`, `i32_view`, `bi64_view`). With no hidden class mutations or polymorphic property lookups, memory reads and writes execute at raw CPU bus speed.

---

## 2. Alignment with Zero-Dependency & Security Assumptions

Because `lib-change-descent` adheres to a strict **`1p/2p` zero-dependency discipline** (`no third-party npm libraries, no external supply chain vulnerabilities`) and executes inside an **assumed secure, savvy runtime environment** (`with --frozen-intrinsics` and `+gate` process protection):
* Using `new Function(...)` inside our trusted internal resident engine is **completely safe**. There are no external dependency strings or unvalidated user inputs injected into the compiler.
* Security mitigations (`assert_disk_vol_id`, `run_pre_op_check`, bounds invariants) can be **conditionally compiled into the string template** during development (`-D __LIBCD_DEV__`) or across untrusted boundaries, but cleanly stripped out of the string template during high-throughput `+resident -nolimits` execution.

---

## 3. What This Refactor Means for the Codebase

As we continue refining `src-mjs.dev/`, our consolidation refactor maps directly onto this dynamic composition model:

### A. Core Primitives as Stringifiable Snippets & Accessors
Our foundational modules (`lib/node/libcd_node.mjs`, `lib/storage/libcd_volume.mjs`, `lib/os/libcd__os_filter.mjs`) will serve not just as direct runtime accessors, but as **source snippet providers** (`e.g., node_create_accessor_code()`). Each primitive exposes cleanly bounded C-like logic that can either be called directly in standalone scripts or injected into dynamic string pipelines.

### B. Operation Pipeline Compilation (`libcd_operation.mjs`)
Instead of `operation_run_pipeline(ctx, [pre_check, scan_dir, hash_nodes, post_check])` iterating through an array of function references at runtime:
* The pipeline builder will inspect the requested steps and yield profile (`+bg`, `+fg`).
* It will dynamically assemble and compile a single `compiled_op(ctx)` function.
* The hot execution path invokes only `compiled_op(ctx)`, delivering order-of-magnitude faster throughput across millions of filesystem nodes.

### C. Layered Security & Build Modifiers (`var/build`)
When generating standalone or public production bundles (`var/build`), a **Build Modifier** acts as the meta-compiler:
* **Obfuscation & Isolate Sealing:** It minifies, obfuscates, and seals compiled core loops (`esbuild --banner:js` with `Object.freeze` banners) so resident bundles running under `+gate` cannot be inspected or tampered with by unauthorized local processes.
* **Internal AST Pathway Hashing (`gate_verify_bundle_integrity`):** Each compiled pathway aspect (`or production bundle slice`) is fingerprinted (`gate_compute_pathway_hash`) and stored inside `var/gate.bundle.hash` (`or `--gen-bundle-hash`). When the local runner or resident bootstrapper (`npm run local` / `libcd_local.mjs`) starts up, it automatically verifies that the running bundle's internal AST pathway hash matches the expected production fingerprint (`--verify-bundle`), instantly rejecting execution if disk tampering or modification is detected.
* **Boundary Guarding:** It conditionally injects Windows Filtering Platform (`WFP`) network isolation checks (`lib/os/win/libcd_win.mjs`) or `+gate` cryptographic challenge requirements only where process boundary transitions occur.

---

## Summary

By leveraging **Dynamic Function Composition ("The String Trick with Context")**, `lib-change-descent` achieves the holy grail of system programming in JavaScript: **clean, modular, composable high-level code for the developer, compiled dynamically into zero-overhead, flattened, C-like machine code loops for V8 TurboFan.**
