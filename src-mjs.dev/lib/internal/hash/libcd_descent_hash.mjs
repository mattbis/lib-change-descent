/** 
 * robotic descent float hash - zero-allocation, zero-string-decoding non-cryptographic
 * hierarchical hashing algorithm operating in the [0, 1) float64 domain.
 */

// 1p math constants
export const descenthash_k1= Math.SQRT2 // ~1.4142135623730951
export const descenthash_k2= Math.sqrt(3) // ~1.7320508075688772
export const descenthash_k3= Math.sqrt(5) // ~2.2360679774997897
export const descenthash_k4= Math.sqrt(7) // ~2.6457513110645906

/**
 * fractional part hashing keeping accumulator bounded within [0, 1)
 */
export function descenthash_fract(x) {
    return x - Math.floor(x)
}

/**
 * single node hash calculated directly from primitive float values
 */
export function descenthash_compute_single(mtime, size, id) {
    var h_time= descenthash_fract(mtime * descenthash_k1)
    var h_size= descenthash_fract(size * descenthash_k2)
    var h_id= descenthash_fract(id * descenthash_k3)
    return descenthash_fract(h_time + h_size + h_id)
}

/**
 * single node hash computed via zero-gc node accessor struct
 */
export function descenthash_compute_node(accessor, id) {
    var mtime= accessor.get_m_time(id)
    var size= accessor.get_size(id)
    return descenthash_compute_single(mtime, size, id)
}

/**
 * hierarchical descent hash for directories
 * sums child hashes in strict ascending order of creation / node ID for exact float determinism
 */
export function descenthash_compute_descent(accessor, dir_id, children_ids) {
    var dir_hash= descenthash_compute_node(accessor, dir_id)
    return descenthash_compute_dir(dir_hash, children_ids, accessor)
}

/**
 * computes dir hash given pre-computed dir_hash and children ids/hashes
 */
export function descenthash_compute_dir(dir_node_hash, children_ids_or_hashes, accessor= null) {
    var sum= dir_node_hash * descenthash_k4
    var len= children_ids_or_hashes.length
    for (var i= 0; i < len; i++) {
        var child_val= children_ids_or_hashes[i]
        var child_hash= (accessor === null) ? child_val : descenthash_compute_node(accessor, child_val)
        sum= sum + (child_hash * descenthash_k1)
    }
    return descenthash_fract(sum)
}

/**
 * incremental bubble-up hash update for fixed volumes (O(1) complexity)
 * when a child node changes, updates parent hash without re-scanning siblings
 */
export function descenthash_update_bubble(parent_old_hash, child_old_hash, child_new_hash) {
    var delta= (child_new_hash * descenthash_k1) - (child_old_hash * descenthash_k1)
    return descenthash_fract(parent_old_hash + delta)
}

/**
 * stochastic sampling probe for volatile volumes
 * calculates hash from root dir plus a rolling subset of N sample node IDs
 */
export function descenthash_probe_volatile(accessor, root_id, sample_ids) {
    var root_h= descenthash_compute_node(accessor, root_id)
    return descenthash_compute_dir(root_h, sample_ids, accessor)
}
