/**
 * hardware controller module orchestrates disk identification and active libcd_Volume mounts
 * bridges lib/hardware (fingerprint & scheduling) with lib/storage/libcd_volume registries
 */

import { hardware_identify_disk } from './libcd_identify_disk.mjs'
import {
    libcd_Volume,
    volume_add_active,
    volume_remove_active,
    volume_get_active_volumes,
    volume_get_known_ids
} from '../storage/libcd_volume.mjs'

/**
 * space-prefixed function: hardware_controller_mount_volume
 * identifies hardware disk uuid and mounts/activates a libcd_Volume instance
 * @param {string} volume_path
 * @param {object} options
 */
export async function hardware_controller_mount_volume(volume_path, options= {}) {
    var info= await hardware_identify_disk(volume_path, options)
    var vol_options= Object.assign({}, options, {
        type: info.type,
        identifiers: [info.uuid],
        hardware_id: info.uuid
    })
    var vol= new libcd_Volume(vol_options)
    vol.hardware_id= info.uuid
    volume_add_active(vol, info.uuid)
    return vol
}

/**
 * space-prefixed function: hardware_controller_unmount_volume
 * removes a volume from active mounted registry
 */
export function hardware_controller_unmount_volume(volume_id) {
    return volume_remove_active(volume_id)
}

/**
 * space-prefixed function: hardware_controller_get_active_volumes
 * returns map of currently active mounted libcd_Volume instances
 */
export function hardware_controller_get_active_volumes() {
    return volume_get_active_volumes()
}

/**
 * space-prefixed function: hardware_controller_get_known_ids
 * returns map of all discovered/known volume unique hardware ids
 */
export function hardware_controller_get_known_ids() {
    return volume_get_known_ids()
}
