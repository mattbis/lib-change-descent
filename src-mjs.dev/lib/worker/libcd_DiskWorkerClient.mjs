/**
 * lib/worker/libcd_DiskWorkerClient.mjs
 *
 * Main thread side only.
 * Provides both functional primitives (`thisArg`/context or explicit worker target)
 * and an ergonomic `DiskWorkerClient` class wrapper for dispatching commands to workers.
 */

import { PROTOCOL_OP } from "./libcd_worker_op.mjs"

/**
 * Functional primitive: Dispatch a START_SCAN command.
 * Can be called standalone passing `worker`, or via `.call(thisArg, ...)` where `thisArg` is `{ worker }`.
 *
 * @param {Worker|{worker: Worker}} target
 * @param {Object} disk_info
 * @param {WorkerBuffers} buffers
 */
export function dispatch_start_scan(target, disk_info, buffers) {
  const worker = target?.postMessage ? target : target?.worker
  worker.postMessage({
    op: PROTOCOL_OP.START_SCAN,
    payload: {
      root_path: disk_info.path,
      uuid: disk_info.uuid,
      is_ssd: disk_info.is_ssd,
      node_buffer: buffers.node_buffer,
      string_heap: buffers.string_heap,
      control_buffer: buffers.control_buffer,
    },
  })
}

/**
 * Functional primitive: Signal pause.
 * @param {Worker|{worker: Worker}} target
 */
export function dispatch_pause(target) {
  const worker = target?.postMessage ? target : target?.worker
  worker.postMessage({ op: PROTOCOL_OP.PAUSE })
}

/**
 * Functional primitive: Signal resume.
 * @param {Worker|{worker: Worker}} target
 */
export function dispatch_resume(target) {
  const worker = target?.postMessage ? target : target?.worker
  worker.postMessage({ op: PROTOCOL_OP.RESUME })
}

/**
 * Functional primitive: Signal clean termination.
 * @param {Worker|{worker: Worker}} target
 */
export function dispatch_terminate(target) {
  const worker = target?.postMessage ? target : target?.worker
  worker.postMessage({ op: PROTOCOL_OP.TERMINATE })
}

/**
 * Ergonomic class wrapper for Main-to-Worker IPC.
 * Encapsulates the Worker instance while delegating to functional primitives.
 */
export class DiskWorkerClient {
  /**
   * @param {Worker} worker
   */
  constructor(worker) {
    this.worker = worker
  }

  start_scan(disk_info, buffers) {
    return dispatch_start_scan(this, disk_info, buffers)
  }

  pause() {
    return dispatch_pause(this)
  }

  resume() {
    return dispatch_resume(this)
  }

  terminate() {
    return dispatch_terminate(this)
  }
}
