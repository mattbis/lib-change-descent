/**
 * lib/worker/libcd_worker_op.mjs
 *
 * Shared protocol definitions for disk worker IPC.
 * Safe for import in both Main Thread and Worker Isolates.
 */

/** @enum {number} */
export const PROTOCOL_OP = Object.freeze({
  // ---- Scan lifecycle ----
  START_SCAN: 0,
  PAUSE: 1,
  RESUME: 2,
  TERMINATE: 3,

  // ---- Future: meta / library ops ----
  // ADD new ops here as the worker surface expands.
  // Never reuse or reassign existing op numbers — log compatibility depends on stable values.
})

/**
 * Shared buffer bundle passed to each worker on dispatch.
 * All three must be backed by SharedArrayBuffer for Atomics to work.
 *
 * @typedef {Object} WorkerBuffers
 * @property {SharedArrayBuffer} node_buffer - flat node page pool
 * @property {SharedArrayBuffer} string_heap - interned string storage
 * @property {SharedArrayBuffer} control_buffer - Atomics control signals (pause, abort flags)
 */
