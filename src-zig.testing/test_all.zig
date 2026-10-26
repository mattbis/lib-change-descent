const std = @import("std");
const testing = std.testing;
const journal = @import("journal");

test "LibcdEventHeader packed struct layout and magic bytes invariant" {
    const header = journal.LibcdEventHeader{
        .magic_bytes = 0xCDCD,
        .action_mask = @intFromEnum(journal.EventAction.modify) | @intFromEnum(journal.EventAction.create),
        .name_len = 1024,
        .file_id = 0xAABBCCDDEEFF0011,
        .parent_id = 0x1100FFEEDDCCBBAA,
        .timestamp = 0x0123456789ABCDEF,
    };

    try testing.expectEqual(@as(u16, 0xCDCD), header.magic_bytes);
    try testing.expectEqual(@as(u16, 0x03), header.action_mask);
    try testing.expectEqual(@as(u32, 1024), header.name_len);
    try testing.expectEqual(@as(u64, 0xAABBCCDDEEFF0011), header.file_id);
    try testing.expectEqual(@as(u64, 0x1100FFEEDDCCBBAA), header.parent_id);
    try testing.expectEqual(@as(u64, 0x0123456789ABCDEF), header.timestamp);

    // Verify packed struct size is exactly 32 bytes (2+2+4+8+8+8 = 32)
    try testing.expectEqual(@as(usize, 32), @sizeOf(journal.LibcdEventHeader));
}

test "EventAction enum bitmask flags verification" {
    try testing.expectEqual(@as(u16, 0x01), @intFromEnum(journal.EventAction.create));
    try testing.expectEqual(@as(u16, 0x02), @intFromEnum(journal.EventAction.modify));
    try testing.expectEqual(@as(u16, 0x04), @intFromEnum(journal.EventAction.delete));
    try testing.expectEqual(@as(u16, 0x08), @intFromEnum(journal.EventAction.rename));
}

test "streamUsnJournal interface verification on non-existent volume returns clean error" {
    var dummy_buf: [64]u8 = undefined;
    var writer = std.Io.Writer.fixed(&dummy_buf);

    // Invoking on an invalid volume or non-admin context should fail cleanly
    const res = journal.streamUsnJournal("INVALID_VOL_999:\\", &writer);
    try testing.expect(res == error.AccessDenied or res == error.FileNotFound or res == error.NameTooLong or res == error.Unexpected or res == error.InvalidHandle or res == error.InvalidCharacter or res == error.InvalidUtf8);
}
