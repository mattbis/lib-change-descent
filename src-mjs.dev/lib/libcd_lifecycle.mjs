/**
 * a combination of mods - creates a executor bundle... however the question arises context, although i don't like it and would prefer classes, that always 
 * just gets complicated, so for now I'm thinking thisArg.. as simple as possible.
 */

import { operation_run_pipeline, libcd_micro_pause } from './internal/op/libcd_operation.mjs'
import { run_pre_op_check, run_self_check } from './internal/self_check/libcd_self_check.mjs'

export async function lifecycle_house_keep(options= {}) {
    var ctx= this || options.ctx
    return operation_run_pipeline(ctx, async function() {
        if (ctx) run_self_check(ctx)
        await libcd_micro_pause.yield(ctx, 'house_keep')
    }, options)
}

export async function lifecycle_start(options= {}) {
    var ctx= this || options.ctx
    return lifecycle_resume.call(ctx, options)
}

export async function lifecycle_background(options= {}) {
    var ctx= this || options.ctx
    if (ctx) ctx.profile= '+bg'
    await libcd_micro_pause.yield(ctx, 'mode_switch')
}

export async function lifecycle_foreground(options= {}) {
    var ctx= this || options.ctx
    if (ctx) ctx.profile= '+fg'
    await libcd_micro_pause.yield(ctx, 'mode_switch')
}

export async function lifecycle_abort(options= {}) {
    var ctx= this || options.ctx
    if (ctx && ctx.abort_flag) {
        // TODO (matt): signal abort flag in atomic control buffer
    }
}

export async function lifecycle_stop(options= {}) {
    var ctx= this || options.ctx
    await lifecycle_abort.call(ctx, options)
}

export async function lifecycle_resume(options= {}) {
    var ctx= this || options.ctx
    return operation_run_pipeline(ctx, async function() {
        if (ctx) run_pre_op_check(ctx)
        await libcd_micro_pause.yield(ctx, 'resume')
    }, options)
}
