const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    // Public module for core journal reader and packed binary headers
    const journal_mod = b.addModule("journal", .{
        .root_source_file = b.path("src-zig.dev/journal_reader.zig"),
        .target = target,
        .optimize = optimize,
    });

    // Static library (`libcd_journal`)
    const lib_mod = b.createModule(.{
        .root_source_file = b.path("src-zig.dev/journal_reader.zig"),
        .target = target,
        .optimize = optimize,
    });
    const lib = b.addLibrary(.{
        .linkage = .static,
        .name = "libcd_journal",
        .root_module = lib_mod,
    });
    b.installArtifact(lib);

    // Executable binary (`libcd-journal.exe`) for high-speed USN journal/VFS stream monitoring
    const exe_mod = b.createModule(.{
        .root_source_file = b.path("src-zig.dev/main.zig"),
        .target = target,
        .optimize = optimize,
    });
    exe_mod.addImport("journal", journal_mod);

    const exe = b.addExecutable(.{
        .name = "libcd-journal",
        .root_module = exe_mod,
    });
    b.installArtifact(exe);

    // Run command step
    const run_cmd = b.addRunArtifact(exe);
    run_cmd.step.dependOn(b.getInstallStep());
    if (b.args) |args| {
        run_cmd.addArgs(args);
    }
    const run_step = b.step("run", "Run the libcd-journal executable");
    run_step.dependOn(&run_cmd.step);

    // Unit test suite
    const test_mod = b.createModule(.{
        .root_source_file = b.path("src-zig.testing/test_all.zig"),
        .target = target,
        .optimize = optimize,
    });
    test_mod.addImport("journal", journal_mod);

    const unit_tests = b.addTest(.{
        .root_module = test_mod,
    });

    const run_unit_tests = b.addRunArtifact(unit_tests);
    const test_step = b.step("test", "Run unit tests");
    test_step.dependOn(&run_unit_tests.step);

    // Syntax check / IDE fast target
    const check = b.step("check", "Check if project compiles cleanly");
    check.dependOn(&exe.step);
    check.dependOn(&lib.step);
    check.dependOn(&unit_tests.step);
}
