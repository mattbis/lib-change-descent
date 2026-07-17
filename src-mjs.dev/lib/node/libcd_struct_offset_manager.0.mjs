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
export const NODE_STRIDE = 32 // Bytes per node
export const CONTROL_SLOT_SIZE = 64 // Bytes per worker slot in control_buffer to prevent false sharing

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

  // Scratch buffer for 64-bit float <-> uint64 bit reinterpretation during Atomics operations
  const f64_scratch = new Float64Array(1)
  const bi64_scratch = new BigUint64Array(f64_scratch.buffer)

  return {
    // ---- Getters ----
    /** @type {NodeAccessor['get_flags']} */
    get_flags: (id) => Atomics.load(u8_view, id * NODE_STRIDE),

    /** @type {NodeAccessor['get_parent']} */
    get_parent: (id) => Atomics.load(i32_view, (id * NODE_STRIDE + 4) / 4),

    /** @type {NodeAccessor['get_name_ptr']} */
    get_name_ptr: (id) => Atomics.load(i32_view, (id * NODE_STRIDE + 8) / 4),

    /** @type {NodeAccessor['get_hash_ptr']} */
    get_hash_ptr: (id) => Atomics.load(i32_view, (id * NODE_STRIDE + 12) / 4),

    /** @type {NodeAccessor['get_m_time']} */
    get_m_time: (id) => {
      bi64_scratch[0] = Atomics.load(bi64_view, (id * NODE_STRIDE + 16) / 8)
      return f64_scratch[0]
    },

    /** @type {NodeAccessor['get_size']} */
    get_size: (id) => {
      bi64_scratch[0] = Atomics.load(bi64_view, (id * NODE_STRIDE + 24) / 8)
      return f64_scratch[0]
    },

    // ---- Setters ----
    /** @type {NodeAccessor['set_flags']} */
    set_flags: (id, val) => {
      Atomics.store(u8_view, id * NODE_STRIDE, val)
    },

    /** @type {NodeAccessor['set_parent']} */
    set_parent: (id, val) => {
      Atomics.store(i32_view, (id * NODE_STRIDE + 4) / 4, val)
    },

    /** @type {NodeAccessor['set_name_ptr']} */
    set_name_ptr: (id, val) => {
      Atomics.store(i32_view, (id * NODE_STRIDE + 8) / 4, val)
    },

    /** @type {NodeAccessor['set_hash_ptr']} */
    set_hash_ptr: (id, val) => {
      Atomics.store(i32_view, (id * NODE_STRIDE + 12) / 4, val)
    },

    /** @type {NodeAccessor['set_m_time']} */
    set_m_time: (id, val) => {
      f64_scratch[0] = val
      Atomics.store(bi64_view, (id * NODE_STRIDE + 16) / 8, bi64_scratch[0])
    },

    /** @type {NodeAccessor['set_size']} */
    set_size: (id, val) => {
      f64_scratch[0] = val
      Atomics.store(bi64_view, (id * NODE_STRIDE + 24) / 8, bi64_scratch[0])
    },

    // ---- Bitwise Helpers ----
    /** @type {NodeAccessor['add_flag']} */
    add_flag: (id, flag) => {
      Atomics.or(u8_view, id * NODE_STRIDE, flag)
    },

    /** @type {NodeAccessor['has_flag']} */
    has_flag: (id, flag) =>
      (Atomics.load(u8_view, id * NODE_STRIDE) & flag) !== 0,
  }
}

/** backward compatibility alias */
export const create_node_accessor = (buffer) => node_create_accessor(buffer)

/**
 * space-prefixed function: node_accessor
 */
export const node_accessor = (nodeId, pages) => {
    const pageIdx = nodeId >> 16
    const offset = nodeId & 0xFFFF
    return node_create_accessor(pages[pageIdx])//.at(offset)
}

/** backward compatibility aliases */
export const getAccessorForNode = (nodeId, pages) => node_accessor(nodeId, pages)
export const node_get_accessor = (nodeId, pages) => node_accessor(nodeId, pages)
