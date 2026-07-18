/**
 * libcd_signal.mjs
 * 
 * Modern core signaling primitive without complex listener/callback arrays.
 * Utilizes standard V8/Node `EventTarget` and `AbortController` / `AbortSignal`
 * alongside bitwise status byte representation (`signals()`) and bitwise enum (`flags()`).
 * 
 * Note: Per-volume `SIG_STATE` has moved to `libcd_volume.mjs` as `VOLUME_SIG_STATE`.
 */

import { stamp } from './internal/stamp/libcd_stamp.mjs'

// Internal status bitfield across library execution
var _current_status_byte = 0x02 // Default: RUN (bit 1)

/** gets signals as boolean object or bitwise enum */
export function flags() {
    return {
        ABORT:   1 << 0, // 0x01
        RUN:     1 << 1, // 0x02
        PAUSE:   1 << 2, // 0x04
        DIRTY:   1 << 3, // 0x08
        YIELD:   1 << 4  // 0x10
    }
}

/** 
 * gets a byte indicating the status as bits (`0b...` bytestring or raw number if option supplied)
 * @param {{ format?: 'string' | 'number', status?: number }} [options={}]
 */
export function signals(options = {}) {
    if (options.status !== undefined && options.status !== null) {
        _current_status_byte = options.status & 0xFF
        stamp('SIGNAL_STATUS_UPDATE', { status: _current_status_byte })
    }

    if (options.format === 'number') {
        return _current_status_byte
    }

    // Return binary string representation (e.g., '0b00000010')
    return '0b' + _current_status_byte.toString(2).padStart(8, '0')
}

/**
 * Creates a modern `1p` core EventTarget emitter for signal dispatch without legacy callback arrays.
 * @returns {EventTarget}
 */
export function signal_emitter() {
    return new EventTarget()
}

/**
 * Creates a standard `1p` core AbortController for clean async cancellation and micro-pauses.
 * @returns {AbortController}
 */
export function signal_controller() {
    return new AbortController()
}
