/**
 * Self-check orchestrator.
 *
 * Called around every operation (pre / post) to catch corruption, misalignment,
 * or environmental drift early. Guards are compiled away in release builds via
 * the build flag -D __LIBCD_DEV__.
 *
 * Usage:
 *   import { run_self_check } from '../self_check/libcd_self_check.mjs'
 *   run_self_check(ctx)  // before / after an operation
 */

import { assert_alignment } from './libcd_assert_alignment.mjs'
import { assert_db_file, assert_db_connection } from './libcd_assert_db.mjs'
import { assert_storage } from './libcd_assert_storage.mjs'
import { assert_disk_vol_id, assert_polling_disk_vol_ids } from './libcd_assert_vol_id.mjs'
import { _run_full_buffer_integrity_check } from './libcd_buffer_integrity_check.mjs'
import { invariant } from './libcd_invariant.mjs'

export {
    // re-export primitives so callers only need one import point
    invariant,
    assert_alignment,
}

/**
 * Run the full self-check suite.
 * @param {Object} ctx - runtime context (buffer, db, storage references)
 */
export function run_self_check(ctx) {
    // TODO (matt): gate each check behind the appropriate build / severity flag

    assert_db_file()
    assert_db_connection()
    assert_storage()
    assert_disk_vol_id()
    assert_polling_disk_vol_ids()

    if (ctx?.buffer) {
        _run_full_buffer_integrity_check.call(ctx.buffer)
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
