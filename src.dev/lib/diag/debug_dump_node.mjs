// if process.NODE_ENV !== 'production'

/**
 * Visualizes a specific node's memory for debugging
 */
export function debug_dump_node(nodeId, buffer) {
    const stride = 32
    const start = nodeId * stride
    const u8 = new Uint8Array(buffer, start, stride)

    console.log(`\n--- DEBUG DUMP: Node ${nodeId} (Byte Offset: ${start}) ---`)

    let hexRow = ""
    let asciiRow = ""

    for (let i = 0; i < stride; i++) {
        const byte = u8[i]
        // Format to 2-digit hex
        hexRow += byte.toString(16).padStart(2, '0') + " ";

        // Format to readable ASCII or a dot
        asciiRow += (byte >= 32 && byte <= 126) ? String.fromCharCode(byte) : ".";

        // Break every 16 bytes for readability
        if ((i + 1) % 16 === 0) {
            console.log(`${hexRow.trim().padEnd(48)} | ${asciiRow}`)
            hexRow = ""
            asciiRow = ""
        }
    }
    console.log("------------------------------------------------------\n")
}