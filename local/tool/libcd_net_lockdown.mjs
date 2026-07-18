/**
 * Network primitives pre-boot lockdown (`libcd_net_lockdown.mjs`)
 * completely strips and disables all network access (`net`, `http`, `https`, `dgram`, `dns`, `tls`, `fetch`, `WebSocket`)
 * right when the resident process boots, while keeping `fs`, `crypto`, `buffer` / `SharedArrayBuffer`, and `wasm`
 * running with maximum unboxed speed.
 *
 * usage:
 *   node --import ./local/tool/libcd_net_lockdown.mjs src-mjs.main/libcd_main.mjs
 */

// 1p
import { createRequire, register } from 'node:module'

const BLOCKED_NET_MODULES= new Set([
    'net', 'node:net',
    'http', 'node:http',
    'https', 'node:https',
    'http2', 'node:http2',
    'dgram', 'node:dgram',
    'dns', 'node:dns',
    'dns/promises', 'node:dns/promises',
    'tls', 'node:tls'
])

// Register ESM resolution hook
if (import.meta.url) {
    try {
        register(import.meta.url, import.meta.url)
    } catch (e) {
        // already registered or non-main context
    }
}

export async function resolve(specifier, context, nextResolve) {
    if (BLOCKED_NET_MODULES.has(specifier)) {
        throw new Error('[NET_LOCKDOWN] Access denied to network module: `' + specifier + '`. Resident process is locked to fs/crypto/wasm only.')
    }
    return nextResolve(specifier, context)
}

// 1. Delete global network browser-like intrinsics
if (typeof globalThis.fetch !== 'undefined') {
    delete globalThis.fetch
    globalThis.fetch= function fetch_blocked() {
        throw new Error('[NET_LOCKDOWN] globalThis.fetch is strictly blocked in this resident process.')
    }
}

if (typeof globalThis.WebSocket !== 'undefined') {
    delete globalThis.WebSocket
    globalThis.WebSocket= function WebSocket_blocked() {
        throw new Error('[NET_LOCKDOWN] globalThis.WebSocket is strictly blocked in this resident process.')
    }
}

if (typeof globalThis.EventSource !== 'undefined') {
    delete globalThis.EventSource
    globalThis.EventSource= function EventSource_blocked() {
        throw new Error('[NET_LOCKDOWN] globalThis.EventSource is strictly blocked in this resident process.')
    }
}

// 2. Intercept CJS and built-in module resolution for network modules
var req= createRequire(import.meta.url)
var Module= req('module')
if (Module && Module._load) {
    var original_load= Module._load
    Module._load= function lockdown_module_load(request, parent, isMain) {
        if (BLOCKED_NET_MODULES.has(request)) {
            throw new Error('[NET_LOCKDOWN] Access denied to network module: `' + request + '`. Resident process is locked to fs/crypto/wasm only.')
        }
        return original_load.apply(this, arguments)
    }
}

// 3. Optional Isolate global freezing checks
process.stdout.write('[NET_LOCKDOWN] Active. Network modules (`net`, `http`, `dns`, `fetch`) are locked and disabled.\n')
