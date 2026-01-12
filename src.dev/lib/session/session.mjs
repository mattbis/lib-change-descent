export const HEADER_SIZE= 64
export const MAGIC= "LKMAN001"

/**
 * 
 * @param {number} node_count 
 * @param {number} heap_size 
 * @returns 
 */
export function create_session_header(node_count, heap_size) {
    const buffer= new ArrayBuffer(HEADER_SIZE)
    const view= new DataView(buffer)
    const encoder= new TextEncoder()

    // 1. Write Magic Bytes
    const magicBytes= encoder.encode(MAGIC)
    new Uint8Array(buffer).set(magicBytes, 0)

    // 2. Write Metadata
    view.setUint32(8, 1, true)             // Version 1, Little Endian
    view.setUint32(12, 0, true)            // Flags (currently empty)
    view.setUint32(16, node_count, true)    // Total nodes in session
    view.setUint32(20, heap_size, true)     // Total bytes in string heap
    
    // 3. Write Timestamp
    view.setBigUint64(24, BigInt(Date.now()), true)

    return new Uint8Array(buffer)
}

/**
 * @param {Uint8Array} header_buffer 
 * @returns {Object} 
 */
export function validate_header(header_buffer) {
    const view= new DataView(header_buffer.buffer)
    const decoder= new TextDecoder()
    
    // Check Magic is correct and no corruption happened
    const magic= decoder.decode(new Uint8Array(header_buffer.buffer, 0, 8))
    if (magic !== MAGIC) {
        throw new Error("INVALID_SESSION_FILE: Magic bytes mismatch")
    }

    // its faster to use const and then return .....
    const out= {
        version: view.getUint32(8, true),
        node_count: view.getUint32(16, true),
        heap_size: view.getUint32(20, true),
        timestamp: Number(view.getBigUint64(24, true))
    }
    
    return out
}
