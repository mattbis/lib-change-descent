/**
 * expose constructors that allow different ways to consume the library
 */

// 2p
import { arg_parse_profile, arg_parse_cli } from '../arg/libcd_arg.mjs'
import { gate_verify_arg_modification, gate_is_active } from './libcd_gate.mjs'
import { ctx_create, ctx_profile } from '../internal/ctx/libcd_ctx.mjs'
import { session_init_for_context, session_validate_for_context, session_checkpoint_for_context } from '../session/libcd_session.mjs'

// basic constructor supporting +resident and +gate runtime verification
export class LibCdBare {
    constructor(options= {}) {
        this.options= arg_parse_profile(options?.profile || '+bg', options)
        if (gate_is_active(this.options)) {
            gate_verify_arg_modification(this.options, options?.pin, options?.secret_path)
            delete this.options.pin
            if (this.options.options) delete this.options.options.pin
        }
        this.ctx= ctx_create(this.options)
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
        if (this.ctx) ctx_profile(this.ctx, this.options.profile)
        return this.options
    }

    context() {
        return this.ctx
    }
}

/** standalone runtime bundle or custom consumer */
export class LibCdOp extends LibCdBare {
    constructor(options= {}) {
        super(options)
    }
}

/** session enabled ctor that then allows context switching or single usage with resume protection */
export class LibCdSession extends LibCdBare {
    constructor(options= {}) {
        var opts= Object.assign({}, options)
        var prof= opts.profile || '+bg'
        if (typeof prof === 'string' && !prof.includes('+session')) {
            prof= '+session ' + prof
        }
        opts.profile= prof
        opts['+session']= true
        opts.session= true
        super(opts)

        this.contexts= new Map()
        this.contexts.set('default', this.ctx)
        this.active_context_id= 'default'
    }

    context_switch(ctx_id, extra_options= {}) {
        if (!ctx_id || typeof ctx_id !== 'string') {
            throw new Error('INVALID_CONTEXT_ID: Valid string id required to switch context')
        }
        if (this.contexts.has(ctx_id)) {
            this.ctx= this.contexts.get(ctx_id)
            this.active_context_id= ctx_id
            return this.ctx
        }

        var merged_opts= Object.assign({}, this.options, extra_options, { session: true, '+session': true })
        var prof= merged_opts.profile || '+session +bg'
        if (typeof prof === 'string' && !prof.includes('+session')) {
            prof= '+session ' + prof
        }
        merged_opts.profile= prof

        var new_ctx= ctx_create(merged_opts)
        this.contexts.set(ctx_id, new_ctx)
        this.ctx= new_ctx
        this.active_context_id= ctx_id
        return this.ctx
    }

    list_contexts() {
        return Array.from(this.contexts.keys())
    }

    session_init(options= {}) {
        return session_init_for_context(this.ctx, options)
    }

    session_validate() {
        return session_validate_for_context(this.ctx)
    }

    session_checkpoint(flags= 0) {
        return session_checkpoint_for_context(this.ctx, flags)
    }
}
