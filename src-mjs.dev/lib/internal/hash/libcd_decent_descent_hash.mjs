/** 
 * robotic decent descent float hash - zero-allocation, zero-string-decoding non-cryptographic
 * hierarchical hashing algorithm operating in the [0, 1) float64 domain.
 */

// 1p math constants
export const K_1= Math.SQRT2 // ~1.4142135623730951
export const K_2= Math.sqrt(3) // ~1.7320508075688772
export const K_3= Math.sqrt(5) // ~2.2360679774997897
export const K_4= Math.sqrt(7) // ~2.6457513110645906

/**
 * fractional part hashing keeping accumulator bounded within [0, 1)
 */
export function fract(x) {
    return x - Math.floor(x)
}

/**
 * single node hash calculated directly from primitive float values
 */
export function compute_single_hash(mtime, size, id) {
    var h_time= fract(mtime * K_1)
    var h_size= fract(size * K_2)
    var h_id= fract(id * K_3)
    return fract(h_time + h_size + h_id)
}

/**
 * single node hash computed via zero-gc node accessor struct
 */
export function compute_node_hash(accessor, id) {
    var mtime= accessor.get_m_time(id)
    var size= accessor.get_size(id)
    return compute_single_hash(mtime, size, id)
}

/**
 * hierarchical descent hash for directories
 * sums child hashes in strict ascending order of creation / node ID for exact float determinism
 */
export function compute_descent_hash(accessor, dir_id, children_ids) {
    var dir_hash= compute_node_hash(accessor, dir_id)
    return compute_dir_hash(dir_hash, children_ids, accessor)
}

/**
 * computes dir hash given pre-computed dir_hash and children ids/hashes
 */
export function compute_dir_hash(dir_node_hash, children_ids_or_hashes, accessor= null) {
    var sum= dir_node_hash * K_4
    var len= children_ids_or_hashes.length
    for (var i= 0; i < len; i++) {
        var child_val= children_ids_or_hashes[i]
        var child_hash= (accessor === null) ? child_val : compute_node_hash(accessor, child_val)
        sum= sum + (child_hash * K_1)
    }
    return fract(sum)
}

/**
 * incremental bubble-up hash update for fixed volumes (O(1) complexity)
 * when a child node changes, updates parent hash without re-scanning siblings
 */
export function bubble_incremental_hash(parent_old_hash, child_old_hash, child_new_hash) {
    var delta= (child_new_hash * K_1) - (child_old_hash * K_1)
    return fract(parent_old_hash + delta)
}

/**
 * stochastic sampling probe for volatile volumes
 * calculates hash from root dir plus a rolling subset of N sample node IDs
 */
export function compute_volatile_probe_hash(accessor, root_id, sample_ids) {
    var root_h= compute_node_hash(accessor, root_id)
    return compute_dir_hash(root_h, sample_ids, accessor)
}
