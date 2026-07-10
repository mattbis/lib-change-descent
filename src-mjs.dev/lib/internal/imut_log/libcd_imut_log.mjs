/**
 * imut_log client.
 * The only interface the rest of the codebase uses to post to the imut_log.
 * Spawns the worker once, exposes a single post() call.
 *
 * Usage:
 *   import { post } from '../internal/imut_log/libcd_imut_log.mjs'
 *   import { make_entry } from '../internal/imut_log/libcd_imut_log_entry.mjs'
 *   post(make_entry('OS_CALL', 'WMIC_CALL', { drive: 'C:' }))
 */

import { Worker } from 'node:worker_threads'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'

const __dir= dirname(fileURLToPath(import.meta.url))
const WORKER_PATH= join(__dir, 'libcd_imut_log_worker.mjs')

/** @type {Worker | null} */
let _worker= null

/**
 * Lazily start the worker on first post.
 * @returns {Worker}
 */
function get_worker() {
    if (_worker !== null) return _worker

    _worker= new Worker(WORKER_PATH)

    // manifest hook — receives FLUSHED notifications from the worker
    _worker.on('message', (msg) => {
        if (msg?.type === 'FLUSHED') {
            // TODO(matt): wire to libcd_manifest when ready
            console.log(`[IMUT_LOG][MANIFEST_HOOK] flushed ${msg.count} entries at ts=${msg.ts}`)
        }
    })

    _worker.on('error', (err) => {
        console.error('[IMUT_LOG][WORKER_ERROR]', err)
    })

    return _worker
}

/**
 * Post one entry to the imut_log worker.
 * Fire and forget — never blocks the caller.
 * @param {{ kind: string, op: string, ts: number, data: unknown }} entry
 */
export const post= (entry) => {
    get_worker().postMessage(entry)
}

/**
 * Signal the worker to drain and flush immediately.
 * Call from libcd_lifecycle abort() / stop().
 */
export const drain= () => {
    get_worker().postMessage({ type: 'DRAIN' })
}
