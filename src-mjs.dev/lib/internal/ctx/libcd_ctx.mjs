/**
 * lifecycle context module (`libcd_ctx.mjs`)
 * manages session execution state, resident profile flags (`+resident`, `+bg`, `+fg`),
 * active volume registries, and pointers to zero-GC shared buffer pools (`change_graph_buffer`, `control_buffer`).
 * acts as the central execution boundary (`thisArg`) passed through lifecycle operations and schema managers.
 */

// 2p
import { invariant } from '../../libcd_invariant.mjs'
import { arg_get_opt } from '../../arg/libcd_arg.mjs'

/**
 * default buffer sizing and capacity bounds
 */
export const LIBCD_CTX_DEFAULT= Object.freeze({
    change_graph_buckets: 1024,   // default number of scalar entropy buckets for visual output
    max_retries: 3,
    default_profile: '+bg'
})

/**
 * space-prefixed function: ctx_create
 * creates a new lifecycle execution context with null-prototype registries (`Object.create(null)`)
 * and pre-allocated scalar buffer views for change entropy tracking.
 */
export function ctx_create(options= {}) {
    var opts= options || {}
    
    var profile= arg_get_opt(opts, 'profile', LIBCD_CTX_DEFAULT.default_profile) || LIBCD_CTX_DEFAULT.default_profile
    var max_retries= arg_get_opt(opts, 'max_retries', LIBCD_CTX_DEFAULT.max_retries) || LIBCD_CTX_DEFAULT.max_retries
    var graph_buckets= arg_get_opt(opts, 'change_graph_buckets', LIBCD_CTX_DEFAULT.change_graph_buckets) || LIBCD_CTX_DEFAULT.change_graph_buckets

    // pre-allocate change graph entropy buffer (scalar float32 values [0.0 .. 1.0])
    // 0.0 = cold (no change); 1.0 = hot / high entropy (heavy node modification)
    var change_graph_buffer= new Float32Array(graph_buckets)

    var ctx= {
        profile: profile,
        max_retries: max_retries,
        abort_flag: false,
        
        // null-prototype registry for mounted volume instances and worker references
        volumes: new Map(),
        
        // shared raw memory views and buffer pools (`control_buffer`, `change_graph_buffer`)
        buffers: Object.assign(Object.create(null), {
            change_graph_buffer: change_graph_buffer,
            control_buffer: arg_get_opt(opts, 'control_buffer', null),
            node_buffer: arg_get_opt(opts, 'node_buffer', null),
            string_heap: arg_get_opt(opts, 'string_heap', null)
        })
    }

    return ctx
}

/**
 * space-prefixed function: ctx_profile
 * Go-style accessor for resident profile setting (`+bg`, `+fg`, `-nolimits`)
 */
export function ctx_profile(ctx, val= undefined) {
    invariant(ctx && typeof ctx === 'object', 'valid context required')
    if (val !== undefined) {
        ctx.profile= val
        return val
    }
    return ctx.profile
}

/**
 * space-prefixed function: ctx_buffer
 * Go-style accessor to retrieve or set named raw memory views inside `ctx.buffers`
 */
export function ctx_buffer(ctx, name, buffer_view= undefined) {
    invariant(ctx && ctx.buffers, 'context buffers structure required')
    if (buffer_view !== undefined) {
        ctx.buffers[name]= buffer_view
        return buffer_view
    }
    return ctx.buffers[name] || null
}

/**
 * Dual Surface Class Wrapper (`libcd_Context`):
 * thin object wrapper around `ctx_create` and `ctx_*` functional primitives.
 */
export class libcd_Context {
    constructor(options= {}) {
        this.ctx= ctx_create(options)
    }

    profile(val= undefined) {
        return ctx_profile(this.ctx, val)
    }

    buffer(name, buffer_view= undefined) {
        return ctx_buffer(this.ctx, name, buffer_view)
    }
}
