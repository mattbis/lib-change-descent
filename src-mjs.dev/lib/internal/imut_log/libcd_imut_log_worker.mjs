/**
 * imut_log worker.
 * Runs in a dedicated worker thread. It is the single writer to the log.
 * Nothing outside this file may write to the log directly.
 *
 * Receives: postMessage({ kind, op, ts, data })
 * Flushes:  on FLUSH_THRESHOLD entries staged, or on 'DRAIN' signal from lifecycle
 *
 * TODO(matt): replace console stubs with real logger when available
 * TODO(matt): replace the flush stub with actual disk write (libcd_storage_io)
 */

import { parentPort } from 'node:worker_threads'

/** how many entries to hold before flushing */
const FLUSH_THRESHOLD= 64

/** in-memory ring — plain array, entries are cheap plain objects */
const queue= []

/**
 * Stage one entry into the queue.
 * If the threshold is hit, flush immediately.
 * @param {{ kind: string, op: string, ts: number, data: unknown }} entry
 */
function stage(entry) {
    queue.push(entry)
    console.log(`[IMUT_LOG][STAGE] ${entry.kind}:${entry.op} ts=${entry.ts}`)

    if (queue.length >= FLUSH_THRESHOLD) flush()
}

/**
 * Drain the queue to persistent storage.
 * Stub: logs to console until libcd_storage_io is wired.
 * Notifies parentPort after flush so manifest can update.
 */
function flush() {
    if (queue.length === 0) return

    const batch= queue.splice(0, queue.length)

    // TODO(matt): write batch to disk via libcd_storage_io
    console.log(`[IMUT_LOG][FLUSH] ${batch.length} entries`)

    // notify parent (manifest hook) that a flush occurred
    parentPort?.postMessage({ type: 'FLUSHED', count: batch.length, ts: Date.now() })
}

// ---- message handler ----
parentPort?.on('message', (msg) => {
    if (msg?.type === 'DRAIN') {
        // lifecycle ABORT / session end — flush everything now
        flush()
        return
    }

    // normal op entry
    stage(msg)
})
