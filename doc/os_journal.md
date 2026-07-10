# Lecture Notes: High-Performance Filesystem Journaling with Zig & Node.js
**Course:** Advanced System Architecture & Forensics  
**Topic:** Implementing Low-Overhead OS Journal Readers in `lib-change-descent`

---

## 1. The Core Architecture: Windows vs. Linux

To build a high-performance filesystem monitoring layer, we must first recognize that the major operating systems treat change tracking in fundamentally asymmetric ways.

| Feature / OS | Windows (NTFS USN Journal) | Linux (ext4 / XFS / `fanotify`) |
| :--- | :--- | :--- |
| **Model** | **Persistent historical database** (Journal) | **Real-time ephemeral event stream** (`fanotify`) |
| **Data Source** | Master File Table (MFT) transaction journal | VFS (Virtual File System) event hooks |
| **Historical Queries** | Yes (can read changes that occurred while offline) | No (must run continuously; offline changes require diffing) |
| **Access Control** | Requires Administrator privileges (`GENERIC_READ` on `\\.\Volume`) | Requires `CAP_SYS_ADMIN` capabilities (root privileges) |
| **Identifiers** | 64-bit File Reference Number (FRN) | 64-bit Inode Number |

### Windows NTFS USN (Update Sequence Number) Journal
The USN Journal is a ring-buffer database managed by NTFS. When any file operation occurs, NTFS appends a record containing the filename, the transaction type (create, write, rename, delete), and a unique 64-bit USN. We can query this journal starting from a specific USN, allowing us to catch up on missed events since the last session.

### Linux Journaling vs. `fanotify`
Linux filesystems *do* have journals (e.g., JBD2 for ext4), but they are internal metadata consistency logs designed for crash recovery, not user-space change auditing. 
Instead, Linux exposes the **`fanotify`** API at the Virtual File System (VFS) layer. By calling `fanotify_init` and `fanotify_mark` with `FAN_MARK_FILESYSTEM`, we can capture all namespace and data modifications across an entire mount point. However, `fanotify` events are ephemeral: they are streamed live and lost if no listener is active.

---

## 2. Achieving "Mechanical Sympathy" via a Zero-Allocation Binary Protocol

As established in `README.md`, invoking JS string decoders (`TextDecoder`) on high-frequency paths will trigger catastrophic Garbage Collection (GC) pressure. 

To maintain mechanical sympathy, our Zig subprocess must stream change events to Node.js as raw binary chunks conforming to a strict, packed structure. The path names must remain in their raw UTF-8 binary representation, to be hashed or matched directly as `Uint8Array` slices without converting them to native JavaScript strings.

### Binary Event Packet Structure

Each event is written sequentially as a fixed-size header followed immediately by the variable-length filename:

```
+-----------------------------------------------------------------+
| Offset | Field          | Type   | Description                  |
+-----------------------------------------------------------------+
| 0      | magic_bytes    | u16    | 0xCDCD validation header     |
| 2      | action_mask    | u16    | Event flags (Create, Write)  |
| 4      | name_len       | u32    | Length of filename in bytes  |
| 8      | file_id        | u64    | NTFS FRN or Linux Inode      |
| 16     | parent_id      | u64    | Parent directory FRN/Inode   |
| 24     | timestamp      | u64    | Unix epoch milliseconds      |
+-----------------------------------------------------------------+
| 32     | file_name      | u8[]   | Raw UTF-8 bytes (name_len)   |
+-----------------------------------------------------------------+
```

---

## 3. Implementation in Zig

Below is a conceptual blueprint of the Zig side (`src-zig.dev/journal_reader.zig`). It runs as a low-level helper binary.

```zig
const std = @import("std");
const windows = std.os.windows;

const EventAction = enum(u16) {
    create = 0x01,
    modify = 0x02,
    delete = 0x04,
    rename = 0x08,
};

const LibcdEventHeader = packed struct {
    magic_bytes: u16 = 0xCDCD,
    action_mask: u16,
    name_len: u32,
    file_id: u64,
    parent_id: u64,
    timestamp: u64,
};

// Windows USN Query Loop Example
pub fn streamUsnJournal(volume_path: []const u8, writer: anytype) !void {
    // 1. Open volume handle with administrator rights
    const wpath = try std.unicode.utf8ToUtf16LeAlloc(std.heap.page_allocator, volume_path);
    defer std.heap.page_allocator.free(wpath);

    const handle = windows.kernel32.CreateFileW(
        wpath.ptr,
        windows.GENERIC_READ,
        windows.FILE_SHARE_READ | windows.FILE_SHARE_WRITE,
        null,
        windows.OPEN_EXISTING,
        windows.FILE_FLAG_BACKUP_SEMANTICS,
        null,
    );
    if (handle == windows.INVALID_HANDLE_VALUE) {
        return error.AccessDenied;
    }
    defer _ = windows.kernel32.CloseHandle(handle);

    // 2. Read USN Journal data using DeviceIoControl
    // (Detailing FSCTL_QUERY_USN_JOURNAL and FSCTL_READ_USN_JOURNAL control loops)
    // ...
}
```

---

## 4. Integration into Node.js (`src-mjs.dev/lib/os/libcd_os_journal.mjs`)

The JavaScript layer spawns the Zig binary, pipes standard output as a raw stream, and parses the binary structs using a fast sliding window.

```javascript
import { spawn } from 'node:child_process';
import { post } from '../imut_log/libcd_imut_log.mjs';
import { make_entry } from '../imut_log/libcd_imut_log_entry.mjs';

/**
 * Spawns the native Zig journal reader and registers a binary parser.
 * @param {string} volumePath e.g. "C:\\" or "/mnt/data"
 * @param {function(Uint8Array, object): void} callback Event consumer
 */
export function startJournalStream(volumePath, callback) {
    post(make_entry('OS_CALL', 'START_JOURNAL_STREAM', { volume: volumePath }));

    const helperProcess = spawn('./bin/libcd-journal', [volumePath]);
    
    let buffer = Buffer.alloc(0);

    helperProcess.stdout.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        
        while (buffer.length >= 32) {
            const magic = buffer.readUInt16LE(0);
            if (magic !== 0xCDCD) {
                throw new Error("Mismatched magic header bytes. Out of sync!");
            }

            const actionMask = buffer.readUInt16LE(2);
            const nameLen = buffer.readUInt32LE(4);
            const packetSize = 32 + nameLen;

            if (buffer.length < packetSize) {
                // Wait for the full path string to arrive in the stream
                break; 
            }

            const fileId = buffer.readBigUInt64LE(8);
            const parentId = buffer.readBigUInt64LE(16);
            const timestamp = buffer.readBigUInt64LE(24);
            
            // Extract the raw binary sub-slice for the filename to avoid TextDecoder allocations
            const nameBuffer = new Uint8Array(buffer.buffer, buffer.byteOffset + 32, nameLen);

            callback(nameBuffer, {
                actionMask,
                fileId,
                parentId,
                timestamp
            });

            // Slice the buffer forward
            buffer = buffer.subarray(packetSize);
        }
    });

    helperProcess.stderr.on('data', (err) => {
        post(make_entry('OS_ERROR', 'JOURNAL_HELPER_STDERR', { error: err.toString() }));
    });
}
```

---

## 5. Difficulty & Implementation Analysis

### A. Access Permissions (High Difficulty)
Both `DeviceIoControl` (USN Journal) and `fanotify` require high OS privilege levels (Administrator on Windows, Root/`CAP_SYS_ADMIN` on Linux). 
* **Mitigation:** The library must graceful fall back to classic filesystem traversal (`readdir`/`stat`) when running in user-space without elevated permissions.

### B. Memory Alignments & Garbage Collection (Low Difficulty in Zig, Critical in JS)
By enforcing a binary-packed format, we eliminate intermediate string allocations. We can feed the raw `nameBuffer` straight into our BLAKE3 WASM hash function to match existing memory-mapped nodes.

### C. OS Consistency (Medium Difficulty)
While Windows allows us to reconstruct history using a transaction journal, Linux `fanotify` forces us to monitor in real-time. To maintain a unified abstraction, `lib-change-descent` will use the native journal for fast incremental catch-ups on Windows, and fall back to real-time event logging on Linux supplemented by a periodic background hash diff.
