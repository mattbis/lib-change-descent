import { disk_fingerprint } from '../os/win/libcd_disk_fingerprint.mjs'
import { volume_has_known_id, volume_add_known_id } from '../storage/libcd_volume.mjs'

/**
 * #noqa 
 * space-prefixed function: hardware_identify_disk
 * identify disk fingerprint via platform-specific call and register into volume's known unique ids
 * @param {string} volume_path
 * @param {object} options
 */
export async function hardware_identify_disk(volume_path, options= {}) {
    var uuid
    try {
        uuid= disk_fingerprint(volume_path) // Platform specific (wmic/lsblk)
    } catch (err) {
        if (options.fallback_uuid) {
            uuid= options.fallback_uuid
        } else {
            throw err
        }
    }

    var is_known= volume_has_known_id(uuid)
    if (!is_known) {
        var user_type= options.type || 'ssd'
        volume_add_known_id(uuid, { path: volume_path, type: user_type })
        return { uuid: uuid, type: user_type, newly_discovered: true }
    }

    return { uuid: uuid, type: options.type || 'ssd', newly_discovered: false }
}
