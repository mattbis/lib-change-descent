const std = @import("std");
const journal = @import("journal");

pub fn main(init: std.process.Init.Minimal) !void {
    var arena = std.heap.ArenaAllocator.init(std.heap.smp_allocator);
    defer arena.deinit();
    const args = try std.process.Args.toSlice(init.args, arena.allocator());

    if (args.len > 1) {
        const arg = args[1];
        if (std.mem.eql(u8, arg, "--version") or std.mem.eql(u8, arg, "-v")) {
            std.debug.print("libcd-journal v0.0.1 (native USN/VFS monitor)\n", .{});
            return;
        }
        if (std.mem.eql(u8, arg, "--help") or std.mem.eql(u8, arg, "-h")) {
            std.debug.print("usage: libcd-journal [volume_path | --self-test | --version]\n", .{});
            return;
        }
        if (std.mem.eql(u8, arg, "--self-test")) {
            const header = journal.LibcdEventHeader{
                .magic_bytes = 0xCDCD,
                .action_mask = @intFromEnum(journal.EventAction.modify),
                .name_len = 16,
                .file_id = 0x1122334455667788,
                .parent_id = 0x8877665544332211,
                .timestamp = 0x123456789ABCDEF0,
            };
            std.debug.print("[LIBCD_JOURNAL] self-test header size={d} magic=0x{X:0>4}\n", .{ @sizeOf(journal.LibcdEventHeader), header.magic_bytes });
            return;
        }

        // Assume arg is volume path to monitor (e.g. C: or /)
        std.debug.print("[LIBCD_JOURNAL] streaming USN journal on volume `{s}`...\n", .{arg});
        journal.streamUsnJournal(arg, null) catch |err| {
            std.debug.print("[LIBCD_JOURNAL] stream error on volume `{s}`: {s}\n", .{ arg, @errorName(err) });
        };
        return;
    }

    std.debug.print("libcd-journal v0.0.1 (native USN/VFS monitor). Use --help for options.\n", .{});
}
