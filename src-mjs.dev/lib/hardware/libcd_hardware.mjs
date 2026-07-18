/**
 * Consolidated hardware integration, identification, and scheduling module (`libcd_hardware.mjs`).
 * Bridges disk identification, task scheduling across bus boundaries, and active libcd_Volume mounts.
 */

import { disk_fingerprint } from '../os/win/libcd_win.mjs'
import {
    libcd_Volume,
    volume_has_known_id,
    volume_add_known_id,
    volume_add_active,
    volume_remove_active,
    volume_get_active_volumes,
    volume_get_known_ids
} from '../storage/libcd_volume.mjs'

/**
 * #noqa 
 * space-prefixed function: hardware_identify_disk
 * identify disk fingerprint via platform-specific call and register into volume's known unique ids
 * @param {string} volume_path
 * @param {object} options
 */
export async function hardware_identify_disk(volume_path, options = {}) {
    var uuid
    try {
        uuid = disk_fingerprint(volume_path) // Platform specific (wmic/lsblk)
    } catch (err) {
        if (options.fallback_uuid) {
            uuid = options.fallback_uuid
        } else {
            throw err
        }
    }

    var is_known = volume_has_known_id(uuid)
    if (!is_known) {
        var user_type = options.type || 'ssd'
        volume_add_known_id(uuid, { path: volume_path, type: user_type })
        return { uuid: uuid, type: user_type, newly_discovered: true }
    }

    return { uuid: uuid, type: options.type || 'ssd', newly_discovered: false }
}

/**
 * space-prefixed function: hardware_create_disk_scheduler
 * schedules disk tasks avoiding bus contention on HDDs
 */
export async function* hardware_create_disk_scheduler(disk_queue, options = {}) {
    const max_workers = options.max_workers || 4
    const bus_activity = new Map()
    let active_workers = 0

    const waitForSlot = () => new Promise(resolve => setTimeout(resolve, 100))

    while (disk_queue.length > 0 || active_workers > 0) {
        if (active_workers < max_workers) {
            const task_index = disk_queue.findIndex(task => {
                if (task.type === 'HDD' && bus_activity.get(task.bus_id)) {
                    return false
                }
                return true
            })

            if (task_index !== -1) {
                const task = disk_queue.splice(task_index, 1)[0]
                
                active_workers++
                if (task.type === 'HDD') bus_activity.set(task.bus_id, true)

                const release = () => {
                    active_workers--
                    if (task.type === 'HDD') bus_activity.set(task.bus_id, false)
                }

                yield { task, release }
                continue
            }
        }

        await waitForSlot()
    }
}

/**
 * space-prefixed function: hardware_controller_mount_volume
 * identifies hardware disk uuid and mounts/activates a libcd_Volume instance
 * @param {string} volume_path
 * @param {object} options
 */
export async function hardware_controller_mount_volume(volume_path, options = {}) {
    var info = await hardware_identify_disk(volume_path, options)
    var vol_options = Object.assign({}, options, {
        type: info.type,
        identifiers: [info.uuid],
        hardware_id: info.uuid
    })
    var vol = new libcd_Volume(vol_options)
    vol.hardware_id = info.uuid
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
