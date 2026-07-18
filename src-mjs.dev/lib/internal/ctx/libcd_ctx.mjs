/**
 * lifecycle context module (`libcd_ctx.mjs`)
 * manages session execution state, resident profile flags (`+resident`, `+bg`, `+fg`),
 * active volume registries, and pointers to zero-GC shared buffer pools (`change_graph_buffer`, `control_buffer`).
 * acts as the central execution boundary (`thisArg`) passed through lifecycle operations and schema managers.
 */

// 2p
import { invariant } from '../../libcd_invariant.mjs'
import { arg_get_opt } from '../../arg/libcd_arg.mjs'
import { LIBCD_VOLE_MASK, time_mask_get_duration_ms, time_mask_is_expired, time_mask_format } from '../../storage/libcd_volume.mjs'
import { post } from '../imut_log/libcd_imut_log.mjs'
import { make_entry } from '../imut_log/libcd_imut_log_entry.mjs'
import { session_init_for_context, session_validate_for_context, session_checkpoint_for_context } from '../../session/libcd_session.mjs'

/**
 * default buffer sizing and capacity bounds
 */
export const LIBCD_CTX_DEFAULT= Object.freeze({
    change_graph_buckets: 1024,   // default number of scalar entropy buckets for visual output
    max_retries: 3,
    default_profile: '+bg',
    default_time_mask: 0x10       // 3 years default config init per vole_mask_structure.md
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
    var time_mask= arg_get_opt(opts, 'time_mask', LIBCD_CTX_DEFAULT.default_time_mask) || LIBCD_CTX_DEFAULT.default_time_mask

    // pre-allocate change graph entropy buffer (scalar float32 values [0.0 .. 1.0])
    // 0.0 = cold (no change); 1.0 = hot / high entropy (heavy node modification)
    var change_graph_buffer= new Float32Array(graph_buckets)

    var ctx= {
        profile: profile,
        max_retries: max_retries,
        abort_flag: false,
        time_mask: time_mask,
        created_ts: Date.now(),
        last_maintenance_ts: Date.now(),
        
        // null-prototype registry for mounted volume instances and worker references
        volumes: new Map(),
        
        // shared raw memory views and buffer pools (`control_buffer`, `change_graph_buffer`)
        buffers: Object.assign(Object.create(null), {
            change_graph_buffer: change_graph_buffer,
            control_buffer: arg_get_opt(opts, 'control_buffer', null),
            node_buffer: arg_get_opt(opts, 'node_buffer', null),
            string_heap: arg_get_opt(opts, 'string_heap', null)
        }),
        session: null
    }

    var session_active= arg_get_opt(opts, 'session', false) || opts['+session'] === true || (typeof profile === 'string' && profile.includes('+session'))
    if (session_active) {
        session_init_for_context(ctx, opts)
    }

    post(make_entry('SESSION', 'CTX_CREATE', {
        profile: profile,
        time_mask: time_mask,
        time_mask_desc: time_mask_format(time_mask),
        session_active: Boolean(ctx.session),
        created_ts: ctx.created_ts
    }))

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
 * space-prefixed function: ctx_flags
 * queries and logs full lifecycle execution and time mask flags ("reminded of this when you query flags()")
 */
export function ctx_flags(ctx) {
    invariant(ctx && typeof ctx === 'object', 'valid context required')
    var payload= {
        profile: ctx.profile,
        time_mask: ctx.time_mask,
        time_ttl_ms: time_mask_get_duration_ms(ctx.time_mask),
        time_mask_desc: time_mask_format(ctx.time_mask),
        created_ts: ctx.created_ts,
        expired: time_mask_is_expired(ctx.created_ts, ctx.time_mask),
        session_active: Boolean(ctx.session),
        volumes_count: ctx.volumes ? ctx.volumes.size : 0
    }
    post(make_entry('SESSION', 'FLAGS_QUERY', payload))
    return payload
}

/**
 * space-prefixed function: ctx_run_time_maintenance
 * periodic maintenance hook compacting context buffers based on time_mask expiration
 */
export function ctx_run_time_maintenance(ctx) {
    invariant(ctx && typeof ctx === 'object', 'valid context required')
    var now= Date.now()
    var is_expired= time_mask_is_expired(ctx.created_ts, ctx.time_mask)
    if (is_expired && ctx.buffers && ctx.buffers.change_graph_buffer) {
        ctx.buffers.change_graph_buffer.fill(0)
    }
    ctx.last_maintenance_ts= now
    var payload= {
        time_mask: ctx.time_mask,
        compacted: is_expired,
        last_maintenance_ts: now
    }
    post(make_entry('SESSION', 'TIME_MAINTENANCE_COMPACT', payload))
    return payload
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

    flags() {
        return ctx_flags(this.ctx)
    }

    run_maintenance() {
        return ctx_run_time_maintenance(this.ctx)
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
