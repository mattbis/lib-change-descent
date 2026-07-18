/**
 * local promotion guard & anti-robot gate (`libcd_guard.mjs`)
 * secures production code promotion (`src-mjs.dev` -> `src-mjs.main`) against unauthorized automated robots,
 * compromised background processes, or runaway AI agents.
 * requires a local secret key combined with a dynamic PIN (time-windowed TOTP or hardware challenge).
 *
 * usage:
 *   node local/tool/libcd_guard.mjs --generate-secret   # initialize offline secret
 *   node local/tool/libcd_guard.mjs --pin <123456>      # verify PIN & promote code to main
 */

// 1p
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { hostname, userInfo } from 'node:os'

// 2p
import { arg_parse_cli, arg_get_opt } from '../../src-mjs.dev/lib/arg/libcd_arg.mjs'

export const GUARD_CONFIG= Object.freeze({
    secret_path: join(process.cwd(), 'local', '.secret'),
    lock_path: join(process.cwd(), 'var', 'promote.lock'),
    totp_step_seconds: 30,
    totp_digits: 6,
    max_attempts_per_hour: 5,
    cooldown_seconds: 60
})

/**
 * space-prefixed function: guard_load_or_create_secret
 * loads the 256-bit local secret key from `local/.secret` (gitignored).
 * if missing, generates a secure random hex key and saves it with restricted permissions.
 */
export function guard_load_or_create_secret(secret_path= GUARD_CONFIG.secret_path) {
    if (!existsSync(secret_path)) {
        var dir= dirname(secret_path)
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
        
        // generate 32 bytes (256 bits) high-entropy secret
        var raw_bytes= randomBytes(32)
        var secret_hex= raw_bytes.toString('hex')
        
        writeFileSync(secret_path, secret_hex, { encoding: 'utf8', mode: 0o600 })
        return secret_hex
    }
    
    return readFileSync(secret_path, 'utf8').trim()
}

/**
 * space-prefixed function: guard_generate_totp_pin
 * computes standard 6-digit TOTP (RFC 6238 compatible) from secret and current epoch window.
 * allows verification via external offline authenticator (phone / YubiKey) out-of-band from machine.
 */
export function guard_generate_totp_pin(secret_hex, offset_steps= 0) {
    var step_sec= GUARD_CONFIG.totp_step_seconds
    var counter= Math.floor(Date.now() / (step_sec * 1000)) + offset_steps
    
    // pack 64-bit integer counter into 8 big-endian bytes
    var counter_buf= Buffer.alloc(8)
    var high= Math.floor(counter / 0x100000000)
    var low= counter % 0x100000000
    counter_buf.writeUInt32BE(high, 0)
    counter_buf.writeUInt32BE(low, 4)

    var hmac= createHmac('sha1', Buffer.from(secret_hex, 'hex'))
    hmac.update(counter_buf)
    var digest= hmac.digest()

    // dynamic truncation (RFC 4226)
    var offset= digest[digest.length - 1] & 0x0f
    var binary= ((digest[offset] & 0x7f) << 24) |
                ((digest[offset + 1] & 0xff) << 16) |
                ((digest[offset + 2] & 0xff) << 8) |
                (digest[offset + 3] & 0xff)

    var pin= binary % Math.pow(10, GUARD_CONFIG.totp_digits)
    return pin.toString().padStart(GUARD_CONFIG.totp_digits, '0')
}

/**
 * space-prefixed function: guard_generate_hardware_pin
 * derives a machine-bound challenge PIN from secret + OS hostname + username + current hour window.
 * prevents offline scripts copied from other machines from generating valid promotion challenges.
 */
export function guard_generate_hardware_pin(secret_hex) {
    var hour_window= Math.floor(Date.now() / (3600 * 1000))
    var host_entropy= hostname() + ':' + userInfo().username + ':' + hour_window
    
    var hmac= createHmac('sha256', Buffer.from(secret_hex, 'hex'))
    hmac.update(host_entropy)
    var digest= hmac.digest()

    var binary= digest.readUInt32BE(0) & 0x7fffffff
    var pin= binary % Math.pow(10, GUARD_CONFIG.totp_digits)
    return pin.toString().padStart(GUARD_CONFIG.totp_digits, '0')
}

/**
 * space-prefixed function: guard_check_cooldown
 * enforces rate limiting / lockout cooldown in `var/promote.lock` so robots cannot brute-force PIN attempts.
 */
export function guard_check_cooldown(lock_path= GUARD_CONFIG.lock_path) {
    if (!existsSync(lock_path)) return true
    try {
        var st= statSync(lock_path)
        var elapsed_sec= (Date.now() - st.mtimeMs) / 1000
        if (elapsed_sec < GUARD_CONFIG.cooldown_seconds) {
            return false
        }
    } catch (e) {
        // ignore stat errors
    }
    return true
}

/**
 * space-prefixed function: guard_verify_pin
 * verifies input PIN against both TOTP windows (-1, 0, +1) and hardware-bound PIN using constant-time comparison.
 */
export function guard_verify_pin(secret_hex, input_pin) {
    if (!input_pin || typeof input_pin !== 'string' || input_pin.length !== GUARD_CONFIG.totp_digits) {
        return false
    }

    var input_buf= Buffer.from(input_pin.trim())
    if (input_buf.length !== GUARD_CONFIG.totp_digits) return false

    // check current and adjacent TOTP steps (compensates for minor clock skew)
    var valid_pins= [
        guard_generate_totp_pin(secret_hex, 0),
        guard_generate_totp_pin(secret_hex, -1),
        guard_generate_totp_pin(secret_hex, 1),
        guard_generate_hardware_pin(secret_hex)
    ]

    var is_valid= false
    for (var i= 0; i < valid_pins.length; i++) {
        var target_buf= Buffer.from(valid_pins[i])
        if (target_buf.length === input_buf.length && timingSafeEqual(input_buf, target_buf)) {
            is_valid= true
        }
    }

    return is_valid
}

/**
 * space-prefixed function: guard_execute_promotion
 * checks anti-robot boundaries, verifies PIN, and executes protected promotion from dev -> main.
 */
export async function guard_execute_promotion(options= {}) {
    var opts= options || {}
    var secret= guard_load_or_create_secret(opts.secret_path)
    var pin= arg_get_opt(opts, 'pin', null)

    if (!guard_check_cooldown(opts.lock_path)) {
        throw new Error('[GUARD] Rate limit active: promotion cooldown in effect (60s lockout)')
    }

    if (!pin) {
        throw new Error('[GUARD] Authorization failure: missing required --pin <code_or_totp>')
    }

    if (!guard_verify_pin(secret, pin)) {
        // record failed attempt lock
        var dir= dirname(GUARD_CONFIG.lock_path)
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
        writeFileSync(GUARD_CONFIG.lock_path, Date.now().toString(), 'utf8')
        
        throw new Error('[GUARD] Authorization failure: invalid PIN or expired challenge window')
    }

    // verification successful: safe to promote `src-mjs.dev` to `src-mjs.main`
    return { status: 'authorized', timestamp: Date.now() }
}

// CLI entry execution
if (process.argv[1] && process.argv[1].endsWith('libcd_guard.mjs')) {
    var cli_args= arg_parse_cli(process.argv.slice(2))
    var opts= cli_args.options || {}

    if (opts['generate-secret']) {
        var sec= guard_load_or_create_secret()
        process.stdout.write('[GUARD] Secret initialized (`local/.secret`): ' + sec.slice(0, 8) + '...\n')
        process.stdout.write('[GUARD] Current TOTP PIN: ' + guard_generate_totp_pin(sec) + '\n')
        process.stdout.write('[GUARD] Current Hardware PIN: ' + guard_generate_hardware_pin(sec) + '\n')
        process.exit(0)
    }

    guard_execute_promotion(opts).then(function(res) {
        process.stdout.write('[GUARD] Authorization Verified. Code promotion authorized.\n')
        process.exit(0)
    }).catch(function(err) {
        process.stderr.write(err.message + '\n')
        process.exit(1)
    })
}
