// if process.NODE_ENV !== 'production'

const decoder = new TextDecoder()

export function verifyStringHeap(buffer, stringHeap, nodeCursor) {
    const stride = 32
    const i32 = new Int32Array(buffer)
    const u8Heap = new Uint8Array(stringHeap)
    const heapSize = stringHeap.byteLength

    for (let i = 0; i < nodeCursor; i++) {
        const base = i * stride
        const namePtr = i32[(base + 8) / 4]

        // 1. Bounds Check
        if (namePtr < 0 || namePtr >= heapSize) {
            throw new Error(`[STRING_HEAP_BORKED]: Node ${i} has pointer ${namePtr} outside heap of ${heapSize}`)
        }

        // 2. Null-Terminator Search
        // We look ahead to ensure the string eventually ends
        let foundNull = false
        let length = 0
        const maxSearch = 4096 // Paths shouldn't really be longer than this

        for (let j = namePtr; j < namePtr + maxSearch && j < heapSize; j++) {
            if (u8Heap[j] === 0) {
                foundNull = true
                length = j - namePtr
                break
            }
        }

        if (!foundNull) {
            throw new Error(`[STRING_HEAP_BORKED]: Node ${i} at ptr ${namePtr} is not null-terminated or too long`)
        }

        // 3. Optional: UTF-8 Validation
        // If we suspect corruption, try decoding the slice
        if (process.env.DEBUG_DEEP) {
            try {
                const slice = u8Heap.slice(namePtr, namePtr + length)
                decoder.decode(slice)
            } catch (e) {
                throw new Error(`[STRING_HEAP_CORRUPTION]: Node ${i} contains invalid UTF-8 sequences`)
            }
        }
    }

    return true
}