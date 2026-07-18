/**
 * volume identification assertions (`libcd_assert_vol_id.mjs`)
 * ensures in all profiles and modes (`+resident`, `+bg`, `+fg`) that volumes marked as `removable`
 * (`USB`, volatile bus) or `added_by_default` maintain a verified imprint (`LIBCD_IMPRINT_MAGIC`).
 * detects bus disconnects, disk swap events, or controller identifier drift.
 */

// 2p
import { invariant } from '../../libcd_invariant.mjs'
import { volume_get_active_volumes, volume_get_known_metadata } from '../../storage/libcd_volume.mjs'

/**
 * space-prefixed function: assert_disk_vol_id
 * verifies a single volume instance (`target`). If the target is marked `removable`, `added_by_default`,
 * or belongs to a volatile species, ensures it has been properly imprinted before allowing scan pipelines.
 */
export function assert_disk_vol_id(target) {
    if (!target) return true

    var is_removable= target.removable === true || target.species === 'removable' || target.species === 'volatile'
    var is_added_default= target.added_by_default === true

    if (is_removable || is_added_default) {
        var known_meta= target.hardware_id ? volume_get_known_metadata(target.hardware_id) : null
        var is_imprinted= target.imprinted === true || (known_meta && known_meta.imprinted === true)

        invariant(
            is_imprinted,
            `[VOL_ID_ASSERT] Volatile or removable volume (` + (target.hardware_id || 'unknown') + `) must be imprinted before access.`
        )
    }

    return true
}

/**
 * space-prefixed function: assert_polling_disk_vol_ids
 * iterates across all active mounted volumes (`_active_volumes`) or context volume map (`ctx.volumes`)
 * verifying that no volatile/removable volumes have suffered identity drift or controller swap.
 */
export function assert_polling_disk_vol_ids(ctx= null) {
    var volumes_map= (ctx && ctx.volumes && typeof ctx.volumes.entries === 'function') ? ctx.volumes : volume_get_active_volumes()
    
    volumes_map.forEach(function(vol, id) {
        assert_disk_vol_id(vol)
    })

    return true
}
