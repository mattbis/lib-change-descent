/**
 * host/libcd_host.mjs
 *
 * Identifies the host machine, JS runtime, and system load.
 * Used by the manifest/imut_log to record the execution context
 * on every session start — so the log can show if the library
 * was invoked from a different runtime (e.g. Node one session, Bun the next).
 *
 * TODO(matt): host_os() should call per-os subroutine (nix/win/osx)
 */

import { post } from '../internal/imut_log/libcd_imut_log.mjs'
import { make_entry } from '../internal/imut_log/libcd_imut_log_entry.mjs'
// metric schema: src-mjs.dev/host/libcd_metric_schema.json (moved alongside this file)

// ---- Runtime Detection ----

/** @typedef {'BUN' | 'DENO' | 'NODE' | 'UNKNOWN'} HostRuntime */

/**
 * Detect the current JS runtime.
 * Checks stable, non-writable globals only.
 * @returns {HostRuntime}
 */
const detect_runtime= () => {
    if (typeof globalThis.Bun  !== 'undefined') return 'BUN'
    if (typeof globalThis.Deno !== 'undefined') return 'DENO'
    if (typeof process !== 'undefined' && process?.release?.name === 'node') return 'NODE'
    return 'UNKNOWN'
}

/**
 * Get the version string for the active runtime.
 * @param {HostRuntime} runtime
 * @returns {string}
 */
const detect_version= (runtime) => {
    if (runtime === 'BUN')  return globalThis.Bun.version
    if (runtime === 'DENO') return globalThis.Deno.version.deno
    if (runtime === 'NODE') return process.version
    return 'unknown'
}

// ---- Exports ----

/**
 * Identify the host OS platform.
 * TODO(matt): expand to call per-os subroutine for richer detail
 * @returns {string}
 */
export function host_os() {
    return process?.platform ?? 'unknown'
}

/**
 * Build the full host fingerprint and post it to the imut_log.
 * Call once on session start.
 * Returns the fingerprint so the manifest can store it.
 *
 * @returns {{ runtime: HostRuntime, version: string, platform: string, arch: string, pid: number }}
 */
export function host_fingerprint() {
    const runtime= detect_runtime()

    const fingerprint= {
        runtime,
        version:  detect_version(runtime),
        platform: process?.platform ?? 'unknown',
        arch:     process?.arch     ?? 'unknown',
        pid:      process?.pid      ?? -1
    }

    post(make_entry('SESSION', 'HOST_FINGERPRINT', fingerprint))

    return fingerprint
}

/**
 * Return a snapshot of system load metrics.
 * Supports one-shot or time-series collection against the metric schema.
 *
 * @param {{ time_series?: boolean, metric?: 'mem'|'load'|'disk_queue', duration?: number, interval?: number }} options
 * @returns {{ timestamp: number, metrics: { load?: number, memory_used_pct?: number, disk_queue?: number } }}
 */
export function host_metric(options= {}) {
    const { time_series= false, metric, duration, interval } = options

    // TODO(matt): wire to real os-level counters per platform
    // TODO(matt): time_series mode should stream snapshots over `duration` at `interval` ms
    const snapshot= {
        timestamp: Date.now(),
        metrics: {
            load:             undefined,
            memory_used_pct:  undefined,
            disk_queue:       undefined
        }
    }

    post(make_entry('SESSION', 'HOST_METRIC', { options, snapshot }))

    return snapshot
}
