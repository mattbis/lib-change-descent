export async function* create_disk_scheduler(disk_queue, options= {}) {
    const max_workers= options.max_workers || 4
    const bus_activity= new Map()
    let active_workers= 0

    // Internal helper to wait for a "slot" to open up
    const waitForSlot= () => new Promise(resolve=> setTimeout(resolve, 100))

    while (disk_queue.length > 0 || active_workers > 0) {
        if (active_workers < max_workers) {
            // Find a task where the bus isn't currently busy
            const task_index= disk_queue.findIndex(task=> {
                if (task.type === 'HDD' && bus_activity.get(task.bus_id)) {
                    return false
                }
                return true
            })

            if (task_index !== -1) {
                const task= disk_queue.splice(task_index, 1)[0]
                
                // Lock the bus and increment worker count
                active_workers++
                if (task.type === 'HDD') bus_activity.set(task.bus_id, true)

                // Define a callback for when the worker finishes
                const release= () => {
                    active_workers--
                    if (task.type === 'HDD') bus_activity.set(task.bus_id, false)
                }

                yield { task, release }
                continue
            }
        }

        // If no tasks are ready or pool is full, wait a bit
        await waitForSlot()
    }
}
