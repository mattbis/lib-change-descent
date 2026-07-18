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
 * parse standard cli arguments (process.argv slice) into options and positional args
 * uses standard fast comparisons since cli option names (--verbose, -D) are non-secret
 */
export function arg_parse_cli(args= []) {
    var options= {}
    var positionals= []
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
                options[arg.slice(2)]= true
            }
        } else if (arg.startsWith("-") && arg.length > 1) {
            options[arg.slice(1)]= true
        } else {
            positionals.push(arg)
        }
        i= i + 1
    }
    return { options, positionals }
}
