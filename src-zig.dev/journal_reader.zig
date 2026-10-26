const std = @import("std");
const windows = std.os.windows;

pub const GENERIC_READ: windows.DWORD = 0x80000000;
pub const FILE_SHARE_READ: windows.DWORD = 0x00000001;
pub const FILE_SHARE_WRITE: windows.DWORD = 0x00000002;
pub const OPEN_EXISTING: windows.DWORD = 3;
pub const FILE_FLAG_BACKUP_SEMANTICS: windows.DWORD = 0x02000000;
pub const INVALID_HANDLE_VALUE: windows.HANDLE = @ptrFromInt(@as(usize, @bitCast(@as(isize, -1))));

extern "kernel32" fn CreateFileW(
    lpFileName: [*:0]const u16,
    dwDesiredAccess: windows.DWORD,
    dwShareMode: windows.DWORD,
    lpSecurityAttributes: ?*anyopaque,
    dwCreationDisposition: windows.DWORD,
    dwFlagsAndAttributes: windows.DWORD,
    hTemplateFile: ?windows.HANDLE,
) callconv(.winapi) windows.HANDLE;

extern "kernel32" fn DeviceIoControl(
    hDevice: windows.HANDLE,
    dwIoControlCode: windows.DWORD,
    lpInBuffer: ?*const anyopaque,
    nInBufferSize: windows.DWORD,
    lpOutBuffer: ?*anyopaque,
    nOutBufferSize: windows.DWORD,
    lpBytesReturned: ?*windows.DWORD,
    lpOverlapped: ?*anyopaque,
) callconv(.winapi) windows.BOOL;

pub const FSCTL_QUERY_USN_JOURNAL: windows.DWORD = 0x000900F4;
pub const FSCTL_READ_USN_JOURNAL: windows.DWORD = 0x000900BB;

pub const USN_JOURNAL_DATA_V0 = extern struct {
    UsnJournalID: u64,
    FirstUsn: i64,
    NextUsn: i64,
    LowestValidUsn: i64,
    MaxUsn: i64,
    MaximumSize: u64,
    AllocationDelta: u64,
};

pub const READ_USN_JOURNAL_DATA_V0 = extern struct {
    StartUsn: i64,
    ReasonMask: windows.DWORD,
    ReturnOnlyOnClose: windows.DWORD,
    Timeout: u64,
    BytesToWaitFor: u64,
    UsnJournalID: u64,
};

pub const USN_RECORD_V2 = extern struct {
    RecordLength: windows.DWORD,
    MajorVersion: windows.WORD,
    MinorVersion: windows.WORD,
    FileReferenceNumber: u64,
    ParentFileReferenceNumber: u64,
    Usn: i64,
    TimeStamp: i64,
    Reason: windows.DWORD,
    SourceInfo: windows.DWORD,
    SecurityId: windows.DWORD,
    FileAttributes: windows.DWORD,
    FileNameLength: windows.WORD,
    FileNameOffset: windows.WORD,
};

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
    const wpath = try std.unicode.utf8ToUtf16LeAllocZ(std.heap.smp_allocator, volume_path);
    defer std.heap.smp_allocator.free(wpath);

    const handle = CreateFileW(
        wpath.ptr,
        GENERIC_READ,
        FILE_SHARE_READ | FILE_SHARE_WRITE,
        null,
        OPEN_EXISTING,
        FILE_FLAG_BACKUP_SEMANTICS,
        null,
    );
    if (handle == INVALID_HANDLE_VALUE) {
        return error.AccessDenied;
    }
    defer windows.CloseHandle(handle);

    // 2. Query USN Journal
    var journal_data: USN_JOURNAL_DATA_V0 = undefined;
    var bytes_returned: windows.DWORD = 0;
    if (DeviceIoControl(
        handle,
        FSCTL_QUERY_USN_JOURNAL,
        null,
        0,
        &journal_data,
        @sizeOf(USN_JOURNAL_DATA_V0),
        &bytes_returned,
        null,
    ) == .FALSE) {
        return error.Unexpected;
    }

    var next_usn: i64 = journal_data.NextUsn;
    var buffer: [65536]u8 align(8) = undefined;
    const epoch_offset_100ns: u64 = 116444736000000000;

    // 3. Read USN Journal in loop
    while (true) {
        var read_data = READ_USN_JOURNAL_DATA_V0{
            .StartUsn = next_usn,
            .ReasonMask = 0xFFFFFFFF,
            .ReturnOnlyOnClose = 0,
            .Timeout = 0,
            .BytesToWaitFor = 0,
            .UsnJournalID = journal_data.UsnJournalID,
        };

        if (DeviceIoControl(
            handle,
            FSCTL_READ_USN_JOURNAL,
            &read_data,
            @sizeOf(READ_USN_JOURNAL_DATA_V0),
            &buffer,
            @as(windows.DWORD, buffer.len),
            &bytes_returned,
            null,
        ) == .FALSE) {
            break;
        }

        if (bytes_returned <= 8) break;

        next_usn = @as(*const i64, @ptrCast(@alignCast(buffer[0..8].ptr))).*;
        var offset: usize = 8;
        while (offset + @sizeOf(USN_RECORD_V2) <= bytes_returned) {
            const record_ptr: [*]const u8 = buffer[offset..].ptr;
            const record: *const USN_RECORD_V2 = @ptrCast(@alignCast(record_ptr));
            if (record.RecordLength == 0) break;

            var action_mask: u16 = 0;
            if (record.Reason & 0x00000100 != 0) action_mask |= @intFromEnum(EventAction.create);
            if (record.Reason & (0x00000001 | 0x00000002 | 0x00000004 | 0x00008000 | 0x80000000) != 0) action_mask |= @intFromEnum(EventAction.modify);
            if (record.Reason & 0x00000200 != 0) action_mask |= @intFromEnum(EventAction.delete);
            if (record.Reason & (0x00001000 | 0x00002000) != 0) action_mask |= @intFromEnum(EventAction.rename);

            if (action_mask != 0 and record.FileNameLength > 0 and record.FileNameOffset + record.FileNameLength <= record.RecordLength) {
                const name_u16_ptr: [*]const u16 = @ptrCast(@alignCast(record_ptr + record.FileNameOffset));
                const name_u16_slice = name_u16_ptr[0 .. record.FileNameLength / 2];

                var utf8_buf: [1024]u8 = undefined;
                if (std.unicode.utf16LeToUtf8(&utf8_buf, name_u16_slice)) |name_len| {
                    const file_time: u64 = @bitCast(record.TimeStamp);
                    const timestamp_ms: u64 = if (file_time > epoch_offset_100ns) (file_time - epoch_offset_100ns) / 10000 else 0;

                    const header = LibcdEventHeader{
                        .magic_bytes = 0xCDCD,
                        .action_mask = action_mask,
                        .name_len = @intCast(name_len),
                        .file_id = record.FileReferenceNumber,
                        .parent_id = record.ParentFileReferenceNumber,
                        .timestamp = timestamp_ms,
                    };

                    if (@TypeOf(writer) != @TypeOf(null)) {
                        writer.writeAll(std.mem.asBytes(&header)) catch break;
                        writer.writeAll(utf8_buf[0..name_len]) catch break;
                    }
                } else |_| {}
            }

            offset += record.RecordLength;
        }
    }
}
