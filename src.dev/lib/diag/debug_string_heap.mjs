// if process.NODE_ENV !== 'production'
export const MAX_STRING_HEAP_SEARCH = 4096

export function verify_string_heap(buffer, string_heap, node_cursor) {
    const decoder = new TextDecoder()
    const stride= 32
    const i32= new Int32Array(buffer)
    const u8_heap= new Uint8Array(string_heap)
    const heap_size= string_heap.byteLength

    for (let i= 0; i < node_cursor; i++) {
        const base= i * stride
        const name_ptr= i32[(base + 8) / 4]

        // 1. Bounds Check
        if (name_ptr < 0 || name_ptr >= heap_size) {
            throw new Error(`[STRING_HEAP_BORKED]: Node ${i} has pointer ${name_ptr} outside heap of ${heap_size}`)
        }

        // 2. Null-Terminator Search
        // We look ahead to ensure the string eventually ends
        let foundNull= false
        let length= 0
        const max_search= MAX_STRING_HEAP_SEARCH // Paths shouldn't really be longer than this

        for (let j= name_ptr; j < name_ptr + max_search && j < heap_size; j++) {
            if (u8_heap[j] === 0) {
                foundNull= true
                length= j - name_ptr
                break
            }
        }

        if (!foundNull) {
            throw new Error(`[STRING_HEAP_BORKED]: Node ${i} at ptr ${name_ptr} is not null-terminated or too long`)
        }

        // 3. Optional: UTF-8 Validation
        // If we suspect corruption, try decoding the slice
        if (process.env.DEBUG_DEEP) {
            try {
                const u8_slice= u8_heap.slice(name_ptr, name_ptr + length)
                decoder.decode(u8_slice)
            }
            catch (e) {
                throw new Error(`[STRING_HEAP_CORRUPTION]: Node ${i} contains invalid UTF-8 sequences`)
            }
        }
    }

    return true
}
