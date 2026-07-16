# AI Jump Table (`lib-change-descent`)

Before writing code or proposing changes in this repository, AI agents must read:

<<<<<<< HEAD
1. **Core AI Memory & Rules:** [doc/.ai/libcd_doc_ai_gemini.md](file:///i:/lib/usr/lib-change-descent/doc/.ai/libcd_doc_ai_gemini.md)
2. **Design & Architecture:** [doc/.ai/DESIGN_MOMENTUM.md](file:///i:/lib/usr/lib-change-descent/doc/.ai/DESIGN_MOMENTUM.md)
3. **Coding Style Rules:** [doc/CODE_STYLE.md](file:///i:/lib/usr/lib-change-descent/doc/CODE_STYLE.md)
4. **Library Structure & Logging:** [doc/LIB_STRUCTURE.md](file:///i:/lib/usr/lib-change-descent/doc/LIB_STRUCTURE.md)
5. **Testing Philosophy:** [doc/TESTING.md](file:///i:/lib/usr/lib-change-descent/doc/TESTING.md)
=======
1. [doc/.ai/DESIGN_MOMENTUM.md](file:///i:/lib/usr/lib-change-descent/doc/.ai/DESIGN_MOMENTUM.md) — Architectural patterns, V8/SpiderMonkey Isolate boundary rules, the Dual Surface API (`thisArg`/context primitives + class wrappers), and project momentum.
2. [doc/CODE_STYLE.md](file:///i:/lib/usr/lib-change-descent/doc/CODE_STYLE.md) — Strict coding style rules (`var x= true`, 4-space indentation, no semicolons, snake_case methods, `1p/2p/3p` dependency rules).
3. [doc/LIB_STRUCTURE.md](file:///i:/lib/usr/lib-change-descent/doc/LIB_STRUCTURE.md) — Logging and immutable manifest concepts (`imut_log`).

## Key Rules Summary for AI
- **Indentation:** Exactly 4 spaces.
- **Semicolons:** None (`no-semicolon` style).
- **Variable Declarations:** Prefer `var= `. Since we aren't using TS we can optimise using var, however, where applicable in execution semantics its legible to use const and let... 
- **Method & Function Names:** Use C/Python `snake_case` (`dispatch_start_scan()`, `start_scan()`).
- **File Naming:** `snake_case.mjs` for utilities/ops (`libcd_worker_op.mjs`); `PascalCase.mjs` prefixed with `libcd_` for class definitions (`libcd_DiskWorkerClient.mjs`).
- **Worker IPC:** Always keep Main-Isolate clients and Worker-Isolate runtimes in separate files to prevent cross-isolate top-level import pollution.
>>>>>>> c5d0d5f385316476b1d29ad1b4b74d62a0597bc6
