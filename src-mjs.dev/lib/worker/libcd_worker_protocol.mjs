/**
 * lib/worker/libcd_worker_protocol.mjs
 *
 * Dispatch layer — main thread side only.
 * Sends structured commands to disk worker threads via postMessage.
 *
 * Workers own their own onmessage handler — nothing here handles responses.
 * Responses from workers are handled in libcd_worker_receive.mjs.
 *
 * The PROTOCOL_OP enum is intentionally extensible — this protocol is designed
 * to eventually invoke any library function or meta operation so an application
 * can tightly couple (RPC / IPC style).
 *
 * TODO(matt): expand PROTOCOL_OP as new worker capabilities are added
 */

/** @enum {number} */
export const PROTOCOL_OP= {
    // ---- Scan lifecycle ----
    START_SCAN:  0,
    PAUSE:       1,
    RESUME:      2,
    TERMINATE:   3,

    // ---- Future: meta / library ops ----
    // ADD new ops here as the worker surface expands.
    // Never reuse or reassign existing op numbers — log compatibility depends on stable values.
}

/**
 * Shared buffer bundle passed to each worker on dispatch.
 * All three must be backed by SharedArrayBuffer for Atomics to work.
 *
 * @typedef {Object} WorkerBuffers
 * @property {SharedArrayBuffer} node_buffer    - flat node page pool
 * @property {SharedArrayBuffer} string_heap    - interned string storage
 * @property {SharedArrayBuffer} control_buffer - Atomics control signals (pause, abort flags)
 */

/**
 * Dispatch a START_SCAN command to a worker.
 *
 * @param {Worker}        worker
 * @param {Object}        disk_info
 * @param {string}        disk_info.path    - root path to scan
 * @param {string}        disk_info.uuid    - volume fingerprint
 * @param {boolean}       disk_info.is_ssd  - affects read strategy
 * @param {WorkerBuffers} buffers           - shared memory passed to the worker
 */
export function dispatch_start_scan(worker, disk_info, buffers) {
    worker.postMessage({
        op:      PROTOCOL_OP.START_SCAN,
        payload: {
            root_path:      disk_info.path,
            uuid:           disk_info.uuid,
            is_ssd:         disk_info.is_ssd,
            node_buffer:    buffers.node_buffer,
            string_heap:    buffers.string_heap,
            control_buffer: buffers.control_buffer
        }
    })
}

/**
 * Signal a worker to pause.
 * Worker should check the control_buffer Atomics flag and idle.
 * @param {Worker} worker
 */
export function dispatch_pause(worker) {
    worker.postMessage({ op: PROTOCOL_OP.PAUSE })
}

/**
 * Signal a worker to resume from pause.
 * @param {Worker} worker
 */
export function dispatch_resume(worker) {
    worker.postMessage({ op: PROTOCOL_OP.RESUME })
}

/**
 * Signal a worker to terminate cleanly.
 * Worker should flush any staged state before exiting.
 * @param {Worker} worker
 */
export function dispatch_terminate(worker) {
    worker.postMessage({ op: PROTOCOL_OP.TERMINATE })
}
