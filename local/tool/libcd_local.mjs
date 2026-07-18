/**
 * local repo runtime launcher and lockdown/gate orchestrator (`libcd_local.mjs`)
 * orchestrates Node.js built-in prototype freezing (`gen_lockdown`), network module disabling (`net_lockdown`),
 * and `+gate` cryptographic PIN verification (`var/gate.secret`) for local development and resident bundle execution.
 *
 * usage:
 *   node local/tool/libcd_local.mjs --lockdown --gate
 *   npm run local -- --lockdown --gate
 */

// 1p
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { createInterface } from 'node:readline'

// 2p
import { arg_parse_cli, arg_get_opt } from '../../src-mjs.dev/lib/arg/libcd_arg.mjs'
import { gen_lockdown_script } from './gen_lockdown_nodejs.mjs'
import {
    gate_load_or_create_secret,
    gate_generate_pin,
    gate_verify_arg_modification,
    gate_is_active,
    LIBCD_GATE_CONFIG
} from '../../src-mjs.dev/lib/runtime/libcd_gate.mjs'

export async function local_run_lockdown_and_gate(options= {}) {
    var opts= options || {}
    var lockdown_active= arg_get_opt(opts, 'lockdown', true) || opts['+lockdown'] === true
    var gate_active= gate_is_active(opts) || arg_get_opt(opts, 'gate', false) === true

    if (lockdown_active) {
        var script_content= gen_lockdown_script(opts)
        var out_path= arg_get_opt(opts, 'out', join(process.cwd(), 'local', 'sh', 'run_resident.cmd'))
        var out_dir= dirname(out_path)
        if (!existsSync(out_dir)) mkdirSync(out_dir, { recursive: true })
        writeFileSync(out_path, script_content, 'utf8')
        process.stdout.write('[LIBCD_LOCAL] Lockdown environment generated (`' + out_path + '`).\n')
        process.stdout.write('  Features: --frozen-intrinsics & network module interception (`libcd_net_lockdown.mjs`).\n')
    }

    if (gate_active) {
        var secret_path= arg_get_opt(opts, 'secret_path', LIBCD_GATE_CONFIG.gate_secret_path) || LIBCD_GATE_CONFIG.gate_secret_path
        var secret= gate_load_or_create_secret(secret_path)
        var current_pin= gate_generate_pin(secret)
        process.stdout.write('[GATE] `+gate` active on local Node.js process runtime bundle.\n')
        process.stdout.write('[GATE] Cryptographic secret stored in `var/gate.secret` (mode 0600).\n')
        process.stdout.write('[GATE] Current Challenge PIN: ' + current_pin + '\n')

        var pin_arg= arg_get_opt(opts, 'pin', arg_get_opt(opts, 'pin-code', null))
        if (pin_arg) {
            gate_verify_arg_modification(Object.assign({ '+gate': true }, opts), String(pin_arg), secret_path)
            process.stdout.write('[GATE] PIN code verified successfully (`--pin ' + pin_arg + '`). Process argument modification authorized.\n')
            return { status: 'authorized', lockdown: lockdown_active, gate: true, timestamp: Date.now() }
        }

        if (process.stdin.isTTY) {
            return new Promise(function(resolve, reject) {
                var rl= createInterface({ input: process.stdin, output: process.stdout })
                rl.question('[GATE] Enter 6-digit PIN code to unlock process argument modification: ', function(answer) {
                    rl.close()
                    try {
                        var ver= gate_verify_arg_modification(Object.assign({ '+gate': true }, opts), answer.trim(), secret_path)
                        process.stdout.write('[GATE] PIN code verified successfully (`' + answer.trim() + '`). Process argument modification authorized.\n')
                        resolve({ status: 'authorized', lockdown: lockdown_active, gate: true, timestamp: Date.now() })
                    } catch (e) {
                        reject(e)
                    }
                })
            })
        } else {
            throw new Error('[GATE] Authorization failure: `+gate` requires `--pin <code_or_totp>` when non-interactive.')
        }
    }

    return { status: 'completed', lockdown: lockdown_active, gate: gate_active, timestamp: Date.now() }
}

if (process.argv[1] && process.argv[1].endsWith('libcd_local.mjs')) {
    var cli_res= arg_parse_cli(process.argv.slice(2))
    local_run_lockdown_and_gate(cli_res.options).then(function(res) {
        process.exit(0)
    }).catch(function(err) {
        process.stderr.write(err.message + '\n')
        process.exit(1)
    })
}
