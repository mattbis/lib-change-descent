/** * SCHEMA DEFINITION (32 Bytes per Node)
 * 0: Flags (Uint8) 
 * 1-3: Reserved/Padding
 * 4: ParentId (Int32)
 * 8: NamePointer (Int32)
 * 12: HashPointer (Int32)
 * 16: MTime (Float64)
 * 24: Size (Float64)
 */

const NODE_STRIDE = 32; // Bytes per node

export const createNodeAccessor = (buffer) => {
    const u8 = new Uint8Array(buffer)
    const i32 = new Int32Array(buffer)
    const f64 = new Float64Array(buffer)

    return {
        // Getters
        getFlags: (id) => u8[id * NODE_STRIDE],
        getParent: (id) => i32[(id * NODE_STRIDE + 4) / 4],
        getNamePtr: (id) => i32[(id * NODE_STRIDE + 8) / 4],
        getMTime: (id) => f64[(id * NODE_STRIDE + 16) / 8],
    
        // Setters
        setFlags: (id, val) => { u8[id * NODE_STRIDE] = val; },
        setParent: (id, val) => { i32[(id * NODE_STRIDE + 4) / 4] = val; },
        setNamePtr: (id, val) => { i32[(id * NODE_STRIDE + 8) / 4] = val; },
        setMTime: (id, val) => { f64[(id * NODE_STRIDE + 16) / 8] = val; },

        // Bitwise Helpers
        addFlag: (id, flag) => { u8[id * NODE_STRIDE] |= flag; },
        hasFlag: (id, flag) => (u8[id * NODE_STRIDE] & flag) !== 0
    }
}
