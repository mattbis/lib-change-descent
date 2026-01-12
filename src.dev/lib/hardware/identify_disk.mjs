import { get_disk_fingerprint } from '../os/win/get_disk_fingerprint.mjs'
import { db } from '../db/sqllite/db.mjs'

/**
 * #noqa 
 * @param {string} volume_path
 */
async function identify_disk(volume_path) {
    const uuid = await get_disk_fingerprint(volume_path) // Platform specific (wmic/lsblk)

    const known_config = db.prepare('SELECT type FROM disk_configs WHERE uuid = ?').get(uuid)

    if (!known_config) {
        const user_type = await prompt_user_for_disk_type(volume_path); 
        db.prepare('INSERT INTO disk_configs (uuid, type) VALUES (?, ?)').run(uuid, user_type)
        return user_type
    }

    return known_config.type
}

