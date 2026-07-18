# maintainer roadmap (`lib-change-descent`)

1. get a node js core workign version working, since then that allows a lot of easy work...
ive many scripts this will use.... its more so i have consistency across many volumes... since i use them for various tasks... and well its fun!

2. schema-generated configuration, volume registries (`LIBCD_VOLE_MASK`), and manifest exchange formats (`etc/`, `config/`).

3. since then i will have a much better understanding or tricks in mind, move onto the zig version
--- i really liked hearing the zig founders talk... and I Think its a skill worth investing in...

4. resident process hardening, security & isolate lockdown (`doc/security.md`):
--- deep freeze (`Object.freeze`) all static command/protocol maps across isolates.
--- enforce prototype-less (`Object.create(null)` / `Map`) dictionaries and safe option extractors (`arg_get_opt` / `Object.hasOwn`) across long-running resident processes.
--- verify full prototype pollution immunity and zero-GC invariant boundaries (`self_check`).

5. production releases (`src-mjs.main` / `src-zig.main`), esbuild runtime banner options, and continuous multi-drive verification.
