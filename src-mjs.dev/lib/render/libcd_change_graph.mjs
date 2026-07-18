/**
 * change graph rendering module (`libcd_change_graph.mjs`)
 * tracks disk node change entropy (`[0.0 .. 1.0]`) across a shared scalar float buffer (`ctx.buffers.change_graph_buffer`).
 * emits zero-copy scalar views, SVG vector curves (`<path d="..." />`), and quantized bitmap grids (`0..255`)
 * so connected applications, UI dashboards, or Zig threads can display real-time visual heatmaps of disk drift.
 */

// 2p
import { invariant } from '../libcd_invariant.mjs'
import { arg_get_opt } from '../arg/libcd_arg.mjs'
import { ctx_buffer } from '../internal/ctx/libcd_ctx.mjs'

/**
 * space-prefixed function: change_graph_init
 * initializes or resizes the scalar change entropy buffer (`Float32Array`) inside the lifecycle context.
 */
export function change_graph_init(ctx, buckets= 1024) {
    invariant(ctx && typeof ctx === 'object', 'valid lifecycle context required')
    var buf= new Float32Array(buckets)
    ctx_buffer(ctx, 'change_graph_buffer', buf)
    return buf
}

/**
 * space-prefixed function: change_graph_record
 * records a state change or entropy increase for a specific node ID.
 * maps the node ID into the scalar bucket grid and accumulates `entropy_delta` (clamped to [0.0 .. 1.0]).
 */
export function change_graph_record(ctx, node_id, entropy_delta= 0.25) {
    var buf= ctx_buffer(ctx, 'change_graph_buffer')
    if (!buf || buf.length === 0) return 0.0

    // map node_id into bucket index
    var idx= Math.abs(Math.floor(node_id)) % buf.length
    var current= buf[idx] + entropy_delta
    
    // clamp between 0.0 (cold/no change) and 1.0 (hot/max entropy)
    var clamped= (current > 1.0) ? 1.0 : ((current < 0.0) ? 0.0 : current)
    buf[idx]= clamped
    return clamped
}

/**
 * space-prefixed function: change_graph_decay
 * performs a rolling sweep across the scalar buffer, decaying existing entropy values by `decay_rate`.
 * allows older changes to smoothly fade back to lighter shades (`0.0`) over continuous resident scans.
 */
export function change_graph_decay(ctx, decay_rate= 0.05) {
    var buf= ctx_buffer(ctx, 'change_graph_buffer')
    if (!buf || buf.length === 0) return
    
    var factor= (decay_rate > 1.0) ? 0.0 : ((decay_rate < 0.0) ? 1.0 : (1.0 - decay_rate))
    var len= buf.length
    for (var i= 0; i < len; i++) {
        var val= buf[i] * factor
        // flush near-zero residuals to clean 0.0
        buf[i]= (val < 0.001) ? 0.0 : val
    }
}

/**
 * space-prefixed function: change_graph_emit_scalar
 * returns the raw Float32Array scalar buffer view directly for zero-copy IPC or native rendering.
 */
export function change_graph_emit_scalar(ctx) {
    return ctx_buffer(ctx, 'change_graph_buffer') || new Float32Array(0)
}

/**
 * space-prefixed function: change_graph_emit_vector_svg
 * generates an SVG path string (`M x y L x y ...`) or polyline coordinates representing disk change entropy.
 * lighter/0.0 values sit at `height` (baseline); darker/1.0 values peak near `0` (top of chart).
 */
export function change_graph_emit_vector_svg(ctx, options= {}) {
    var opts= options || {}
    var width= arg_get_opt(opts, 'width', 800) || 800
    var height= arg_get_opt(opts, 'height', 200) || 200
    var buf= ctx_buffer(ctx, 'change_graph_buffer')
    if (!buf || buf.length === 0) return ''

    var len= buf.length
    var step= width / (len > 1 ? (len - 1) : 1)
    var path_parts= []

    for (var i= 0; i < len; i++) {
        var x= (i * step).toFixed(1)
        // invert Y: 0.0 entropy -> baseline (height); 1.0 entropy -> top (0)
        var y= (height - (buf[i] * height)).toFixed(1)
        var cmd= (i === 0) ? 'M' : 'L'
        path_parts.push(cmd + ' ' + x + ' ' + y)
    }

    return path_parts.join(' ')
}

/**
 * space-prefixed function: change_graph_emit_bitmap
 * quantizes the scalar float buckets (`[0.0 .. 1.0]`) into a 2D Uint8Array pixel grid (`[0 .. 255]`)
 * of dimensions `width × height`. 0 = light/cold; 255 = dark/high entropy.
 * suitable for PBM/PGM headers, terminal ASCII rendering, or web canvas texture upload.
 */
export function change_graph_emit_bitmap(ctx, width= 64, height= 16) {
    var buf= ctx_buffer(ctx, 'change_graph_buffer')
    var grid= new Uint8Array(width * height)
    if (!buf || buf.length === 0) return grid

    var len= buf.length
    var buckets_per_col= len / width
    var col= 0
    while (col < width) {
        // sample peak entropy in this horizontal column bucket
        var start_idx= Math.floor(col * buckets_per_col)
        var end_idx= Math.floor((col + 1) * buckets_per_col)
        var peak= 0.0
        for (var i= start_idx; i < end_idx && i < len; i++) {
            if (buf[i] > peak) peak= buf[i]
        }

        // map peak (0.0 .. 1.0) to vertical fill height (0 .. height)
        var fill_height= Math.round(peak * height)
        var row= 0
        while (row < height) {
            var pixel_idx= (row * width) + col
            // rows are top-to-bottom: bottom fill_height rows get intensity 255
            var is_active= (height - row) <= fill_height
            grid[pixel_idx]= is_active ? Math.round(peak * 255) : 0
            row= row + 1
        }
        col= col + 1
    }

    return grid
}

/**
 * Dual Surface Class Wrapper (`libcd_ChangeGraph`):
 * thin class wrapper around our `change_graph_*` functional primitives with context (`this.ctx`) propagation.
 */
export class libcd_ChangeGraph {
    constructor(ctx, buckets= 1024) {
        this.ctx= ctx
        if (!ctx_buffer(ctx, 'change_graph_buffer')) {
            change_graph_init(ctx, buckets)
        }
    }

    record(node_id, entropy_delta= 0.25) {
        return change_graph_record(this.ctx, node_id, entropy_delta)
    }

    decay(decay_rate= 0.05) {
        return change_graph_decay(this.ctx, decay_rate)
    }

    emit_scalar() {
        return change_graph_emit_scalar(this.ctx)
    }

    emit_vector_svg(options= {}) {
        return change_graph_emit_vector_svg(this.ctx, options)
    }

    emit_bitmap(width= 64, height= 16) {
        return change_graph_emit_bitmap(this.ctx, width, height)
    }
}
