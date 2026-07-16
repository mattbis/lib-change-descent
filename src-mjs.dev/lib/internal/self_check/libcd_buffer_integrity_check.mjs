/**
 * perform checks as part of invariants in dev and alpha builds, to ensure I didnt make a mistake !
 * otherwise data will be corrupted..
 * @param {Object} buffer
 */
export function _run_full_buffer_integrity_check(buffer) {
    const stride= 32
    const CANARY_VAL= 0xAA
    const CANARY_OFFSET= 31 // Last byte of the stride

    for (let i=0; i < buffer.node_cursor; i++) {
        const base= i * stride

        // 1. Check Canary (detects stride/offset borking)
        if (buffer.u8_view[base + CANARY_OFFSET] !== CANARY_VAL) {
            throw new Error(`MEMORY_CORRUPTION: Node ${i} canary is dead at offset ${base + CANARY_OFFSET}. Expected ${CANARY_VAL}, found ${buffer.u8_view[base + CANARY_OFFSET]}`)
        }

        // 2. Check Parent Pointer logic
        const parent_id= buffer.i32_view[(base + 4) / 4]
        if (parent_id !== 0 && parent_id >= i) {
            // In a descent, parents are usually created before children.
            // If a parent ID is higher than the current ID, something might be wrong.
            console.warn(`[DIAGNOSTIC]: Logical anomaly at Node ${i}: Parent ID ${parent_id} is higher than current ID.`)
        }

        // 3. String Heap Bounds
        const name_ptr = buffer.i32_view[(base + 8) / 4]
        if (buffer.string_heap && name_ptr > buffer.string_heap.byte_length) {
            throw new Error(`POINTER_OUT_OF_BOUNDS: Node ${i} namePointer ${name_ptr} exceeds StringHeap size (${buffer.string_heap.byte_length}).`)
        }

        // 4. Hash Pointer Bounds
        const hash_ptr = buffer.i32_view[(base + 12) / 4]
        if (hash_ptr < 0) {
            throw new Error(`POINTER_OUT_OF_BOUNDS: Node ${i} hashPointer ${hash_ptr} is negative.`)
        }
    }
}

