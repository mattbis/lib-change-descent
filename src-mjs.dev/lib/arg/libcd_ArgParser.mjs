// 2p
import {
    arg_slice_compare_fast,
    arg_slice_compare_secure_raw,
    arg_slice_compare_secure,
    arg_parse_binary_header,
    arg_parse_cli,
    arg_parse_profile,
    arg_get_opt
} from "./libcd_arg.mjs"

/**
 * thin class wrapper for argument and slice comparison/parsing
 * delegates directly to functional primitives inside libcd_arg.mjs
 */
export class libcd_ArgParser {
    constructor(default_args= null) {
        this.default_args= default_args || []
    }

    parse_cli(args= null) {
        var target= (args !== null) ? args : this.default_args
        return arg_parse_cli(target)
    }

    parse_profile(profile_arg= '+bg', options= {}) {
        return arg_parse_profile(profile_arg, options)
    }

    get_opt(opts, key, default_val= null) {
        return arg_get_opt(opts, key, default_val)
    }

    compare_fast(buf_a, offset_a, buf_b, offset_b, len= 0) {
        return arg_slice_compare_fast(buf_a, offset_a, buf_b, offset_b, len)
    }

    compare_secure_raw(buf_a, offset_a, buf_b, offset_b, len= 0) {
        return arg_slice_compare_secure_raw(buf_a, offset_a, buf_b, offset_b, len)
    }

    compare_secure(buf_a, buf_b) {
        return arg_slice_compare_secure(buf_a, buf_b)
    }

    check_header(u8_view, offset= 0, magic_bytes= null) {
        return arg_parse_binary_header(u8_view, offset, magic_bytes)
    }
}
