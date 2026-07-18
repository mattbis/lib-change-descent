/**
 * CLI tool (`libcd_firewall_isolate.mjs`) to inspect, isolate, or remove Windows Filtering Platform (`WFP`)
 * network isolation rules targeting the running Node.js process binary.
 * 
 * usage:
 *   node local/tool/libcd_firewall_isolate.mjs --status
 *   node local/tool/libcd_firewall_isolate.mjs --action isolate --copy-dedicated
 *   node local/tool/libcd_firewall_isolate.mjs --action remove
 */

// 1p
import process from 'node:process'

// 2p
import { arg_parse_cli, arg_get_opt } from '../../src-mjs.dev/lib/arg/libcd_arg.mjs'
import {
    win_get_isolation_status,
    win_add_firewall_rules,
    win_remove_firewall_rules
} from '../../src-mjs.dev/lib/os/win/libcd_win.mjs'

var cli= arg_parse_cli(process.argv.slice(2))
var opts= cli.options || {}
var action= arg_get_opt(opts, 'action', arg_get_opt(opts, 'status', false) ? 'status' : 'status')

if (action === 'isolate') {
    try {
        var res= win_add_firewall_rules({
            copy_dedicated: arg_get_opt(opts, 'copy-dedicated', false),
            target_binary: arg_get_opt(opts, 'binary', null)
        })
        process.stdout.write('[FIREWALL_ISOLATE] Successfully isolated binary path: ' + res.target_exe + '\n')
        process.stdout.write('  Outbound Rule: ' + res.rule_out + '\n  Inbound Rule:  ' + res.rule_in + '\n')
    } catch (e) {
        process.stderr.write('[FIREWALL_ISOLATE_ERROR] ' + (e && e.message ? e.message : e) + '\n')
        process.exit(1)
    }
} else if (action === 'remove') {
    try {
        var res= win_remove_firewall_rules(opts)
        process.stdout.write('[FIREWALL_ISOLATE] Successfully removed isolation rules (' + res.rule_out + ', ' + res.rule_in + ').\n')
    } catch (e) {
        process.stderr.write('[FIREWALL_ISOLATE_ERROR] ' + (e && e.message ? e.message : e) + '\n')
        process.exit(1)
    }
} else {
    // status
    var status= win_get_isolation_status({
        copy_dedicated: arg_get_opt(opts, 'copy-dedicated', false),
        target_binary: arg_get_opt(opts, 'binary', null)
    })
    process.stdout.write('[FIREWALL_ISOLATE STATUS]\n')
    process.stdout.write('  Platform:         ' + process.platform + '\n')
    process.stdout.write('  Is Administrator: ' + (status.is_administrator ? 'Yes' : 'No') + '\n')
    process.stdout.write('  Target Binary:    ' + status.target_exe + '\n')
    process.stdout.write('  Outbound Blocked: ' + (status.outbound_blocked ? 'YES' : 'NO') + '\n')
    process.stdout.write('  Inbound Blocked:  ' + (status.inbound_blocked ? 'YES' : 'NO') + '\n')
    process.stdout.write('  Fully Isolated:   ' + (status.isolated ? 'ACTIVE' : 'INACTIVE') + '\n')
}
