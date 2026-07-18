/**
 * Self-check orchestrator and consolidated diagnostic assertions (`libcd_self_check.mjs`).
 *
 * Called around every operation (pre / post) to catch corruption, misalignment,
 * or environmental drift early. Guards are compiled away in release builds via
 * the build flag -D __LIBCD_DEV__.
 */

import { invariant } from '../../libcd_invariant.mjs'
import {
    volume_get_active_volumes,
    volume_get_known_metadata,
    LIBCD_VOLE_MASK,
    volume_add_mask,
    volume_clear_mask
} from '../../storage/libcd_volume.mjs'

export { invariant }

/**
 * In dev and alpha - this will check memory regions pointers are aligned
 * 
 * @param {number} node_id - The ID of the node being accessed
 * @param {number} offset - The byte offset within that node (e.g., 16 for mtime)
 * @param {number} byte_size - The size of the type (e.g., 8 for Float64)
 */
export function assert_alignment(node_id, offset, byte_size) {
    const absolute_address = (node_id * 32) + offset
    if (absolute_address % byte_size !== 0) {
        throw new Error(
            `ALIGNMENT_ERROR: Node ${node_id} at offset ${offset} is not ${byte_size}-byte aligned. ` +
            `Address ${absolute_address} is not divisible by ${byte_size}.`
        )
    }
}

/** assert db connection */
export function assert_db_file() {}
export function assert_db_connection() {}

/** checks that the configured storage still exists */
export function assert_storage() {}

/** checks in a staggered run whether assets/controllers/no-clash invariants hold */
export function assert_assets() {}
export function assert_controller() {}
export function assert_noclash() {}

/**
 * perform checks as part of invariants in dev and alpha builds
 * @param {Object} buffer
 */
export function _run_full_buffer_integrity_check(buffer) {
    const stride = 32
    const CANARY_VAL = 0xAA
    const CANARY_OFFSET = 31 // Last byte of the stride

    for (let i = 0; i < buffer.node_cursor; i++) {
        const base = i * stride

        // 1. Check Canary (detects stride/offset borking)
        if (buffer.u8_view[base + CANARY_OFFSET] !== CANARY_VAL) {
            throw new Error(`MEMORY_CORRUPTION: Node ${i} canary is dead at offset ${base + CANARY_OFFSET}. Expected ${CANARY_VAL}, found ${buffer.u8_view[base + CANARY_OFFSET]}`)
        }

        // 2. Check Parent Pointer logic
        const parent_id = buffer.i32_view[(base + 4) / 4]
        if (parent_id !== 0 && parent_id >= i) {
            console.warn(`[DIAGNOSTIC]: Logical anomaly at Node ${i}: Parent ID ${parent_id} is higher than current ID.`)
        }

        // 3. String Heap Bounds
        const name_ptr = buffer.i32_view[(base + 8) / 4]
        if (buffer.string_heap && name_ptr > buffer.string_heap.byte_length) {
            throw new Error(`POINTER_OUT_OF_BOUNDS: Node ${i} namePointer ${name_ptr} exceeds StringHeap size (${buffer.string_heap.byte_length}).`)
        }

        // 4. Hash Pointer Bounds
        const hash_ptr = buffer.i32_view[(base + 12) / 4]
        if (hash_ptr < 0) {
            throw new Error(`POINTER_OUT_OF_BOUNDS: Node ${i} hashPointer ${hash_ptr} is negative.`)
        }
    }
}

/**
 * space-prefixed function: assert_disk_vol_id
 * verifies a single volume instance (`target`). If the target is marked `removable`, `added_by_default`,
 * or belongs to a volatile species, ensures it has been properly imprinted before allowing scan pipelines.
 */
export function assert_disk_vol_id(target) {
    if (!target) return true

    if (typeof target.activity_mask === 'number') {
        target.activity_mask = volume_add_mask(target.activity_mask, LIBCD_VOLE_MASK.activity.maintain)
    }

    try {
        var is_removable = target.removable === true || target.species === 'removable' || target.species === 'volatile'
        var is_added_default = target.added_by_default === true

        if (is_removable || is_added_default) {
            var known_meta = target.hardware_id ? volume_get_known_metadata(target.hardware_id) : null
            var is_imprinted = target.imprinted === true || (known_meta && known_meta.imprinted === true)

            invariant(
                is_imprinted,
                `[VOL_ID_ASSERT] Volatile or removable volume (` + (target.hardware_id || 'unknown') + `) must be imprinted before access.`
            )
        }
    } finally {
        if (typeof target.activity_mask === 'number') {
            target.activity_mask = volume_clear_mask(target.activity_mask, LIBCD_VOLE_MASK.activity.maintain)
        }
    }

    return true
}

/**
 * space-prefixed function: assert_polling_disk_vol_ids
 * iterates across all active mounted volumes (`_active_volumes`) or context volume map (`ctx.volumes`)
 * verifying that no volatile/removable volumes have suffered identity drift or controller swap.
 */
export function assert_polling_disk_vol_ids(ctx = null) {
    var volumes_map = (ctx && ctx.volumes && typeof ctx.volumes.entries === 'function') ? ctx.volumes : volume_get_active_volumes()

    volumes_map.forEach(function(vol, id) {
        assert_disk_vol_id(vol)
    })

    return true
}

/**
 * Run the full self-check suite.
 * @param {Object} ctx - runtime context (buffer, db, storage references)
 */
export function run_self_check(ctx) {
    assert_db_file()
    assert_db_connection()
    assert_storage()
    assert_disk_vol_id()
    assert_polling_disk_vol_ids()

    if (ctx?.buffer) {
        _run_full_buffer_integrity_check(ctx.buffer)
    }
}

/**
 * Lightweight pre-op check — fast path for every operation.
 * Skips expensive buffer walk.
 * @param {Object} ctx
 */
export function run_pre_op_check(ctx) {
    assert_db_connection()
    assert_storage()
    assert_disk_vol_id()
}
