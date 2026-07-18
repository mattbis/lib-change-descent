/**
 * Consolidated node structures and zero-GC SharedArrayBuffer struct accessors (`libcd_node.mjs`).
 * Bridges 32-byte memory layout definitions with atomic accessor functions and populate stubs.
 */

/** used via other consumption methods */
export class AbstractNode {}

/**
 * SCHEMA DEFINITION (32 Bytes per Node layout)
 * 0: Flags (Uint8) 
 * 1-3: Reserved/Padding
 * 4: ParentId (Int32)
 * 8: NamePointer (Int32)
 * 12: HashPointer (Int32)
 * 16: MTime (Float64)
 * 24: Size (Float64)
 */
export const NODE_STRIDE = 32 // Bytes per node
export const CONTROL_SLOT_SIZE = 64 // Bytes per worker slot in control_buffer to prevent false sharing

/**
 * @typedef {Object} NodeAccessor
 * @property {function(number): number} get_flags
 * @property {function(number): number} get_parent
 * @property {function(number): number} get_name_ptr
 * @property {function(number): number} get_hash_ptr
 * @property {function(number): number} get_m_time
 * @property {function(number): number} get_size
 * @property {function(number, number): void} set_flags
 * @property {function(number, number): void} set_parent
 * @property {function(number, number): void} set_name_ptr
 * @property {function(number, number): void} set_hash_ptr
 * @property {function(number, number): void} set_m_time
 * @property {function(number, number): void} set_size
 * @property {function(number, number): void} add_flag
 * @property {function(number, number): boolean} has_flag
 */

/**
 * space-prefixed function: node_create_accessor
 * creates zero-GC typed array accessors over node structs using Atomics across all fields (including Float64 via BigUint64Array bits).
 * NOTE: Node accessors specifically retain get_/set_ (unlike Go-style classes) because rigid struct boundaries require branch-free monomorphic JIT inlining.
 * @param {SharedArrayBuffer|ArrayBuffer} buffer
 */
export const node_create_accessor = (buffer) => {
  const u8_view = new Uint8Array(buffer)
  const i32_view = new Int32Array(buffer)
  const bi64_view = new BigUint64Array(buffer)

  const f64_scratch = new Float64Array(1)
  const bi64_scratch = new BigUint64Array(f64_scratch.buffer)

  return {
    get_flags: (id) => Atomics.load(u8_view, id * NODE_STRIDE),
    get_parent: (id) => Atomics.load(i32_view, (id * NODE_STRIDE + 4) / 4),
    get_name_ptr: (id) => Atomics.load(i32_view, (id * NODE_STRIDE + 8) / 4),
    get_hash_ptr: (id) => Atomics.load(i32_view, (id * NODE_STRIDE + 12) / 4),
    get_m_time: (id) => {
      bi64_scratch[0] = Atomics.load(bi64_view, (id * NODE_STRIDE + 16) / 8)
      return f64_scratch[0]
    },
    get_size: (id) => {
      bi64_scratch[0] = Atomics.load(bi64_view, (id * NODE_STRIDE + 24) / 8)
      return f64_scratch[0]
    },

    set_flags: (id, val) => {
      Atomics.store(u8_view, id * NODE_STRIDE, val)
    },
    set_parent: (id, val) => {
      Atomics.store(i32_view, (id * NODE_STRIDE + 4) / 4, val)
    },
    set_name_ptr: (id, val) => {
      Atomics.store(i32_view, (id * NODE_STRIDE + 8) / 4, val)
    },
    set_hash_ptr: (id, val) => {
      Atomics.store(i32_view, (id * NODE_STRIDE + 12) / 4, val)
    },
    set_m_time: (id, val) => {
      f64_scratch[0] = val
      Atomics.store(bi64_view, (id * NODE_STRIDE + 16) / 8, bi64_scratch[0])
    },
    set_size: (id, val) => {
      f64_scratch[0] = val
      Atomics.store(bi64_view, (id * NODE_STRIDE + 24) / 8, bi64_scratch[0])
    },

    add_flag: (id, flag) => {
      Atomics.or(u8_view, id * NODE_STRIDE, flag)
    },
    has_flag: (id, flag) =>
      (Atomics.load(u8_view, id * NODE_STRIDE) & flag) !== 0,
  }
}

/**
 * space-prefixed function: node_accessor
 */
export function node_accessor(nodeId, pages) {
    const pageIdx = nodeId >> 16
    const offset = nodeId & 0xFFFF
    return node_create_accessor(pages[pageIdx])
}

/** using blake3 for now */
export function node_id(bundle) {}

/** the session records counts and hashes */
export function populate_fst_counthash() {}

/** augment session or trigger with much slower seek */
export function populate_slw_size() {}
