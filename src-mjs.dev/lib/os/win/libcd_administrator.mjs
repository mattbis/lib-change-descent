/**
 * checks whether the current Windows process is running with elevated Administrator privileges.
 * required before modifying Windows Filtering Platform (`netsh advfirewall`) or low-level USN handles.
 */

// 2p
import { os_exec_sync } from '../libcd_os_executor.mjs'

export function win_is_administrator() {
    if (process.platform !== 'win32') return false
    var res= os_exec_sync('net', ['session'], { reject: false })
    return res.exitCode === 0
}