import { execSync } from 'node:child_process'
// #noqa
/** 
 * @param {string} drive_letter
 * @returns {string}
 */
export function get_disk_fingerprint(drive_letter) {
    // Returns the Volume Serial Number (e.g., "A2C4-DE55")
    const output = execSync(`wmic volume where "driveletter='${drive_letter}'" get DeviceID, VolumeSerialNumber`).toString()
    const lines = output.trim().split('\n')
    if (lines.length > 1) {
        const parts = lines[1].trim().split(/\s+/)
        return parts[parts.length - 1]
    }
    throw new Error(`Could not fingerprint drive: ${drive_letter}`)
}
