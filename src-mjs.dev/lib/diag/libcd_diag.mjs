/**
 * Consolidated diagnostic inspection and verification module (`libcd_diag.mjs`).
 * Visualizes node structs, validates string heap null-terminators/bounds, and audits sessions.
 */

export const MAX_STRING_HEAP_SEARCH = 4096

/**
 * Visualizes a specific node's memory for debugging
 */
export function debug_dump_node(node_id, buffer) {
    const stride = 32
    const start = node_id * stride
    const u8 = new Uint8Array(buffer, start, stride)

    console.log(`\n--- DEBUG DUMP: Node ${node_id} (Byte Offset: ${start}) ---`)

    let hex_row = ""
    let ascii_row = ""

    for (let i = 0; i < stride; i++) {
        const byte = u8[i]
        hex_row += byte.toString(16).padStart(2, '0') + " "
        ascii_row += (byte >= 32 && byte <= 126) ? String.fromCharCode(byte) : "."

        if ((i + 1) % 16 === 0) {
            console.log(`${hex_row.trim().padEnd(48)} | ${ascii_row}`)
            hex_row = ""
            ascii_row = ""
        }
    }
    console.log("------------------------------------------------------\n")
}

/**
 * Verifies string heap pointers and null termination boundaries across allocated node cursors
 */
export function verify_string_heap(buffer, string_heap, node_cursor) {
    const decoder = new TextDecoder()
    const stride = 32
    const i32 = new Int32Array(buffer)
    const u8_heap = new Uint8Array(string_heap)
    const heap_size = string_heap.byteLength

    for (let i = 0; i < node_cursor; i++) {
        const base = i * stride
        const name_ptr = i32[(base + 8) / 4]

        if (name_ptr < 0 || name_ptr >= heap_size) {
            throw new Error(`[STRING_HEAP_BORKED]: Node ${i} has pointer ${name_ptr} outside heap of ${heap_size}`)
        }

        let foundNull = false
        let length = 0
        const max_search = MAX_STRING_HEAP_SEARCH

        for (let j = name_ptr; j < name_ptr + max_search && j < heap_size; j++) {
            if (u8_heap[j] === 0) {
                foundNull = true
                length = j - name_ptr
                break
            }
        }

        if (!foundNull) {
            throw new Error(`[STRING_HEAP_BORKED]: Node ${i} at ptr ${name_ptr} is not null-terminated or too long`)
        }

        if (process.env.DEBUG_DEEP) {
            try {
                const u8_slice = u8_heap.slice(name_ptr, name_ptr + length)
                decoder.decode(u8_slice)
            } catch (e) {
                throw new Error(`[STRING_HEAP_CORRUPTION]: Node ${i} contains invalid UTF-8 sequences`)
            }
        }
    }

    return true
}
