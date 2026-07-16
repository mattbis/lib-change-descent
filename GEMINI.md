# AI Agent Project Memory (`lib-change-descent`)

Before writing any code, modifying structure, or proposing architectural changes in this repository, **you must read and comply with the following core project documents**:

1. [doc/.ai/DESIGN_MOMENTUM.md](file:///i:/lib/usr/lib-change-descent/doc/.ai/DESIGN_MOMENTUM.md) — Architectural patterns, V8/SpiderMonkey Isolate boundary rules, the Dual Surface API (`thisArg`/context primitives + class wrappers), and project momentum.
2. [doc/CODE_STYLE.md](file:///i:/lib/usr/lib-change-descent/doc/CODE_STYLE.md) — Strict coding style rules (`var x = true`, 4-space indentation, no semicolons, snake_case methods, `1p/2p/3p` dependency rules).
3. [doc/LIB_STRUCTURE.md](file:///i:/lib/usr/lib-change-descent/doc/LIB_STRUCTURE.md) — Logging and immutable manifest concepts (`imut_log`).

## Key Rules Summary for AI
- **Indentation:** Exactly 4 spaces.
- **Semicolons:** None (`no-semicolon` style).
- **Variable Declarations:** Prefer `var`.
- **Method & Function Names:** Use C/Python `snake_case` (`dispatch_start_scan()`, `start_scan()`).
- **File Naming:** `snake_case.mjs` for utilities/ops (`libcd_worker_op.mjs`); `PascalCase.mjs` prefixed with `libcd_` for class definitions (`libcd_DiskWorkerClient.mjs`).
- **Worker IPC:** Always keep Main-Isolate clients and Worker-Isolate runtimes in separate files to prevent cross-isolate top-level import pollution.
