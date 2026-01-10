// TODO(matt): more drafts : since some of this I need to confirm I really understand....
function _runFullBufferIntegrityCheck() {
  const stride = 32;
  const CANARY_VAL = 0xAA;
  const CANARY_OFFSET = 31; // Last byte of the stride

  for (let i = 0; i < this.nodeCursor; i++) {
    const base = i * stride;
    
    // 1. Check Canary (detects stride/offset borking)
    if (this.u8View[base + CANARY_OFFSET] !== CANARY_VAL) {
      throw new Error(`MEMORY_CORRUPTION: Node ${i} canary is dead at offset ${base + CANARY_OFFSET}. Expected ${CANARY_VAL}, found ${this.u8View[base + CANARY_OFFSET]}`);
    }

    // 2. Check Parent Pointer logic
    const parentId = this.i32View[(base + 4) / 4];
    if (parentId !== 0 && parentId >= i) {
       // In a descent, parents are usually created before children.
       // If a parent ID is higher than the current ID, something might be wrong.
       console.warn(`[DIAGNOSTIC]: Logical anomaly at Node ${i}: Parent ID ${parentId} is higher than current ID.`);
    }

    // 3. String Heap Bounds
    const namePtr = this.i32View[(base + 8) / 4];
    if (namePtr > this.stringHeap.byteLength) {
       throw new Error(`POINTER_OUT_OF_BOUNDS: Node ${i} namePointer ${namePtr} exceeds StringHeap size.`);
    }
  }
}
