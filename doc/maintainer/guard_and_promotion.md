# Maintainer Guide: Local Tooling & Code Promotion Guard (`libcd_guard.mjs`)

This guide documents the local maintainer tooling (`local/sh/`, `local/tool/`) and explains the zero-dependency (`1p/2p`) security architecture used to safeguard code promotions (`src-mjs.dev` $\rightarrow$ `src-mjs.main`) against unauthorized automated robots, compromised background processes, or runaway AI agents.

---

## 1. Why Local Promotion Protection?

`lib-change-descent` runs as a resident monitoring engine (`+resident`) capable of scanning up to 21 storage volumes continuously. When developing on a machine that executes background scripts, automated bots, or AI coding assistants, there is a legitimate threat of automated scripts accidentally or maliciously overwriting production main (`src-mjs.main/` or `src-zig.main/`) or triggering unauthorized git pushes.

To make updating `main` difficult and immune to automated robot exploration, all code promotion operations are gated behind **`local/tool/libcd_guard.mjs`**.

---

## 2. The 3-Layer Guard Architecture

`libcd_guard.mjs` implements a zero-dependency (`node:crypto` + `node:fs`) challenge-response system:

```text
+-----------------------------------------------------------------------+
| LAYER 1: Offline Master Secret (`local/.secret`)                      |
| - 256-bit high-entropy hex key created on first setup                 |
| - Strictly gitignored (`.gitignore`) and restricted to `0600` access |
+-----------------------------------------------------------------------+
                                   |
                                   v
+-----------------------------------------------------------------------+
| LAYER 2: Dual Challenge Generation (TOTP + Machine-Bound Hardware)    |
| - Time-Windowed TOTP PIN (`RFC 6238`): 6 digits changing every 30s    |
|   (Verify out-of-band on offline phone / YubiKey / authenticator)     |
| - Hardware-Bound PIN: HMAC-SHA256(`secret + hostname + username`)     |
+-----------------------------------------------------------------------+
                                   |
                                   v
+-----------------------------------------------------------------------+
| LAYER 3: Anti-Robot Rate Limiting & Constant-Time Verification        |
| - `crypto.timingSafeEqual` prevents side-channel timing attacks       |
| - `var/promote.lock` enforces a 60-second cooldown on failed checks   |
+-----------------------------------------------------------------------+
```

---

## 3. Step-by-Step Maintainer Workflow

### A. Initializing the Master Secret
Before running promotion scripts for the first time, generate your local secret:

```powershell
node local/tool/libcd_guard.mjs --generate-secret
```

*Output Example:*
```text
[GUARD] Secret initialized (`local/.secret`): fa7458df...
[GUARD] Current TOTP PIN: 208114
[GUARD] Current Hardware PIN: 125978
```

> [!IMPORTANT]
> **Out-of-Band Setup:** You can import the hex key stored in `local/.secret` into an offline authenticator app (such as Google Authenticator, Bitwarden, or YubiKey). This allows you to read challenge PINs from your phone, keeping authorization independent from the local machine.

### B. Authorizing Code Promotion (`dev` $\rightarrow$ `main`)
When you are ready to promote validated code from `src-mjs.dev/` into `src-mjs.main/`, execute your promotion script while passing the valid 6-digit PIN:

```powershell
node local/tool/libcd_guard.mjs --pin 208114
```

*If verification succeeds:*
```text
[GUARD] Authorization Verified. Code promotion authorized.
```

### C. Lockout Cooldown (`var/promote.lock`)
If an incorrect PIN or expired challenge window is entered:
1. The verification aborts immediately (`[GUARD] Authorization failure: invalid PIN`).
2. A timestamp lock is written to `var/promote.lock`.
3. Any subsequent attempts (even with the correct PIN) during the **60-second lockout window** will fail with:
   `[GUARD] Rate limit active: promotion cooldown in effect (60s lockout)`

This ensures automated scripts attempting brute-force exploration cannot spam challenge inputs.

---

## 4. Local Utility Scripts (`local/sh/`)

All maintainer shell scripts and batch utilities reside inside **`local/sh/`**:
- `local/sh/dir_to_vfs.cmd` — Windows command script for converting directory trees to virtual filesystem mounts.
- `local/sh/dir_to_vfs.sh` — POSIX shell equivalent.

These local utility scripts are designed to invoke `libcd_guard.mjs --pin <PIN>` before performing irreversible operations across volumes or main release structures.

---

## 5. Node.js Boot-Time Lockdown (`gen_lockdown_nodejs.mjs`)

While the library preserves **`var`** statements across local execution functions for maximum mechanical sympathy (`DESIGN_MOMENTUM.md`), protecting long-running resident processes from **prototype pollution (`__proto__` injection)** across 21 storage volumes requires locking down built-in JavaScript objects (`Object.prototype`, `Array.prototype`, `Function.prototype`).

Rather than wrapping every individual function scope with `Object.freeze()`, we provide a local tooling generator that configures Node.js engine-level boot-time locking (`--frozen-intrinsics`):

```powershell
node local/tool/gen_lockdown_nodejs.mjs --target windows --out local/sh/run_resident.cmd
```

This generates a native boot wrapper:
```bat
@echo off
set NODE_OPTIONS=--frozen-intrinsics --no-warnings
node "src-mjs.main/libcd_main.mjs" %*
```

When started via `--frozen-intrinsics`, V8 recursively freezes all built-in intrinsics right at boot time (`1p` zero-dependency engine guarantee), ensuring any attempt by malformed USN records or IPC payloads to pollute global prototypes throws a `TypeError` immediately while keeping hot loops optimized with `var`.
