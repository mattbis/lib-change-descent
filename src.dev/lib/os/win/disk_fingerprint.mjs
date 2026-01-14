import { execSync } from 'node:child_process'

/** 
 * #noqa
 * get the unique identifier windows uses via the drive letter, so if the letter changes, the disk is identified correctly
 * 
 * @param {string} drive_letter
 * @returns {string}
 */
export function get_disk_fingerprint(drive_letter) {
    // Returns the Volume Serial Number (e.g., "A2C4-DE55")
    const output= execSync(`wmic volume where "driveletter='${drive_letter}'" get DeviceID, VolumeSerialNumber`).toString()
    
    // TODO(matt): check its valid disk identifier in the windows schema to know the parsing worked properly
    const lines = output.trim().split('\n')
    if (lines.length > 1) {
        const parts= lines[1].trim().split(/\s+/)
        return parts[parts.length - 1]
    }
    
    throw new Error(`Could not fingerprint drive: ${drive_letter}`)
}
