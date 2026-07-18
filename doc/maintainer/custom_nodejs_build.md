# Custom Node.js Runtime & Network Lockdown Architecture

To run `lib-change-descent` resident processes with ring-0 assurance that no code can ever initiate network connections (`node:net`, `node:http`, `fetch`, `node:dns`), our architecture supports three levels of custom Node.js runtime configuration:

---

## Level 1: Pre-Boot Interceptors & Native Permission Flag (`1p` Zero-Compile)

Our primary mechanism is **`local/tool/libcd_net_lockdown.mjs`**, which runs before any application code executes (`--import`).

### What it does:
1. **Strips Global Network Intrinsics:** Deletes `globalThis.fetch`, `globalThis.WebSocket`, and `globalThis.EventSource`, overriding them with functions that throw immediate access errors.
2. **ESM & CJS Resolution Interceptors:** Registers `node:module` `register()` (`ESM`) and `Module._load` (`CJS`) hooks that intercept any attempt to load `node:net`, `node:http`, `node:https`, `node:dgram`, `node:dns`, or `node:tls`, throwing `[NET_LOCKDOWN] Access denied to network module`.
3. **Preserves High-Speed Primitives:** `node:fs`, `node:crypto`, `node:buffer` / `SharedArrayBuffer`, `node:path`, `node:os`, `node:url`, `node:events`, and `Wasm` remain 100% accessible and run with maximum unboxed speed.

### Generating the Boot Script (`gen_lockdown_nodejs.mjs`):
```powershell
node local/tool/gen_lockdown_nodejs.mjs --target windows --out local/sh/run_resident.cmd
```
*Generated script output:*
```bat
@echo off
set NODE_OPTIONS=--frozen-intrinsics --no-warnings --import ./local/tool/libcd_net_lockdown.mjs
node "src-mjs.main/libcd_main.mjs" %*
```

### Native Node.js Permission Flag (`Optional Boundary`):
You can further harden the command invocation by adding Node.js experimental permissions:
```powershell
node --permission --allow-fs-read=* --allow-fs-write=* --allow-worker --frozen-intrinsics --import ./local/tool/libcd_net_lockdown.mjs src-mjs.main/libcd_main.mjs
```
`--permission` disables all network and child process execution at the C++/V8 engine level (`ERR_ACCESS_DENIED`), while `--allow-worker` permits `SharedArrayBuffer` / `Wasm` for high-speed tracking.

---

## Level 2: Single Executable Application (`SEA`) Binary Bundle

To package the locked-down environment into a single standalone binary (`libcd_resident.exe` / `libcd_resident`):
1. **Create `sea-config.json`:**
   ```json
   {
       "main": "src-mjs.main/libcd_main.mjs",
       "output": "var/build/sea-prep.blob",
       "disableExperimentalSEAWarning": true,
       "useSnapshot": false
   }
   ```
2. **Generate the Blob:**
   ```powershell
   node --experimental-sea-config sea-config.json
   ```
3. **Inject Blob & Postject into Binary (`var/build/libcd_resident.exe`):**
   Copy `node.exe` to `var/build/libcd_resident.exe`, then run `npx postject` to embed `sea-prep.blob` directly inside the binary alongside our `--frozen-intrinsics` / `libcd_net_lockdown` boot parameters.

---

## Level 3: Custom C++ Source Compilation (`--without-ssl --without-net`)

For environments requiring physical removal of network socket handles at compile time from C++ source code (`Node.js v22+`):
1. **Configure Build:**
   When compiling Node.js from source (`./configure`), pass:
   ```sh
   ./configure --without-npm --without-ssl --without-intl --without-node-snapshot
   ```
2. **Strip C++ Built-in Handles (`src/node_builtins.cc`):**
   In `src/node_builtins.cc` and `src/node_options.cc`, comment out or `#undef` the bindings for `net`, `http`, `https`, `tls`, `dgram`, and `dns`.
3. **Compile (`make -j$(nproc)` / `vcbuild.bat`):**
   The resulting binary physically lacks TCP/UDP sockets or HTTP protocol parsers, creating a pure filesystem, crypto, and Wasm engine tailored for `lib-change-descent`.
