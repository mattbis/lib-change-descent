// if process.NODE_ENV !== 'production'

/**
 * Visualizes a specific node's memory for debugging
 */
export function debug_dump_node(node_id, buffer) {
    const stride= 32
    const start= node_id * stride
    const u8= new Uint8Array(buffer, start, stride)

    console.log(`\n--- DEBUG DUMP: Node ${node_id} (Byte Offset: ${start}) ---`)

    let hex_row= ""
    let ascii_row= ""

    for (let i=0; i < stride; i++) {
        const byte= u8[i]
        // Format to 2-digit hex
        hex_row += byte.toString(16).padStart(2, '0') + " "

        // Format to readable ASCII or a dot
        ascii_row += (byte >= 32 && byte <= 126)
            ? String.fromCharCode(byte)
            : "."

        // Break every 16 bytes for readability
        if ((i + 1) % 16 === 0) {
            console.log(`${hex_row.trim().padEnd(48)} | ${ascii_row}`)
            hex_row= ""
            ascii_row= ""
        }
    }
    console.log("------------------------------------------------------\n")
}