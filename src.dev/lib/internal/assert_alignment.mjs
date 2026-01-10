/**
 * @param {number} nodeId - The ID of the node being accessed
 * @param {number} offset - The byte offset within that node (e.g., 16 for mtime)
 * @param {number} byteSize - The size of the type (e.g., 8 for Float64)
 */
export function assertAlignment(nodeId, offset, byteSize) {
  const absoluteAddress = (nodeId * 32) + offset;
  if (absoluteAddress % byteSize !== 0) {
    throw new Error(
      `ALIGNMENT_ERROR: Node ${nodeId} at offset ${offset} is not ${byteSize}-byte aligned. ` +
      `Address ${absoluteAddress} is not divisible by ${byteSize}.`
    )
  }
}
