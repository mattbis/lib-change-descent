# Maintainer Documentation (`lib-change-descent`)

This directory contains guides and reference documentation for project maintainers, local tooling operations, and code promotion policies.

## Maintainer Guides

1. **[Local Tooling & Code Promotion Guard](file:///i:/lib/usr/lib-change-descent/doc/maintainer/guard_and_promotion.md)** (`guard_and_promotion.md`)
   - Details the `1p/2p` zero-dependency security architecture (`libcd_guard.mjs`) used to gate code promotions (`src-mjs.dev` $\rightarrow$ `src-mjs.main`).
   - Explains the 3-layer defense system: Offline Master Secret (`local/.secret`), Time-Windowed TOTP / Hardware PINs, and Anti-Robot Rate Limit Lockouts (`var/promote.lock`).
   - Documents local utility shell scripts (`local/sh/`).

2. **[Maintainer Roadmap](file:///i:/lib/usr/lib-change-descent/doc/maintainer_roadmap.md)** (`../maintainer_roadmap.md`)
   - High-level phases for the library's lifecycle: Node core version, schema-generated configuration, Zig high-performance engine (`src-zig.main`), and resident process hardening.
