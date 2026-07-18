/**
 * runtime +gate PIN verification and arg modification guard (`libcd_gate.mjs`)
 * secures resident Node.js processes against unauthorized argument modifications or profile changes.
 * stores 256-bit cryptographic secrets inside the `var/` directory (`var/gate.secret`) and enforces
 * time-windowed HMAC/TOTP or static challenge PINs before allowing process arg parsing adjustments.
 *
 * usage:
 *   import { gate_verify_arg_modification, gate_is_active } from './libcd_gate.mjs'
 */

// 1p
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'

// 2p
import { invariant } from '../libcd_invariant.mjs'
import { arg_get_opt } from '../arg/libcd_arg.mjs'

export const LIBCD_GATE_CONFIG= Object.freeze({
    gate_secret_path: join(process.cwd(), 'var', 'gate.secret'),
    totp_step_seconds: 30,
    totp_digits: 6
})

/**
 * space-prefixed function: gate_load_or_create_secret
 * loads or generates a 256-bit cryptographic hex secret stored in `var/gate.secret`
 */
export function gate_load_or_create_secret(secret_path= LIBCD_GATE_CONFIG.gate_secret_path) {
    if (!existsSync(secret_path)) {
        var dir= dirname(secret_path)
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

        var raw_bytes= randomBytes(32)
        var secret_hex= raw_bytes.toString('hex')

        writeFileSync(secret_path, secret_hex, { encoding: 'utf8', mode: 0o600 })
        return secret_hex
    }

    return readFileSync(secret_path, 'utf8').trim()
}

/**
 * space-prefixed function: gate_generate_pin
 * computes 6-digit challenge PIN from secret and current epoch step window
 */
export function gate_generate_pin(secret_hex, offset_steps= 0) {
    var step_sec= LIBCD_GATE_CONFIG.totp_step_seconds
    var counter= Math.floor(Date.now() / (step_sec * 1000)) + offset_steps

    var counter_buf= Buffer.alloc(8)
    var high= Math.floor(counter / 0x100000000)
    var low= counter % 0x100000000
    counter_buf.writeUInt32BE(high, 0)
    counter_buf.writeUInt32BE(low, 4)

    var hmac= createHmac('sha256', Buffer.from(secret_hex, 'hex'))
    hmac.update(counter_buf)
    var digest= hmac.digest()

    var offset= digest[digest.length - 1] & 0x0f
    var binary= ((digest[offset] & 0x7f) << 24) |
                ((digest[offset + 1] & 0xff) << 16) |
                ((digest[offset + 2] & 0xff) << 8) |
                (digest[offset + 3] & 0xff)

    var pin= binary % Math.pow(10, LIBCD_GATE_CONFIG.totp_digits)
    return pin.toString().padStart(LIBCD_GATE_CONFIG.totp_digits, '0')
}

/**
 * space-prefixed function: gate_verify_pin
 * checks input PIN against current and adjacent step windows using constant-time comparison
 */
export function gate_verify_pin(secret_hex, input_pin) {
    if (!input_pin || typeof input_pin !== 'string' || input_pin.trim().length !== LIBCD_GATE_CONFIG.totp_digits) {
        return false
    }

    var input_buf= Buffer.from(input_pin.trim())
    if (input_buf.length !== LIBCD_GATE_CONFIG.totp_digits) return false

    var valid_pins= [
        gate_generate_pin(secret_hex, 0),
        gate_generate_pin(secret_hex, -1),
        gate_generate_pin(secret_hex, 1)
    ]

    var is_valid= false
    var i= 0
    while (i < valid_pins.length) {
        var target_buf= Buffer.from(valid_pins[i])
        if (target_buf.length === input_buf.length && timingSafeEqual(input_buf, target_buf)) {
            is_valid= true
        }
        i= i + 1
    }

    return is_valid
}

/**
 * space-prefixed function: gate_is_active
 * checks whether `+gate` or `--gate` flag is active in target options or profile string
 */
export function gate_is_active(options_or_ctx) {
    if (!options_or_ctx) return false
    if (typeof options_or_ctx === 'string') {
        return options_or_ctx.includes('+gate') || options_or_ctx.includes('--gate')
    }
    if (typeof options_or_ctx === 'object') {
        if (options_or_ctx.gate === true || options_or_ctx['+gate'] === true || options_or_ctx['--gate'] === true) return true
        if (options_or_ctx.profile && typeof options_or_ctx.profile === 'string' && (options_or_ctx.profile.includes('+gate') || options_or_ctx.profile.includes('--gate'))) return true
        if (options_or_ctx.options && gate_is_active(options_or_ctx.options)) return true
    }
    return false
}

/**
 * space-prefixed function: gate_verify_arg_modification
 * guards process modification via argument parsing when `+gate` is active.
 * throws authorization error if valid PIN is not provided.
 */
export function gate_verify_arg_modification(options= {}, input_pin= null, secret_path= LIBCD_GATE_CONFIG.gate_secret_path) {
    var opts= options || {}
    if (!gate_is_active(opts)) {
        return { status: 'unprotected_pass', verified: true }
    }

    var nested= opts.options || {}
    var pin_val= input_pin || arg_get_opt(opts, 'pin', arg_get_opt(nested, 'pin', arg_get_opt(opts, 'pin-code', arg_get_opt(nested, 'pin-code', null))))
    if (!pin_val && typeof opts.pin === 'number') pin_val= String(opts.pin)
    if (!pin_val && typeof nested.pin === 'number') pin_val= String(nested.pin)

    var sec_path= secret_path || arg_get_opt(opts, 'secret_path', arg_get_opt(nested, 'secret_path', LIBCD_GATE_CONFIG.gate_secret_path)) || LIBCD_GATE_CONFIG.gate_secret_path
    var secret= gate_load_or_create_secret(sec_path)

    if (!pin_val) {
        throw new Error('[GATE] Authorization failure: `+gate` is active on this resident process bundle. Provide valid `--pin <6_digit_code>` to modify process arguments.')
    }

    if (!gate_verify_pin(secret, String(pin_val))) {
        throw new Error('[GATE] Authorization failure: Invalid PIN code or expired challenge window for `+gate`.')
    }

    return { status: 'verified', verified: true, timestamp: Date.now() }
}

/**
 * Dual Surface Class Wrapper (`libcd_Gate`):
 * object wrapper delegating to functional `gate_*` primitives.
 */
export class libcd_Gate {
    constructor(options= {}) {
        this.secret_path= arg_get_opt(options, 'secret_path', LIBCD_GATE_CONFIG.gate_secret_path) || LIBCD_GATE_CONFIG.gate_secret_path
    }

    load_or_create_secret() {
        return gate_load_or_create_secret(this.secret_path)
    }

    generate_pin(offset= 0) {
        var sec= this.load_or_create_secret()
        return gate_generate_pin(sec, offset)
    }

    verify_pin(input_pin) {
        var sec= this.load_or_create_secret()
        return gate_verify_pin(sec, input_pin)
    }

    verify_modification(options= {}, input_pin= null) {
        return gate_verify_arg_modification(options, input_pin, this.secret_path)
    }
}
