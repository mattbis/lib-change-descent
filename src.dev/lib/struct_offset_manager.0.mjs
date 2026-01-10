/** 
 * SCHEMA DEFINITION (32 Bytes per Node)
 * 
 * 0: Flags (Uint8) 
 * 1-3: Reserved/Padding
 * 4: ParentId (Int32)
 * 8: NamePointer (Int32)
 * 12: HashPointer (Int32)
 * 16: MTime (Float64)
 * 24: Size (Float64)
 */

export const NODE_STRIDE = 32; // Bytes per node

export const create_node_accessor = (buffer) => {
    const u8 = new Uint8Array(buffer)
    const i32 = new Int32Array(buffer)
    const f64 = new Float64Array(buffer)

    return {
        // Getters
        get_flags: (id) => u8[id * NODE_STRIDE],
        get_parent: (id) => i32[(id * NODE_STRIDE + 4) / 4],
        get_name_ptr: (id) => i32[(id * NODE_STRIDE + 8) / 4],
        get_m_time: (id) => f64[(id * NODE_STRIDE + 16) / 8],

        // Setters
        set_flags: (id, val) => { u8[id * NODE_STRIDE] = val; },
        set_parent: (id, val) => { i32[(id * NODE_STRIDE + 4) / 4] = val; },
        set_name_ptr: (id, val) => { i32[(id * NODE_STRIDE + 8) / 4] = val; },
        set_m_time: (id, val) => { f64[(id * NODE_STRIDE + 16) / 8] = val; },

        // Bitwise Helpers
        add_flag: (id, flag) => { u8[id * NODE_STRIDE] |= flag; },
        has_flag: (id, flag) => (u8[id * NODE_STRIDE] & flag) !== 0
    }
}
