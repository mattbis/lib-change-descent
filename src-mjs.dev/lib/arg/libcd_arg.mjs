// 1p
import { timingSafeEqual } from "node:crypto"

// 2p
import { invariant } from "../libcd_invariant.mjs"

/**
 * fast zero-gc slice comparator over uint8array views
 * short-circuits on first byte mismatch (===)
 * ideal for hot-path ipc, protocol operations, and public commands
 */
export function arg_slice_compare_fast(buf_a, offset_a, buf_b, offset_b, len= 0) {
    var i= 0
    while (i < len) {
        if (buf_a[offset_a + i] !== buf_b[offset_b + i]) {
            return false
        }
        i= i + 1
    }
    return true
}

/**
 * safe constant-time slice comparator over uint8array views without short-circuiting
 * prevents timing side-channel attacks when comparing verification hashes or secret tokens
 * operates strictly in uint8 [0..255] bounds using bitwise xor to avoid 32-bit v8 coercion quirks
 */
export function arg_slice_compare_secure_raw(buf_a, offset_a, buf_b, offset_b, len= 0) {
    var diff= 0
    var i= 0
    while (i < len) {
        diff= diff | (buf_a[offset_a + i] ^ buf_b[offset_b + i])
        i= i + 1
    }
    return diff === 0
}

/**
 * secure constant-time comparator across full uint8array instances using node 1p crypto
 */
export function arg_slice_compare_secure(buf_a, buf_b) {
    if (!buf_a || !buf_b || buf_a.length !== buf_b.length) {
        return false
    }
    return timingSafeEqual(buf_a, buf_b)
}

/**
 * checks if a binary view matches expected header magic bytes using fast zero-gc comparator
 */
export function arg_parse_binary_header(u8_view, offset= 0, magic_bytes= null) {
    if (!u8_view || !magic_bytes || u8_view.length < offset + magic_bytes.length) {
        return false
    }
    return arg_slice_compare_fast(u8_view, offset, magic_bytes, 0, magic_bytes.length)
}

/**
 * safely extracts a property from an options object without traversing the prototype chain.
 * prevents prototype pollution attacks (__proto__, Object.prototype) in resident processes.
 */
export function arg_get_opt(opts, key, default_val= null) {
    if (!opts || (typeof opts !== "object" && typeof opts !== "function")) return default_val
    return Object.hasOwn(opts, key) ? (opts[key] !== undefined ? opts[key] : default_val) : default_val
}

/**
 * space-prefixed function: arg_parse_profile
 * parses execution profiles and opposite profile modifiers (`+bg`, `-bg`, `+fg`, `-fg`, `+start`, `-start`, `+resident`, `-resident`, `-nolimits`)
 * and attaches time mask configuration (`default 3 years 0x10`)
 */
export function arg_parse_profile(profile_arg= '+bg', options= {}) {
    var profile_str= ''
    var parsed_opts= Object.create(null)
    if (options && typeof options === 'object') {
        Object.assign(parsed_opts, options)
    }

    if (typeof profile_arg === 'string') {
        profile_str= profile_arg
        var tokens= profile_arg.split(/\s+/)
        var i= 0
        while (i < tokens.length) {
            var tok= tokens[i]
            if (tok.startsWith('+') && tok.length > 1) {
                parsed_opts[tok]= true
                parsed_opts[tok.slice(1)]= true
            } else if (tok.startsWith('-') && tok.length > 1 && !tok.startsWith('--')) {
                parsed_opts[tok]= true
                parsed_opts[tok.slice(1)]= false
            }
            i= i + 1
        }
    } else if (Array.isArray(profile_arg)) {
        profile_str= profile_arg.join(' ')
        var i= 0
        while (i < profile_arg.length) {
            var tok= profile_arg[i]
            if (typeof tok === 'string') {
                if (tok.startsWith('+') && tok.length > 1) {
                    parsed_opts[tok]= true
                    parsed_opts[tok.slice(1)]= true
                } else if (tok.startsWith('-') && tok.length > 1 && !tok.startsWith('--')) {
                    parsed_opts[tok]= true
                    parsed_opts[tok.slice(1)]= false
                }
            }
            i= i + 1
        }
    } else if (profile_arg && typeof profile_arg === 'object') {
        Object.assign(parsed_opts, profile_arg)
        profile_str= parsed_opts.profile || '+bg'
    } else {
        profile_str= '+bg'
    }

    var time_mask= arg_get_opt(options, 'time_mask', arg_get_opt(parsed_opts, 'time_mask', 0x10)) || 0x10

    // Resolve profile modifier states and opposites (`-bg opposite -> bg false; -fg opposite -> fg false; -start opposite -> start false`)
    var bg= arg_get_opt(parsed_opts, 'bg', true)
    if (parsed_opts['-bg'] === true) bg= false
    else if (parsed_opts['+bg'] === true || profile_str.includes('+bg')) bg= true

    var fg= arg_get_opt(parsed_opts, 'fg', false)
    if (parsed_opts['-fg'] === true) fg= false
    else if (parsed_opts['+fg'] === true || profile_str.includes('+fg')) fg= true

    var resident= arg_get_opt(parsed_opts, 'resident', false)
    if (parsed_opts['-resident'] === true) resident= false
    else if (parsed_opts['+resident'] === true || profile_str.includes('+resident')) resident= true

    var start= arg_get_opt(parsed_opts, 'start', null)
    if (parsed_opts['-start'] === true || profile_str.includes('-start')) start= false
    else if (parsed_opts['+start'] === true || profile_str.includes('+start')) start= true

    var nolimits= arg_get_opt(parsed_opts, 'nolimits', false)
    if (parsed_opts['-nolimits'] === true || parsed_opts['+nolimits'] === true || profile_str.includes('-nolimits') || profile_str.includes('+nolimits')) {
        nolimits= true
    }

    var gate= arg_get_opt(parsed_opts, 'gate', false) || parsed_opts['+gate'] === true || parsed_opts['--gate'] === true || profile_str.includes('+gate') || profile_str.includes('--gate')
    if (gate) {
        parsed_opts.gate= true
        parsed_opts['+gate']= true
    }

    var yield_ms= 10
    if (nolimits) {
        yield_ms= 0
    } else if (fg === true || bg === false) {
        yield_ms= 1
    } else if (bg === true || fg === false) {
        yield_ms= 10
    }

    return Object.assign(Object.create(null), {
        profile: profile_str,
        time_mask: time_mask,
        periodic_maintenance: true,
        bg: bg,
        fg: fg,
        resident: resident,
        start: start,
        nolimits: nolimits,
        gate: gate,
        yield_ms: yield_ms,
        options: parsed_opts
    })
}

/**
 * parse standard cli arguments (process.argv slice) into options, profiles, and positional args
 * returns null-prototype dictionary (`Object.create(null)`) immune to `__proto__` injection
 */
export function arg_parse_cli(args= []) {
    var options= Object.create(null)
    var positionals= []
    var profiles= []
    var i= 0
    while (i < args.length) {
        var arg= args[i]
        if (arg.startsWith("--")) {
            var eq_idx= arg.indexOf("=")
            if (eq_idx !== -1) {
                var key= arg.slice(2, eq_idx)
                var val= arg.slice(eq_idx + 1)
                options[key]= val
            } else {
                var key= arg.slice(2)
                if (i + 1 < args.length && !args[i + 1].startsWith("-") && !args[i + 1].startsWith("+")) {
                    options[key]= args[i + 1]
                    i= i + 1
                } else {
                    options[key]= true
                }
            }
        } else if (arg.startsWith("+") && arg.length > 1) {
            var key= arg.slice(1)
            options[arg]= true
            options[key]= true
            profiles.push(arg)
        } else if (arg.startsWith("-") && arg.length > 1 && !arg.startsWith("--")) {
            var key= arg.slice(1)
            if (key === 'bg' || key === 'fg' || key === 'start' || key === 'resident' || key === 'nolimits' || key.startsWith('profile')) {
                options[arg]= true
                options[key]= false
                profiles.push(arg)
            } else {
                options[key]= true
            }
        } else {
            positionals.push(arg)
        }
        i= i + 1
    }
    return { options, positionals, profiles }
}
