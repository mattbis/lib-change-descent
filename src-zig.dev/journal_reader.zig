const std = @import("std");
const windows = std.os.windows;

pub const EventAction = enum(u16) {
    create = 0x01,
    modify = 0x02,
    delete = 0x04,
    rename = 0x08,
};

pub const LibcdEventHeader = packed struct {
    magic_bytes: u16 = 0xCDCD,
    action_mask: u16,
    name_len: u32,
    file_id: u64,
    parent_id: u64,
    timestamp: u64,
};

/// Windows USN Journal reader skeleton (`doc/os_journal.md`)
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
    // Detail FSCTL_QUERY_USN_JOURNAL and FSCTL_READ_USN_JOURNAL control loops
    _ = writer;
}
