/**
 * os/libcd_os__manifest.mjs
 * 
 * OS manifestation layer. Marries OS execution environment to `host_fingerprint()`
 * (`libcd_host.mjs`). Since an OS manifestation occurs via a host, this computes and
 * records the combined host + OS execution fingerprint and posts it to the immutable
 * manifest log (`imut_log`).
 */

import { host_fingerprint } from '../host/libcd_host.mjs'
import { post } from '../internal/imut_log/libcd_imut_log.mjs'
import { make_entry } from '../internal/imut_log/libcd_imut_log_entry.mjs'
import { descenthash_fract, descenthash_k1, descenthash_k2, descenthash_k3 } from '../internal/hash/libcd_descent_hash.mjs'

/**
 * space-prefixed function: os_manifest_fingerprint
 * Captures the full host + OS manifestation fingerprint and calculates a float hash
 * representing the combined runtime/OS execution state.
 * 
 * @returns {{ host: Object, os_details: Object, os_manifest_hash: number }}
 */
export function os_manifest_fingerprint() {
    // 1. Gather host fingerprint (`runtime`, `version`, `platform`, `arch`, `pid`)
    const host = host_fingerprint()

    // 2. Gather OS manifestation specifics
    const os_details = {
        cwd: typeof process !== 'undefined' && process.cwd ? process.cwd() : 'unknown',
        uid: typeof process !== 'undefined' && process.getuid ? process.getuid() : -1,
        gid: typeof process !== 'undefined' && process.getgid ? process.getgid() : -1,
        timestamp: Date.now()
    }

    // 3. Compute combined zero-GC float representation / hash using descent_hash constants
    const h_host = descenthash_fract((host.pid > 0 ? host.pid : 1) * descenthash_k1)
    const h_os = descenthash_fract((os_details.uid >= 0 ? os_details.uid + 1 : 2) * descenthash_k2)
    const h_time = descenthash_fract((os_details.timestamp % 1000000) * descenthash_k3)
    const os_manifest_hash = descenthash_fract(h_host + h_os + h_time)

    const payload = {
        host,
        os_details,
        os_manifest_hash
    }

    // 4. Post to immutable log
    post(make_entry('OS_MANIFEST', 'OS_FINGERPRINT', payload))

    return payload
}
