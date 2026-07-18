/**
 * expose constructors that allow different ways to consume the library
 */

// 2p
import { arg_parse_profile, arg_parse_cli } from '../arg/libcd_arg.mjs'
import { gate_verify_arg_modification, gate_is_active } from './libcd_gate.mjs'

// basic constructor supporting +resident and +gate runtime verification
export class LibCdBare {
    constructor(options= {}) {
        this.options= arg_parse_profile(options?.profile || '+bg', options)
        if (gate_is_active(this.options)) {
            gate_verify_arg_modification(this.options, options?.pin, options?.secret_path)
            delete this.options.pin
            if (this.options.options) delete this.options.options.pin
        }
    }

    modify_args(profile_or_cli, extra_options= {}) {
        var merged= Object.assign({}, this.options, extra_options)
        if (typeof profile_or_cli === 'string') {
            merged.profile= profile_or_cli
        } else if (profile_or_cli && typeof profile_or_cli === 'object') {
            Object.assign(merged, profile_or_cli)
        }
        if (gate_is_active(this.options) || gate_is_active(merged)) {
            var input_pin= extra_options?.pin || (profile_or_cli && typeof profile_or_cli === 'object' ? profile_or_cli.pin : null)
            var sec_path= extra_options?.secret_path || (profile_or_cli && typeof profile_or_cli === 'object' ? profile_or_cli.secret_path : null) || this.options?.options?.secret_path || this.options?.secret_path
            gate_verify_arg_modification(merged, input_pin, sec_path)
        }
        this.options= arg_parse_profile(merged.profile || this.options.profile, merged)
        delete this.options.pin
        if (this.options.options) delete this.options.options.pin
        return this.options
    }
}

/** standalone runtime bundle or custom consumer */
export class LibCdOp extends LibCdBare {
    constructor(options= {}) {
        super(options)
    }
}

