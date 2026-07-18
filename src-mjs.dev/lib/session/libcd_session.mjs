
/** 
 * lib-change-descent is session orientated due to the nature of users and the os, the top most container of context
 * which becomes queues of operations... with profile / config added.... 
 */

// TODO (matt): no complex class to restore for the moment... session_restore() {} ?

/// each set of mods in context of process... do ... you only ever use 1 normally and that spawns workers
/// some data is global and static as it changes... known and active volumes.... 

/// in default the sessions are init, and default... any app will just have this and it works as you expect..
//// you can tho change how this operates via the config so that burst sessions replace the previous when the root/path or config path overrides it... 
//// or not.. 

/*
 * sessions allow abnormal terminations and fast resuming of sessions... they ensure we can restore
 */

import { LIBCD_HEADER_SIZE as HEADER_SIZE, LIBCD_MAGIC as MAGIC } from '../../config/libcd_constants.mjs'

/**
 * creates a session " view " - preallocate 
 * @param {number} node_count 
 * @param {number} heap_size 
 * @returns 
 */
export function session_header_create(node_count, heap_size) {

    const buffer= new ArrayBuffer(HEADER_SIZE)
    const view= new DataView(buffer)
    const encoder= new TextEncoder()

    // 1. Write Magic Bytes
    const magicBytes= encoder.encode(MAGIC)
    new Uint8Array(buffer).set(magicBytes, 0)

    // 2. Write Metadata
    view.setUint32(8, 1, true)              // Version 1, Little Endian
    view.setUint32(12, 0, true)             // Flags (currently empty)
    view.setUint32(16, node_count, true)    // Total nodes in session
    view.setUint32(20, heap_size, true)     // Total bytes in string heap
    
    // 3. Write Timestamp
    view.setBigUint64(24, BigInt(Date.now()), true)

    return new Uint8Array(buffer)
}

/**
 * validates the session was correctly written since something odd didn't happen with the process
 * @param {Uint8Array} header_buffer 
 * @returns {Object} 
 */
export function session_header_validate(header_buffer) {
    const view= new DataView(header_buffer.buffer)
    const decoder= new TextDecoder()
    
    // Check Magic is correct and no corruption happened
    const magic= decoder.decode(new Uint8Array(header_buffer.buffer, 0, 8))
    if (magic !== MAGIC) {
        throw new Error("INVALID_SESSION_FILE: Magic bytes mismatch")
    }

    const out= {
        version: view.getUint32(8, true),
        node_count: view.getUint32(16, true),
        heap_size: view.getUint32(20, true),
        timestamp: Number(view.getBigUint64(24, true))
    }
    
    return out
}

/**
 * space-prefixed function: session_init_for_context
 * initializes or restores session header view inside `ctx.buffers.session_header` (`or ctx.session`)
 * protecting memory bounds against corruption and enabling fast resume operations.
 */
export function session_init_for_context(ctx, options= {}) {
    var opts= options || {}
    var header_buf= opts.header_buffer || opts.restore_header || (ctx.buffers && ctx.buffers.session_header ? ctx.buffers.session_header : null)
    var node_count= opts.node_count || (ctx.buffers && ctx.buffers.node_buffer ? ctx.buffers.node_buffer.length : 1024)
    var heap_size= opts.heap_size || (ctx.buffers && ctx.buffers.string_heap ? ctx.buffers.string_heap.byteLength : 65536)

    var meta, buf
    var restored= false
    if (header_buf && header_buf instanceof Uint8Array && header_buf.byteLength === HEADER_SIZE) {
        try {
            meta= session_header_validate(header_buf)
            buf= header_buf
            restored= true
        } catch (e) {
            buf= session_header_create(node_count, heap_size)
            meta= session_header_validate(buf)
        }
    } else {
        buf= session_header_create(node_count, heap_size)
        meta= session_header_validate(buf)
    }

    if (!ctx.buffers) ctx.buffers= Object.create(null)
    ctx.buffers.session_header= buf

    var session_state= {
        active: true,
        restored: restored,
        header: buf,
        metadata: meta,
        created_ts: meta.timestamp,
        last_checkpoint_ts: meta.timestamp,
        checkpoints: []
    }
    ctx.session= session_state
    return session_state
}

/**
 * space-prefixed function: session_validate_for_context
 * verifies magic bytes and structural integrity of `ctx.session` / `ctx.buffers.session_header`
 */
export function session_validate_for_context(ctx) {
    if (!ctx || !ctx.session || !ctx.session.header || !ctx.buffers || !ctx.buffers.session_header) {
        throw new Error('INVALID_SESSION_CONTEXT: Context does not contain active session buffer')
    }
    var meta= session_header_validate(ctx.buffers.session_header)
    ctx.session.metadata= meta
    return meta
}

/**
 * space-prefixed function: session_checkpoint_for_context
 * writes updated flags and current timestamp into the active zero-GC session header view
 * marking progress so interrupted processes can stop corruption and resume cleanly.
 */
export function session_checkpoint_for_context(ctx, flags= 0) {
    if (!ctx || !ctx.session || !ctx.buffers || !ctx.buffers.session_header) {
        throw new Error('INVALID_SESSION_CONTEXT: Cannot checkpoint context without active session buffer')
    }
    var buf= ctx.buffers.session_header
    if (buf.byteLength < HEADER_SIZE) {
        throw new Error('INVALID_SESSION_BUFFER: Session header view truncated')
    }
    var view= new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
    view.setUint32(12, flags >>> 0, true)
    var now= Date.now()
    view.setBigUint64(24, BigInt(now), true)

    ctx.session.last_checkpoint_ts= now
    ctx.session.checkpoints.push({ ts: now, flags: flags })
    return { ts: now, flags: flags }
}
