/**
 * define volume management & vole mask structure, with sympathy to the __REAL WORLD__
 * redesigns strategies around behavioral vole masks (acl, read, speed, activity, history)
 * stores current known active and valid volumes, and all known possible unique volume ids
 */

import { operation_run_pipeline, libcd_micro_pause } from '../internal/op/libcd_operation.mjs'
import { LIBCD_IMPRINT_MAGIC } from '../../config/libcd_constants.mjs'
import { arg_get_opt } from '../arg/libcd_arg.mjs'

/** returns volume signal state map or branches if check state supplied */
export function volume_sig_state(check_state) {
    var state_map= Object.freeze({
        ABORT: 0,
        RUN: 1,
        PROCESS: 2
    })
    if (check_state !== undefined && check_state !== null) {
        return Object.hasOwn(state_map, check_state) ? state_map[check_state] : check_state
    }
    return state_map
}

export const LIBCD_VOLE_MASK= Object.freeze({

    acl: Object.freeze({
        probe_name_records: 0x01,
        descend_root: 0x02,
        descend_children: 0x04,
        must_io_exclusive: 0x08
    }),
    read: Object.freeze({
        query_root_dirs: 0x01,
        query_root_children: 0x02,
        seek_node_size: 0x04,
        is_vector: 0x08
    }),
    speed: Object.freeze({
        no_restrictions: 0x01,
        careful_ramp: 0x02,
        system_controlled: 0x04,
        resident_monitored: 0x08
    }),
    activity: Object.freeze({
        missing: 0x01,
        present: 0x02,
        busy: 0x03,       // 2 + 1 (present | missing)
        read: 0x04,
        write: 0x08,
        maintain: 0x10
    }),
    history: Object.freeze({
        previous_readings: 0x01
    })
})

export const LIBCD_VOL_SPECIES= Object.freeze({
    fixed: Object.freeze({ name: 'fixed', default_speed: LIBCD_VOLE_MASK.speed.no_restrictions }),
    volatile: Object.freeze({ name: 'volatile', default_speed: LIBCD_VOLE_MASK.speed.careful_ramp }),
    temporary: Object.freeze({ name: 'temporary', default_speed: LIBCD_VOLE_MASK.speed.no_restrictions })
})

export const LIBCD_VOL_TYPE= Object.freeze({
    ram: Object.freeze({ species: 'volatile', io_exclusive: false }),
    vm: Object.freeze({ species: 'fixed', io_exclusive: true }),
    ssd: Object.freeze({ species: 'fixed', io_exclusive: false }),
    hdd: Object.freeze({ species: 'fixed', io_exclusive: true })
})

/**
 * behavioral discovery strategies driven by active volume masks rather than rigid static loops
 */
export const LIBCD_VOL_DISCOVER_STRATEGY= Object.freeze({
    sequential: Object.freeze({
        next: function(index, count, mask= 0) {
            if ((mask & LIBCD_VOLE_MASK.activity.busy) === LIBCD_VOLE_MASK.activity.busy) return -1
            return (index + 1 < count) ? index + 1 : -1
        }
    }),
    staggered: Object.freeze({
        next: function(index, count, mask= 0, step= 4) {
            if ((mask & LIBCD_VOLE_MASK.activity.busy) === LIBCD_VOLE_MASK.activity.busy) return -1
            var next_idx= index + step
            if (next_idx < count) return next_idx
            return (index + 1 < step && index + 1 < count) ? index + 1 : -1
        }
    }),
    random_sample: Object.freeze({
        next: function(index, count, mask= 0) {
            if ((mask & LIBCD_VOLE_MASK.activity.busy) === LIBCD_VOLE_MASK.activity.busy) return -1
            return Math.floor(Math.random() * count)
        }
    })
})

/**
 * internal registries for volume ids and active instances
 */
const _known_volume_ids= new Map() // hardware_id -> metadata { type, species, first_seen, last_seen }
const _active_volumes= new Map()   // volume_id or hardware_id -> libcd_Volume instance

/**
 * register a unique known volume id (hardware_id or uuid) into the global registry of all known possible unique volume ids
 */
export function volume_add_known_id(hardware_id, metadata= {}) {
    if (!hardware_id) return false
    var existing= _known_volume_ids.get(hardware_id) || {}
    _known_volume_ids.set(hardware_id, Object.assign({
        first_seen: Date.now(),
        type: 'ssd',
        species: 'fixed'
    }, existing, metadata, { last_seen: Date.now() }))
    return true
}

/**
 * check if a unique volume id is known across all possible unique ids
 */
export function volume_has_known_id(hardware_id) {
    return _known_volume_ids.has(hardware_id)
}

/**
 * get metadata for a specific known volume id
 */
export function volume_get_known_metadata(hardware_id) {
    return _known_volume_ids.get(hardware_id) || null
}

/**
 * get all known possible unique volume ids (`uuid`s / hardware IDs) and their metadata
 */
export function volume_get_known_ids() {
    return new Map(_known_volume_ids)
}

/**
 * register an active, mounted volume into the set of current known active and valid volumes
 */
export function volume_add_active(volume_instance, volume_id) {
    if (!volume_instance) return false
    var id= volume_id || volume_instance.hardware_id || volume_instance.d?.identifiers?.[0] || (`vol_` + _active_volumes.size)
    volume_instance.hardware_id= id
    _active_volumes.set(id, volume_instance)
    volume_add_known_id(id, { type: volume_instance.type, species: volume_instance.species })
    return id
}

/**
 * remove an active volume when unmounted/inactive
 */
export function volume_remove_active(volume_id) {
    return _active_volumes.delete(volume_id)
}

/**
 * get the current known active and valid volumes
 */
export function volume_get_active_volumes() {
    return new Map(_active_volumes)
}

/**
 * clear registries (for testing and clean state resets)
 */
export function volume_clear_registries() {
    _known_volume_ids.clear()
    _active_volumes.clear()
}

/**
 * space-prefixed dual surface vole mask helper functions for checking and applying masks behaviorally
 * strictly uses unsigned 32-bit integer boundaries (`>>> 0`) per bitwise quirks
 */
export function volume_has_mask(current_mask, target_mask) {
    return (current_mask & target_mask) === target_mask
}

export function volume_add_mask(current_mask, target_mask) {
    return (current_mask | target_mask) >>> 0
}

export function volume_clear_mask(current_mask, target_mask) {
    return (current_mask & ~target_mask) >>> 0
}

/**
 * functional primitive for volume imprinting (Dual Surface API)
 * creates user space ownership manifest in root `\libcd\var\db` without tripping endpoint security
 * registers hardware_id into known and active sets
 */
export async function volume_imprint(target, hardware_id, imprint_options= {}) {
    if (target) target.imprinted = true
    if (hardware_id) {
        volume_add_known_id(hardware_id, { type: target.type, species: target.species, imprinted: true })
        volume_add_active(target, hardware_id)
    }

    if (target.species === 'fixed' && imprint_options.skip_fixed === true) {
        return true
    }

    return operation_run_pipeline(target, async function imprint_step() {
        target.activity_mask= volume_add_mask(target.activity_mask, LIBCD_VOLE_MASK.activity.write)
        try {
            // write ownership manifest to `\libcd\var\db` using the 32-bit magic imprint
            var manifest_payload= new Uint32Array([LIBCD_IMPRINT_MAGIC, hardware_id || 0x0])
            // TODO (matt): fs.writeFile(volume_root + '\\libcd\\var\\db\\imprint.bin', manifest_payload)

            await libcd_micro_pause.yield(target, 'imprint_write')
        } finally {
            target.activity_mask= volume_clear_mask(target.activity_mask, LIBCD_VOLE_MASK.activity.write)
        }
    }, { max_retries: 3 })
}

export class libcd_Volume {
    constructor(options= {}) {
        var opts= options || {}
        this.type= arg_get_opt(opts, 'type', 'ssd') || 'ssd'
        this.species= arg_get_opt(opts, 'species', null) || LIBCD_VOL_TYPE[this.type]?.species || 'fixed'
        var identifiers= arg_get_opt(opts, 'identifiers', null) || []
        this.hardware_id= arg_get_opt(opts, 'hardware_id', null) || identifiers[0] || null
        
        this.removable = arg_get_opt(opts, 'removable', this.species === 'removable' || this.species === 'volatile') || false
        this.added_by_default = arg_get_opt(opts, 'added_by_default', false) || false
        this.imprinted = arg_get_opt(opts, 'imprinted', false) || false

        // initialize behavioral vole masks
        this.acl_mask= LIBCD_VOLE_MASK.acl.probe_name_records | LIBCD_VOLE_MASK.acl.descend_root | LIBCD_VOLE_MASK.acl.descend_children
        if (LIBCD_VOL_TYPE[this.type]?.io_exclusive) {
            this.acl_mask= volume_add_mask(this.acl_mask, LIBCD_VOLE_MASK.acl.must_io_exclusive)
        }
        
        this.read_mask= LIBCD_VOLE_MASK.read.query_root_dirs | LIBCD_VOLE_MASK.read.query_root_children | LIBCD_VOLE_MASK.read.seek_node_size
        this.speed_mask= LIBCD_VOL_SPECIES[this.species]?.default_speed || LIBCD_VOLE_MASK.speed.careful_ramp
        this.activity_mask= LIBCD_VOLE_MASK.activity.present
        this.history_mask= 0

        this.d= {
            type_log: [],
            identifiers: identifiers || (this.hardware_id ? [this.hardware_id] : []),
            acl_log: []
        }

        if (this.hardware_id) {
            volume_add_known_id(this.hardware_id, {
                type: this.type,
                species: this.species,
                removable: this.removable,
                added_by_default: this.added_by_default,
                imprinted: this.imprinted
            })
            volume_add_active(this, this.hardware_id)
        }
    }

    set_type(type) {
        this.type= type
        this.species= LIBCD_VOL_TYPE[type]?.species || 'fixed'
        if (LIBCD_VOL_TYPE[type]?.io_exclusive) {
            this.acl_mask= volume_add_mask(this.acl_mask, LIBCD_VOLE_MASK.acl.must_io_exclusive)
        } else {
            this.acl_mask= volume_clear_mask(this.acl_mask, LIBCD_VOLE_MASK.acl.must_io_exclusive)
        }
    }

    /**
     * class wrapper delegating to functional primitive volume_imprint
     */
    async imprint(hardware_id, imprint_options= {}) {
        return volume_imprint(this, hardware_id, imprint_options)
    }
}
