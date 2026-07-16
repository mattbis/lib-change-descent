/**
 * a combination of mods - creates a executor bundle... however the question arises context, although i don't like it and would prefer classes, that always 
 * just gets complicated, so for now I'm thinking thisArg.. as simple as possible.
 */

import { run_operation, libcd_micro_pause } from './internal/op/libcd_operation.mjs'
import { run_pre_op_check, run_self_check } from './internal/self_check/libcd_self_check.mjs'

export async function _house_keep(options= {}) {
    var ctx= this || options.ctx
    return run_operation(ctx, async function() {
        if (ctx) run_self_check(ctx)
        await libcd_micro_pause.yield(ctx, 'house_keep')
    }, options)
}

export async function start(options= {}) {
    var ctx= this || options.ctx
    return resume.call(ctx, options)
}

export async function background(options= {}) {
    var ctx= this || options.ctx
    if (ctx) ctx.profile= '+bg'
    await libcd_micro_pause.yield(ctx, 'mode_switch')
}

export async function foreground(options= {}) {
    var ctx= this || options.ctx
    if (ctx) ctx.profile= '+fg'
    await libcd_micro_pause.yield(ctx, 'mode_switch')
}

export async function abort(options= {}) {
    var ctx= this || options.ctx
    if (ctx && ctx.abort_flag) {
        // TODO (matt): signal abort flag in atomic control buffer
    }
}

export async function stop(options= {}) {
    var ctx= this || options.ctx
    await abort.call(ctx, options)
}

export async function resume(options= {}) {
    var ctx= this || options.ctx
    return run_operation(ctx, async function() {
        if (ctx) run_pre_op_check(ctx)
        await libcd_micro_pause.yield(ctx, 'resume')
    }, options)
}
