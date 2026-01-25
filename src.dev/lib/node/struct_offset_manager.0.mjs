/**
 * @typedef {Object} NodeAccessor
 * @property {function(number): number} get_flags
 * @property {function(number): number} get_parent
 * @property {function(number): number} get_name_ptr
 * @property {function(number): number} get_m_time
 * @property {function(number, number): void} set_flags
 * @property {function(number, number): void} set_parent
 * @property {function(number, number): void} set_name_ptr
 * @property {function(number, number): void} set_m_time
 * @property {function(number, number): void} add_flag
 * @property {function(number, number): boolean} has_flag
 */
export const NODE_STRIDE= 32; // Bytes per node

export const create_node_accessor= (buffer) => {
    
    const u8_view= new Uint8Array(buffer)
    const i32_view= new Int32Array(buffer)
    const f64_view= new Float64Array(buffer)

    return {
        // ---- Getters ---- 
        /** @type {NodeAccessor['get_flags']} */
        get_flags: (id) => u8_view[id * NODE_STRIDE],
        
        /** @type {NodeAccessor['get_parent']} */
        get_parent: (id) => i32_view[(id * NODE_STRIDE + 4) / 4],
        
        /** @type {NodeAccessor['get_name_ptr']} */
        get_name_ptr: (id) => i32_view[(id * NODE_STRIDE + 8) / 4],
        
        /** @type {NodeAccessor['get_m_time']} */
        get_m_time: (id) => f64_view[(id * NODE_STRIDE + 16) / 8],

        // ---- Setters ---- 
        /** @type {NodeAccessor['set_flags']} */
        set_flags: (id, val) => { u8_view[id * NODE_STRIDE] = val; },
        
        /** @type {NodeAccessor['set_parent']} */
        set_parent: (id, val) => { i32_view[(id * NODE_STRIDE + 4) / 4] = val; },
        
        /** @type {NodeAccessor['set_name_ptr']} */
        set_name_ptr: (id, val) => { i32_view[(id * NODE_STRIDE + 8) / 4] = val; },
        
        /** @type {NodeAccessor['set_m_time']} */
        set_m_time: (id, val) => { f64_view[(id * NODE_STRIDE + 16) / 8] = val; },
        
        /** @type {NodeAccessor['set_size']} */
        set_size: (id, val) => { f64_view[(id * NODE_STRIDE + 24) / 8] = val; },

        // ---- Bitwise Helpers ---- 
        /** @type {NodeAccessor['add_flag']} */
        add_flag: (id, flag) => { u8_view[id * NODE_STRIDE] |= flag; },
        
        /** @type {NodeAccessor['has_flag']} */
        has_flag: (id, flag) => (u8_view[id * NODE_STRIDE] & flag) !== 0
    }
}

export const getAccessorForNode= (nodeId, pages) => {
    const pageIdx= nodeId >> 16
    const offset= nodeId & 0xFFFF
    return create_node_accessor(pages[pageIdx])//.at(offset)
}
