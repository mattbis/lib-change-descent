/**
 * lib/host/libcd_host_fingerprint.mjs
 *
 * Identifies the JS runtime executing this library.
 * Used by the manifest/imut_log to record what host environment
 * was active at the time of each invocation.
 *
 * Detection is intentional and conservative — only checks globals
 * that are stable and non-writable in each runtime.
 *
 * Runtimes detected:
 *   BUN   — globalThis.Bun
 *   DENO  — globalThis.Deno
 *   NODE  — process.release.name === 'node'
 *   UNKNOWN — anything else (e.g. browser, embedded v8)
 */

/** @typedef {'BUN' | 'DENO' | 'NODE' | 'UNKNOWN'} HostRuntime */

/**
 * Detect the current JS runtime.
 * Pure function, no side effects.
 * @returns {HostRuntime}
 */
export const detect_runtime= () => {
    if (typeof globalThis.Bun !== 'undefined')  return 'BUN'
    if (typeof globalThis.Deno !== 'undefined') return 'DENO'
    if (typeof process !== 'undefined' && process?.release?.name === 'node') return 'NODE'
    return 'UNKNOWN'
}

/**
 * Get the version string for the current runtime.
 * @param {HostRuntime} runtime
 * @returns {string}
 */
export const detect_version= (runtime) => {
    if (runtime === 'BUN')  return globalThis.Bun.version
    if (runtime === 'DENO') return globalThis.Deno.version.deno
    if (runtime === 'NODE') return process.version
    return 'unknown'
}

/**
 * Build the full host fingerprint object.
 * This is what gets posted to the imut_log on session start.
 *
 * @returns {{ runtime: HostRuntime, version: string, platform: string, arch: string, pid: number }}
 */
export const get_host_fingerprint= () => {
    const runtime= detect_runtime()
    return {
        runtime,
        version:  detect_version(runtime),
        platform: process?.platform ?? 'unknown',
        arch:     process?.arch     ?? 'unknown',
        pid:      process?.pid      ?? -1
    }
}
