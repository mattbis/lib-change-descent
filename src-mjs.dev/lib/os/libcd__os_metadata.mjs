/**
 * OS & Host metadata cross-check and security registry (`libcd__os_metadata.mjs`).
 * 
 * records and verifies the operating system, host machine identity, user context, and binary path
 * every time the engine interacts with active or known volumes.
 * 
 * CRITICAL AIMS (per specification):
 * 1. Records when you run the same code for volumes known across another operating system and details
 *    exactly what changed (`platform`, `release`, `hostname`, `exec_path`) via `OS_METADATA_VOLUME_OS_CHANGE`.
 * 2. Provides immediate detection and audit alerts (`OS_METADATA_UNKNOWN_HOST_DETECTED`) if an unknown,
 *    uninstalled host machine, user account, or unauthorized binary path attempts to execute code on your system.
 * 
 * every inspection or change is logged directly to the immutable manifest log (`IMUT_LOG`).
 */

// 1p
import os from 'node:os'
import process from 'node:process'

// 2p
import { arg_get_opt } from '../arg/libcd_arg.mjs'
import { volume_get_known_ids, volume_get_active_volumes } from '../storage/libcd_volume.mjs'
import { post } from '../internal/imut_log/libcd_imut_log.mjs'
import { make_entry } from '../internal/imut_log/libcd_imut_log_entry.mjs'

var _os_metadata_registry = {
    known_hosts: new Map(),
    volume_access_history: new Map()
}

/**
 * collects current operating system, host machine identity, and process binary info (`1p`).
 */
export function os_metadata_collect() {
    var user_name= 'unknown'
    try {
        var info= os.userInfo()
        if (info && info.username) user_name= info.username
    } catch (e) {}

    return {
        hostname: os.hostname(),
        platform: process.platform,
        release: os.release(),
        arch: process.arch,
        user: user_name,
        exec_path: process.execPath,
        node_version: process.version,
        cwd: process.cwd(),
        timestamp: Date.now()
    }
}

/**
 * generates a deterministic host/user identity key (`hostname|platform|arch|user|exec_path`).
 */
export function os_metadata_get_host_key(meta= null) {
    if (!meta) meta= os_metadata_collect()
    return meta.hostname + '|' + meta.platform + '|' + meta.arch + '|' + meta.user + '|' + meta.exec_path
}

/**
 * manually registers a known/trusted host baseline into the security registry.
 */
export function os_metadata_register_trusted_host(meta_or_options= {}) {
    var meta= meta_or_options.hostname ? meta_or_options : os_metadata_collect()
    var host_key= os_metadata_get_host_key(meta)
    
    var record= _os_metadata_registry.known_hosts.get(host_key)
    if (!record) {
        record= {
            host_key: host_key,
            hostname: meta.hostname,
            platform: meta.platform,
            release: meta.release,
            arch: meta.arch,
            user: meta.user,
            exec_path: meta.exec_path,
            first_seen_ts: meta.timestamp || Date.now(),
            last_seen_ts: meta.timestamp || Date.now(),
            volume_ids: new Set()
        }
        _os_metadata_registry.known_hosts.set(host_key, record)
    } else {
        record.last_seen_ts= meta.timestamp || Date.now()
    }
    return record
}

/**
 * clears the in-memory cross-OS and unknown host audit registry.
 */
export function os_metadata_reset() {
    _os_metadata_registry.known_hosts.clear()
    _os_metadata_registry.volume_access_history.clear()
}

/**
 * inspects a specific volume's cross-OS execution history.
 */
export function os_metadata_inspect_volume(volume_id) {
    var hist= _os_metadata_registry.volume_access_history.get(volume_id)
    if (!hist) return null
    return {
        volume_id: volume_id,
        last_platform: hist.last_platform,
        last_hostname: hist.last_hostname,
        last_exec_path: hist.last_exec_path,
        last_ts: hist.last_ts,
        os_history: hist.os_history.slice()
    }
}

/**
 * runs full cross-OS volume comparisons and checks against unauthorized/unknown host environments.
 * posts audit events to `IMUT_LOG` (`OS_METADATA_BOOT`, `OS_METADATA_VOLUME_OS_CHANGE`, `OS_METADATA_UNKNOWN_HOST_DETECTED`).
 */
export function os_metadata_check_environment(options= {}) {
    var current_meta= os_metadata_collect()
    var host_key= os_metadata_get_host_key(current_meta)
    var is_known_host= _os_metadata_registry.known_hosts.has(host_key)
    var unknown_alert_logged= false

    // 1. Check if this host machine, user, and binary path are known/trusted
    if (!is_known_host) {
        var is_first_ever_host= _os_metadata_registry.known_hosts.size === 0
        if (!is_first_ever_host || arg_get_opt(options, 'strict_uninstalled_check', false)) {
            post(make_entry('OS_CALL', 'OS_METADATA_UNKNOWN_HOST_DETECTED', {
                host_key: host_key,
                hostname: current_meta.hostname,
                platform: current_meta.platform,
                user: current_meta.user,
                exec_path: current_meta.exec_path,
                reason: 'Execution detected from uninstalled/unknown host machine, user account, or binary path'
            }))
            unknown_alert_logged= true
        }
        os_metadata_register_trusted_host(current_meta)
    } else {
        var host_rec= _os_metadata_registry.known_hosts.get(host_key)
        host_rec.last_seen_ts= current_meta.timestamp
    }

    // 2. Cross-check across all known and active volumes to see what changed across operating systems
    var known_volume_ids= volume_get_known_ids()
    var active_volumes_map= volume_get_active_volumes()
    var active_ids= Array.from(active_volumes_map.keys())
    var all_volume_ids= new Set(known_volume_ids)
    for (var i= 0; i < active_ids.length; i++) {
        all_volume_ids.add(active_ids[i])
    }

    var cross_os_changes= []
    for (var vol_id of all_volume_ids) {
        var hist= _os_metadata_registry.volume_access_history.get(vol_id)
        if (!hist) {
            hist= {
                last_platform: current_meta.platform,
                last_hostname: current_meta.hostname,
                last_exec_path: current_meta.exec_path,
                last_ts: current_meta.timestamp,
                os_history: [{ platform: current_meta.platform, hostname: current_meta.hostname, release: current_meta.release, ts: current_meta.timestamp }]
            }
            _os_metadata_registry.volume_access_history.set(vol_id, hist)
        } else {
            // check if volume is now running on a different operating system or host machine
            var changed_fields= []
            if (hist.last_platform !== current_meta.platform) changed_fields.push('platform (' + hist.last_platform + ' -> ' + current_meta.platform + ')')
            if (hist.last_hostname !== current_meta.hostname) changed_fields.push('hostname (' + hist.last_hostname + ' -> ' + current_meta.hostname + ')')
            if (hist.last_exec_path !== current_meta.exec_path) changed_fields.push('exec_path (' + hist.last_exec_path + ' -> ' + current_meta.exec_path + ')')

            if (changed_fields.length > 0) {
                var change_report= {
                    volume_id: vol_id,
                    previous_platform: hist.last_platform,
                    previous_hostname: hist.last_hostname,
                    current_platform: current_meta.platform,
                    current_hostname: current_meta.hostname,
                    changes: changed_fields
                }
                cross_os_changes.push(change_report)
                post(make_entry('OS_CALL', 'OS_METADATA_VOLUME_OS_CHANGE', change_report))

                hist.last_platform= current_meta.platform
                hist.last_hostname= current_meta.hostname
                hist.last_exec_path= current_meta.exec_path
                hist.last_ts= current_meta.timestamp
                hist.os_history.push({ platform: current_meta.platform, hostname: current_meta.hostname, release: current_meta.release, ts: current_meta.timestamp })
            }
        }

        var host_entry= _os_metadata_registry.known_hosts.get(host_key)
        if (host_entry) host_entry.volume_ids.add(vol_id)
    }

    post(make_entry('OS_CALL', 'OS_METADATA_BOOT', {
        host_key: host_key,
        platform: current_meta.platform,
        hostname: current_meta.hostname,
        known_volumes_checked: all_volume_ids.size,
        cross_os_changes_count: cross_os_changes.length,
        unknown_host_detected: unknown_alert_logged
    }))

    return {
        os_identity: current_meta,
        host_key: host_key,
        is_known_host: is_known_host,
        unknown_host_detected: unknown_alert_logged,
        cross_os_changes: cross_os_changes,
        checked_volumes: Array.from(all_volume_ids)
    }
}
