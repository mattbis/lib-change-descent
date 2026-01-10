export interface FileNode {
    id: number
    flags: number
    parentId: number
    mtime: number
    size: number
}

/**
 * Persistence Strategy for Session Recovery
 */
interface SessionCheckpoint {
    sessionId: string
    diskUuid: string
    nodeCursor: number      // Current position in the SharedArrayBuffer
    stringCursor: number    // Current position in the String Heap
    lastScannedPath: string // The physical path we were at
    timestamp: number
}
