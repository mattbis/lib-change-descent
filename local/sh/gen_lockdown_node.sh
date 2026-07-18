#!/usr/bin/env sh
# gen_lockdown_node.sh (`local/sh/`)
# Linux and Nix boot wrapper generator for --frozen-intrinsics resident isolation.
# Note: OSX/Darwin is currently unsupported per maintainer specification.

if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Usage: $0 [entry_mjs_file] [output_script_path]"
    echo "Example: $0 src-mjs.main/libcd_main.mjs local/sh/run_resident_locked.sh"
    exit 0
fi

ENTRY="${1:-src-mjs.main/libcd_main.mjs}"
OUT="${2:-local/sh/run_resident_locked.sh}"

DIR="$(cd "$(dirname "$0")" && pwd)"
node "$DIR/../tool/gen_lockdown_nodejs.mjs" --target linux --entry "$ENTRY" --out "$OUT"
