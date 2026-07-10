/**
 * lib/worker/libcd_worker_receive.mjs
 *
 * Receive layer — worker thread side.
 * Handles incoming messages dispatched from the main thread
 * via libcd_worker_protocol.mjs.
 *
 * Import and call handle_message() from your worker's onmessage.
 *
 * TODO(matt): wire handle_start_scan to the actual fs walk / node writer
 * TODO(matt): wire handle_pause / handle_resume to Atomics control_buffer flags
 * TODO(matt): wire handle_terminate to imut_log drain before self.close()
 */

import { PROTOCOL_OP } from './libcd_worker_protocol.mjs'

/**
 * Route an incoming worker message to the correct handler.
 * Call this from your worker's parentPort.on('message', handle_message).
 *
 * @param {{ op: number, payload?: Object }} message
 */
export function handle_message(message) {
    switch (message.op) {
        case PROTOCOL_OP.START_SCAN:  return handle_start_scan(message.payload)
        case PROTOCOL_OP.PAUSE:       return handle_pause()
        case PROTOCOL_OP.RESUME:      return handle_resume()
        case PROTOCOL_OP.TERMINATE:   return handle_terminate()
        default:
            console.warn(`[WORKER_RECEIVE] unknown op: ${message.op}`)
    }
}

/**
 * Begin walking the filesystem from root_path.
 * Writes nodes into the shared node_buffer via the struct offset manager.
 *
 * @param {{ root_path: string, uuid: string, is_ssd: boolean, node_buffer: SharedArrayBuffer, string_heap: SharedArrayBuffer, control_buffer: SharedArrayBuffer }} payload
 */
function handle_start_scan(payload) {
    // TODO(matt): initialise node accessor from payload.node_buffer
    // TODO(matt): walk payload.root_path, write each node via create_node_accessor
    // TODO(matt): check control_buffer Atomics flag each iteration for pause/abort
    console.log(`[WORKER_RECEIVE] START_SCAN root=${payload.root_path} uuid=${payload.uuid}`)
}

/**
 * Pause the scan loop.
 * Worker polls the control_buffer Atomics flag each iteration.
 */
function handle_pause() {
    // TODO(matt): Atomics.store(control_view, CTRL_PAUSE_FLAG, 1)
    console.log('[WORKER_RECEIVE] PAUSE')
}

/**
 * Resume from pause.
 */
function handle_resume() {
    // TODO(matt): Atomics.store(control_view, CTRL_PAUSE_FLAG, 0)
    console.log('[WORKER_RECEIVE] RESUME')
}

/**
 * Terminate the worker cleanly.
 * Drain imut_log before closing.
 */
function handle_terminate() {
    // TODO(matt): post DRAIN to imut_log worker
    // TODO(matt): self.close() or parentPort.close()
    console.log('[WORKER_RECEIVE] TERMINATE')
}
