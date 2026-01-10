export const OP= {
    START_SCAN: 0,
    PAUSE: 1,
    RESUME: 2,
    TERMINATE: 3
}

/* ---- PRIMARY ---- */
export function dispatch_worker(worker, disk_info) {
    const dispatch_data= {
        op: OP.START_SCAN,
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
