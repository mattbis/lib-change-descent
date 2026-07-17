/**
 * define volume management & vole mask structure, with sympathy to the __REAL WORLD__
 * redesigns strategies around behavioral vole masks (acl, read, speed, activity, history)
 */

import { run_operation, libcd_micro_pause } from '../internal/op/libcd_operation.mjs'
import { LIBCD_IMPRINT_MAGIC } from '../../etc/release/libcd_config.mjs'

export const LIBCD_VOLE_MASK= {
    acl: {
        probe_name_records: 0x01,
        descend_root: 0x02,
        descend_children: 0x04,
        must_io_exclusive: 0x08
    },
    read: {
        query_root_dirs: 0x01,
        query_root_children: 0x02,
        seek_node_size: 0x04,
        is_vector: 0x08
    },
    speed: {
        no_restrictions: 0x01,
        careful_ramp: 0x02,
        system_controlled: 0x04,
        resident_monitored: 0x08
    },
    activity: {
        missing: 0x01,
        present: 0x02,
        busy: 0x03,       // 2 + 1 (present | missing)
        read: 0x04,
        write: 0x08,
        maintain: 0x10
    },
    history: {
        previous_readings: 0x01
    }
}

export const LIBCD_VOL_SPECIES= {
    fixed: { name: 'fixed', default_speed: LIBCD_VOLE_MASK.speed.no_restrictions },
    volatile: { name: 'volatile', default_speed: LIBCD_VOLE_MASK.speed.careful_ramp },
    temporary: { name: 'temporary', default_speed: LIBCD_VOLE_MASK.speed.no_restrictions }
}

export const LIBCD_VOL_TYPE= {
    ram: { species: 'volatile', io_exclusive: false },
    vm: { species: 'fixed', io_exclusive: true },
    ssd: { species: 'fixed', io_exclusive: false },
    hdd: { species: 'fixed', io_exclusive: true }
}

/**
 * behavioral discovery strategies driven by active volume masks rather than rigid static loops
 */
export const LIBCD_VOL_DISCOVER_STRATEGY= {
    sequential: {
        next: function(index, count, mask= 0) {
            if ((mask & LIBCD_VOLE_MASK.activity.busy) === LIBCD_VOLE_MASK.activity.busy) return -1
            return (index + 1 < count) ? index + 1 : -1
        }
    },
    staggered: {
        next: function(index, count, mask= 0, step= 4) {
            if ((mask & LIBCD_VOLE_MASK.activity.busy) === LIBCD_VOLE_MASK.activity.busy) return -1
            var next_idx= index + step
            if (next_idx < count) return next_idx
            return (index + 1 < step && index + 1 < count) ? index + 1 : -1
        }
    },
    random_sample: {
        next: function(index, count, mask= 0) {
            if ((mask & LIBCD_VOLE_MASK.activity.busy) === LIBCD_VOLE_MASK.activity.busy) return -1
            return Math.floor(Math.random() * count)
        }
    }
}

/**
 * dual surface vole mask helper functions for checking and applying masks behaviorally
 * strictly uses unsigned 32-bit integer boundaries (`>>> 0`) per bitwise quirks
 */
export function has_mask(current_mask, target_mask) {
    return (current_mask & target_mask) === target_mask
}

export function add_mask(current_mask, target_mask) {
    return (current_mask | target_mask) >>> 0
}

export function clear_mask(current_mask, target_mask) {
    return (current_mask & ~target_mask) >>> 0
}

export class libcd_Volume {
    constructor(options= {}) {
        this.type= options.type || 'ssd'
        this.species= options.species || LIBCD_VOL_TYPE[this.type]?.species || 'fixed'
        
        // initialize behavioral vole masks
        this.acl_mask= LIBCD_VOLE_MASK.acl.probe_name_records | LIBCD_VOLE_MASK.acl.descend_root | LIBCD_VOLE_MASK.acl.descend_children
        if (LIBCD_VOL_TYPE[this.type]?.io_exclusive) {
            this.acl_mask= add_mask(this.acl_mask, LIBCD_VOLE_MASK.acl.must_io_exclusive)
        }
        
        this.read_mask= LIBCD_VOLE_MASK.read.query_root_dirs | LIBCD_VOLE_MASK.read.query_root_children | LIBCD_VOLE_MASK.read.seek_node_size
        this.speed_mask= LIBCD_VOL_SPECIES[this.species]?.default_speed || LIBCD_VOLE_MASK.speed.careful_ramp
        this.activity_mask= LIBCD_VOLE_MASK.activity.present
        this.history_mask= 0

        this.d= {
            type_log: [],
            identifiers: options.identifiers || [],
            acl_log: []
        }
    }

    set_type(type) {
        this.type= type
        this.species= LIBCD_VOL_TYPE[type]?.species || 'fixed'
        if (LIBCD_VOL_TYPE[type]?.io_exclusive) {
            this.acl_mask= add_mask(this.acl_mask, LIBCD_VOLE_MASK.acl.must_io_exclusive)
        } else {
            this.acl_mask= clear_mask(this.acl_mask, LIBCD_VOLE_MASK.acl.must_io_exclusive)
        }
    }

    /**
     * lib_cd.volume.imprint -- creates user space ownership manifest in root `\libcd\var\db`
     * if fixed disk or profile specifies, can skip or retry up to 3 times via try/catch/retry
     */
    async imprint(hardware_id, imprint_options= {}) {
        var self= this
        if (this.species === 'fixed' && imprint_options.skip_fixed === true) {
            return true
        }

        return run_operation(this, async function imprint_step() {
            self.activity_mask= add_mask(self.activity_mask, LIBCD_VOLE_MASK.activity.write)
            try {
                // write ownership manifest to `\libcd\var\db` using the 32-bit magic imprint
                var manifest_payload = new Uint32Array([LIBCD_IMPRINT_MAGIC, hardware_id || 0x0])
                // TODO (matt): fs.writeFile(volume_root + '\\libcd\\var\\db\\imprint.bin', manifest_payload)

                await libcd_micro_pause.yield(self, 'imprint_write')
            } finally {
                self.activity_mask= clear_mask(self.activity_mask, LIBCD_VOLE_MASK.activity.write)
            }
        }, { max_retries: 3 })
    }
}
