/**
 * internal/stamp/libcd_stamp.mjs
 * 
 * Consolidated stamp primitive: whenever the code of the library is operated on,
 * this records a stamp that is emitted to both the user log (console/user output)
 * and the immutable manifest log (`imut_log`).
 * 
 * This ensures every run of the library is traceable in both human and machine logs.
 */

import { post } from '../imut_log/libcd_imut_log.mjs'
import { make_entry } from '../imut_log/libcd_imut_log_entry.mjs'

/**
 * space-prefixed function: stamp_record
 * Records an operational stamp into both the user log and the immutable manifest log.
 * 
 * @param {string} event_name - Name of the action or lifecycle event triggering the stamp
 * @param {Object} [details={}] - Additional metadata or payload for the stamp
 * @returns {{ event_name: string, timestamp: number, pid: number, details: Object }}
 */
export function stamp_record(event_name, details = {}) {
    const timestamp = Date.now()
    const pid = typeof process !== 'undefined' && process.pid ? process.pid : -1

    const entry_payload = {
        event_name,
        timestamp,
        pid,
        details
    }

    // 1. Post to immutable manifest log (machine verification / resident tracking)
    post(make_entry('STAMP', event_name, entry_payload))

    // 2. Emit to user log (human observability)
    // TODO (matt): wire to formal user log stream when user mode logging is configured via etc/
    if (typeof console !== 'undefined' && console.log) {
        console.log(`[LIBCD_STAMP] ${event_name} (pid: ${pid}, ts: ${timestamp})`)
    }

    return entry_payload
}

/** backward compatibility / convenient short alias */
export const stamp = (event_name, details = {}) => stamp_record(event_name, details)
