/**
 * Windows process identification & dynamic firewall network isolation (`libcd_win_isolate.mjs`).
 * 
 * identifies the running Node.js executable path (`process.execPath`) and applies dynamic
 * Windows Filtering Platform (`WFP` via `netsh advfirewall`) rules to block all inbound and outbound
 * network traffic for this specific binary path (`program=...`), creating ring-0 network isolation.
 * 
 * to prevent accidentally blocking system-wide `node.exe` when running from `C:\Program Files\nodejs\node.exe`,
 * `win_get_node_process_path` can automatically copy `node.exe` to a private dedicated path
 * (`var/build/node_libcd_isolated.exe`) before applying the firewall block rule.
 */

// 1p
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

// 2p
import { arg_get_opt } from '../../arg/libcd_arg.mjs'
import { win_is_administrator } from './libcd_administrator.mjs'
import { os_exec_sync } from '../libcd_os_executor.mjs'
import { post } from '../../internal/imut_log/libcd_imut_log.mjs'
import { make_entry } from '../../internal/imut_log/libcd_imut_log_entry.mjs'

const DEFAULT_RULE_PREFIX= 'LIBCD_RESIDENT_ISOLATION_'

/**
 * identifies and resolves the executable binary path to isolate (`process.execPath`).
 * if `copy_dedicated` is true and running from global node, copies `node.exe` to a dedicated path.
 */
export function win_get_node_process_path(options= {}) {
    var exec_path= process.execPath
    var copy_dedicated= arg_get_opt(options, 'copy_dedicated', false)
    var target_path= arg_get_opt(options, 'target_binary', null)

    if (target_path) {
        return resolve(target_path)
    }

    if (copy_dedicated && !exec_path.toLowerCase().includes('node_libcd_isolated')) {
        var isolated_path= resolve(arg_get_opt(options, 'isolated_path', 'var/build/node_libcd_isolated.exe'))
        var dir= dirname(isolated_path)
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true })
        }
        if (!existsSync(isolated_path)) {
            copyFileSync(exec_path, isolated_path)
            post(make_entry('OS_CALL', 'WIN_ISOLATE_COPY_BINARY', { source: exec_path, target: isolated_path }))
        }
        return isolated_path
    }

    return exec_path
}

/**
 * checks if a specific Windows Firewall rule name currently exists in WFP.
 */
export function win_check_firewall_rule(rule_name) {
    if (process.platform !== 'win32') return false
    var res= os_exec_sync('netsh', ['advfirewall', 'firewall', 'show', 'rule', 'name=' + rule_name], { reject: false })
    return res.exitCode === 0 && (res.stdout || '').includes(rule_name)
}

/**
 * adds outbound and inbound Windows Firewall rules locking down the specified binary path.
 * requires elevated Administrator privileges (`win_is_administrator()`).
 */
export function win_add_firewall_rules(options= {}) {
    if (!win_is_administrator()) {
        throw new Error('[WIN_ISOLATE] Administrator privileges required to add Windows Firewall rules via netsh.')
    }

    var target_exe= win_get_node_process_path(options)
    var rule_prefix= arg_get_opt(options, 'rule_prefix', DEFAULT_RULE_PREFIX)
    var rule_out= rule_prefix + 'OUT'
    var rule_in= rule_prefix + 'IN'

    // remove existing rules if present so we can update cleanly
    win_remove_firewall_rules(options)

    var res_out= os_exec_sync('netsh', [
        'advfirewall', 'firewall', 'add', 'rule',
        'name=' + rule_out,
        'dir=out',
        'action=block',
        'program=' + target_exe,
        'enable=yes',
        'profile=any'
    ], { reject: false })

    if (res_out.failed) {
        throw new Error('[WIN_ISOLATE] Failed to add outbound WFP rule: ' + (res_out.stderr || res_out.stdout))
    }

    var res_in= os_exec_sync('netsh', [
        'advfirewall', 'firewall', 'add', 'rule',
        'name=' + rule_in,
        'dir=in',
        'action=block',
        'program=' + target_exe,
        'enable=yes',
        'profile=any'
    ], { reject: false })

    if (res_in.failed) {
        throw new Error('[WIN_ISOLATE] Failed to add inbound WFP rule: ' + (res_in.stderr || res_in.stdout))
    }

    post(make_entry('OS_CALL', 'WIN_FIREWALL_ISOLATE_APPLIED', { target: target_exe, rule_out, rule_in }))
    return { success: true, target_exe, rule_out, rule_in }
}

/**
 * removes the outbound and inbound Windows Firewall isolation rules.
 */
export function win_remove_firewall_rules(options= {}) {
    if (!win_is_administrator()) {
        throw new Error('[WIN_ISOLATE] Administrator privileges required to delete Windows Firewall rules via netsh.')
    }

    var rule_prefix= arg_get_opt(options, 'rule_prefix', DEFAULT_RULE_PREFIX)
    var rule_out= rule_prefix + 'OUT'
    var rule_in= rule_prefix + 'IN'

    os_exec_sync('netsh', ['advfirewall', 'firewall', 'delete', 'rule', 'name=' + rule_out], { reject: false })
    os_exec_sync('netsh', ['advfirewall', 'firewall', 'delete', 'rule', 'name=' + rule_in], { reject: false })

    post(make_entry('OS_CALL', 'WIN_FIREWALL_ISOLATE_REMOVED', { rule_out, rule_in }))
    return { success: true, rule_out, rule_in }
}

/**
 * inspects status and verifies whether the current or specified process path is isolated.
 */
export function win_get_isolation_status(options= {}) {
    var target_exe= win_get_node_process_path(options)
    var rule_prefix= arg_get_opt(options, 'rule_prefix', DEFAULT_RULE_PREFIX)
    var rule_out= rule_prefix + 'OUT'
    var rule_in= rule_prefix + 'IN'

    var out_active= win_check_firewall_rule(rule_out)
    var in_active= win_check_firewall_rule(rule_in)

    return {
        is_administrator: win_is_administrator(),
        target_exe: target_exe,
        outbound_blocked: out_active,
        inbound_blocked: in_active,
        isolated: out_active && in_active
    }
}
