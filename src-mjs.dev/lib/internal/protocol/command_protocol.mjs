
/** 
 * @enum {number} 
 */
export const PROTOCOL_OP= {
    START_SCAN: 0,
    PAUSE: 1,
    RESUME: 2,
    TERMINATE: 3
}

/* ---- PRIMARY ---- */

/**
 * @param {Worker} worker
 * @param {Object} disk_info
 */
export function dispatch_worker(worker, disk_info) {
    const dispatch_data= {
        op: PROTOCOL_OP.START_SCAN,
        payload: {
            root_path: disk_info.path,
            uuid: disk_info.uuid,
            is_ssd: disk_info.is_ssd,
            node_buffer: shared_node_buffer,
            string_heap: shared_string_heap,
            // Used for Atomics
            control_buffer: shared_control_buffer
        }
    }
    worker.postMessage(dispatch_data)
}

/* ---- WORKERS ---- */

/**
 * @param {Object} message
 */
export function handle_worker_message(message) {
    switch (message.op) {
        case PROTOCOL_OP.START_SCAN:
            return handle_start_scan(message.payload)
        case PROTOCOL_OP.PAUSE:
            return handle_pause(message.payload)
        case PROTOCOL_OP.RESUME:
            return handle_resume(message.payload)
        case PROTOCOL_OP.TERMINATE:
            return handle_terminate(message.payload)
    }
}

/**
 * @param {Object} payload
 */
function handle_start_scan(payload) {
    
}
