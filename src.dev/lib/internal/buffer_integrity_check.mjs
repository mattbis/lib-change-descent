// TODO(matt): more drafts : since some of this I need to confirm I really understand....
export function _run_full_buffer_integrity_check() {
    const stride = 32
    const CANARY_VAL = 0xAA
    const CANARY_OFFSET = 31 // Last byte of the stride

    for (let i = 0; i < this.node_cursor; i++) {
        const base = i * stride

        // 1. Check Canary (detects stride/offset borking)
        if (this.u8_view[base + CANARY_OFFSET] !== CANARY_VAL) {
            throw new Error(`MEMORY_CORRUPTION: Node ${i} canary is dead at offset ${base + CANARY_OFFSET}. Expected ${CANARY_VAL}, found ${this.u8_view[base + CANARY_OFFSET]}`)
        }

        // 2. Check Parent Pointer logic
        const parent_id = this.i32_view[(base + 4) / 4];
        if (parentId !== 0 && parentId >= i) {
            // In a descent, parents are usually created before children.
            // If a parent ID is higher than the current ID, something might be wrong.
            console.warn(`[DIAGNOSTIC]: Logical anomaly at Node ${i}: Parent ID ${parentId} is higher than current ID.`);
        }

        // 3. String Heap Bounds
        const name_ptr = this.i32_view[(base + 8) / 4];
        if (name_ptr > this.string_heap.byte_length) {
            throw new Error(`POINTER_OUT_OF_BOUNDS: Node ${i} namePointer ${name_ptr} exceeds StringHeap size.`);
        }
    }
}
