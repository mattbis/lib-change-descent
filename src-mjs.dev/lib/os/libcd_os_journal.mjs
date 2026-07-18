/**
 * Reads the OS filesystem change journal for a volume (NTFS USN on Windows, fanotify on Linux).
 * 
 * For full architectural design, binary structures, and Zig integration details,
 * see {@link ../../../doc/os_journal.md}.
 */

import { spawn } from 'node:child_process';
import { post } from '../imut_log/libcd_imut_log.mjs';
import { make_entry } from '../imut_log/libcd_imut_log_entry.mjs';

/**
 * Spawns the native Zig journal reader subprocess and monitors volume changes.
 * Under the hood, this parses the high-performance binary protocol emitted by
 * the Zig helper to avoid text decoding allocations on path comparisons.
 * 
 * @param {string} volumePath - The drive letter (Windows) or mount point (Linux).
 * @param {function(Uint8Array, object): void} eventCallback - Receives raw binary filenames and event details.
 * @returns {object} The spawned subprocess handle for lifecycle management.
 */
export function os_journal_stream(volumePath, eventCallback) {
    post(make_entry('OS_CALL', 'STREAM_OS_JOURNAL_START', { volume: volumePath }));

    // TODO: Determine platform, resolve path to pre-built Zig helper, and invoke
    throw new Error('Not implemented: streamOSJournal requires compiled Zig helper');
}
