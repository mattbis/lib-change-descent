/**
 * checks whether the current Windows process is running with elevated Administrator privileges.
 * required before modifying Windows Filtering Platform (`netsh advfirewall`) or low-level USN handles.
 */

// 1p
import { spawnSync } from 'node:child_process'

export function win_is_administrator() {
    if (process.platform !== 'win32') return false
    try {
        // `net session` only succeeds when running with elevated Administrator rights
        var res= spawnSync('net', ['session'], { stdio: 'ignore', windowsHide: true })
        return res.status === 0
    } catch (e) {
        return false
    }
}