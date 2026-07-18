// triggers very important things - even if not with `+start` and `+resident`

// 2p
import { run_pre_op_check, run_self_check } from '../self_check/libcd_self_check.mjs'

// factors of mod controlled micro pause.... 
export const libcd_micro_pause= {
    factors: {
        bg: 10,       // +bg profile: 10ms yield to prevent starving host CPU
        fg: 1,        // +fg profile: 1ms minimal yield during burst operations
        nolimits: 0   // -nolimits profile: 0ms zero-pause tight loop
    },

    get_factor: function(ctx) {
        var profile= ctx?.profile || 'bg'
        if (profile.includes('-nolimits')) return this.factors.nolimits
        if (profile.includes('+fg') || profile.includes('fg')) return this.factors.fg
        return this.factors.bg
    },

    yield: function(ctx, reason) {
        var ms= this.get_factor(ctx)
        if (ms === 0) return Promise.resolve()
        return new Promise(function(resolve) {
            setTimeout(resolve, ms)
        })
    },

    retry_backoff: function(attempt, ctx) {
        var factor= this.get_factor(ctx)
        var base= (factor === 0) ? 2 : factor
        var ms= Math.min(attempt * attempt * base, 1000)
        return new Promise(function(resolve) {
            setTimeout(resolve, ms)
        })
    }
}

/**
 * execute an operation or composed pipeline of sub-operations using thisArg (ctx)
 * wraps steps inside try {} catch {} and delegates to operation_retry_step on failure
 */
export async function operation_run_pipeline(ctx, steps_or_fn, options= {}) {
    var steps= Array.isArray(steps_or_fn) ? steps_or_fn : [steps_or_fn]
    var max_retries= options.max_retries || ctx?.max_retries || 3

    if (options.skip_pre_check !== true && ctx) {
        run_pre_op_check(ctx)
    }

    for (var i= 0; i < steps.length; i++) {
        var step= steps[i]
        var attempt= 0
        var success= false

        while (!success) {
            try {
                await step.call(ctx, options)
                success= true
            } catch (err) {
                attempt++
                if (attempt > max_retries) {
                    throw new Error(`[OP_EXHAUSTED]: step ${step.name || i} failed after ${max_retries} retries: ${err.message}`)
                }
                await operation_retry_step(ctx, err, attempt, step)
            }
        }

        // micro-pause between composed sub-operations if more steps remain
        if (i < steps.length - 1) {
            await libcd_micro_pause.yield(ctx, 'step_boundary')
        }
    }

    if (options.skip_post_check !== true && ctx) {
        run_self_check(ctx)
    }
}

/**
 * handles operational failures within try {} catch {} boundaries
 */
export async function operation_retry_step(ctx, err, attempt, step) {
    // TODO (matt): record failure snapshot to imut_log
    await libcd_micro_pause.retry_backoff(attempt, ctx)
}

/// each op has context, when run... a pipeline tracks the progress...
export class libcd_Operation {
    constructor(ctx, options= {}) {
        this.ctx= ctx
        this.options= options
    }

    async run(steps_or_fn) {
        return operation_run_pipeline(this.ctx, steps_or_fn, this.options)
    }
}
