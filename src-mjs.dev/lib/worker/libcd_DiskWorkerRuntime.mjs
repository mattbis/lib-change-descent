/**
 * lib/worker/libcd_DiskWorkerRuntime.mjs
 *
 * Worker thread side only.
 * Provides both functional routing/handling primitives and an ergonomic
 * `DiskWorkerRuntime` class for encapsulating state across incoming IPC messages.
 */

import { PROTOCOL_OP } from "./libcd_worker_op.mjs"

/**
 * Functional primitive: Begin walking the filesystem from root_path.
 * Can accept an explicit runtime object (`thisArg` or `ctx`) holding state across iterations.
 *
 * @param {Object} payload
 * @param {Object} [ctx] Optional runtime context/state
 */
export function handle_start_scan(payload, ctx = null) {
  if (ctx) {
    ctx.root_path = payload.root_path
    ctx.uuid = payload.uuid
    ctx.is_ssd = payload.is_ssd
    ctx.buffers = {
      node_buffer: payload.node_buffer,
      string_heap: payload.string_heap,
      control_buffer: payload.control_buffer,
    }
    ctx.is_scanning = true
  }
  // TODO(matt): initialise node accessor from payload.node_buffer
  // TODO(matt): walk payload.root_path, write each node via create_node_accessor
  // TODO(matt): check control_buffer Atomics flag each iteration for pause/abort
  console.log(
    `[WORKER_RUNTIME] START_SCAN root=${payload.root_path} uuid=${payload.uuid}`,
  )
}

/**
 * Functional primitive: Pause the scan loop.
 * @param {Object} [ctx]
 */
export function handle_pause(ctx = null) {
  if (ctx) ctx.is_paused = true
  // TODO(matt): Atomics.store(control_view, CTRL_PAUSE_FLAG, 1)
  console.log("[WORKER_RUNTIME] PAUSE")
}

/**
 * Functional primitive: Resume from pause.
 * @param {Object} [ctx]
 */
export function handle_resume(ctx = null) {
  if (ctx) ctx.is_paused = false
  // TODO(matt): Atomics.store(control_view, CTRL_PAUSE_FLAG, 0)
  console.log("[WORKER_RUNTIME] RESUME")
}

/**
 * Functional primitive: Terminate the worker cleanly.
 * @param {Object} [ctx]
 */
export function handle_terminate(ctx = null) {
  if (ctx) ctx.is_scanning = false
  // TODO(matt): post DRAIN to imut_log worker
  // TODO(matt): self.close() or parentPort.close()
  console.log("[WORKER_RUNTIME] TERMINATE")
}

/**
 * Functional message router.
 * @param {{ op: number, payload?: Object }} message
 * @param {Object} [ctx]
 */
export function handle_message(message, ctx = null) {
  switch (message.op) {
    case PROTOCOL_OP.START_SCAN:
      return handle_start_scan(message.payload, ctx)
    case PROTOCOL_OP.PAUSE:
      return handle_pause(ctx)
    case PROTOCOL_OP.RESUME:
      return handle_resume(ctx)
    case PROTOCOL_OP.TERMINATE:
      return handle_terminate(ctx)
    default:
      console.warn(`[WORKER_RUNTIME] unknown op: ${message.op}`)
  }
}

/**
 * Ergonomic class wrapper for stateful worker thread execution.
 * Maintains scan state and buffer references across incoming messages.
 */
export class DiskWorkerRuntime {
  /**
   * @param {import('node:worker_threads').MessagePort} [parent_port]
   */
  constructor(parent_port = null) {
    this.parent_port = parent_port
    this.buffers = null
    this.root_path = null
    this.uuid = null
    this.is_ssd = false
    this.is_scanning = false
    this.is_paused = false
  }

  /**
   * Bind this instance as the message receiver on parent_port.
   */
  bind() {
    if (this.parent_port) {
      this.parent_port.on("message", (message) => this.handle_message(message))
    }
    return this
  }

  handle_message(message) {
    return handle_message(message, this)
  }

  start_scan(payload) {
    return handle_start_scan(payload, this)
  }

  pause() {
    return handle_pause(this)
  }

  resume() {
    return handle_resume(this)
  }

  terminate() {
    return handle_terminate(this)
  }
}
