
/**
 * In dev and alpha - this will check memory regions pointers are aligned
 * 
 * @param {number} node_id - The ID of the node being accessed
 * @param {number} offset - The byte offset within that node (e.g., 16 for mtime)
 * @param {number} byte_size - The size of the type (e.g., 8 for Float64)
 */
export function assert_alignment(node_id, offset, byte_size) {
    const absolute_address= (node_id * 32) + offset
    if (absolute_address % byte_size !== 0) {
        throw new Error(
            `ALIGNMENT_ERROR: Node ${node_id} at offset ${offset} is not ${byte_size}-byte aligned. ` +
            `Address ${absolute_address} is not divisible by ${byte_size}.`
        )
    }
}
