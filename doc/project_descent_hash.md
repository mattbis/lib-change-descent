# Descent Hash: Design Proposal

A lightweight, non-cryptographic, zero-allocation hierarchical hashing algorithm designed to detect state changes in a volume's descent tree. It targets maximum mechanical sympathy with JS/V8 engines by using floating-point arithmetic rather than integer bitwise or string manipulations.

---

## 1. Core Objectives

1. **Zero String Decoding:** Never call `TextDecoder` or string comparators. Compute hashes directly from raw binary buffers (`f64_view` and `i32_view`).
2. **Zero GC Allocation:** Execute using native JavaScript `Number` primitives (double-precision floats) without creating objects, arrays, or BigInts.
3. **Speed over Cryptographic Security:** The goal is detection of changes (drift, modification, addition, deletion), not protection against malicious manipulation.
4. **Volume Adaptability:** Adapt computation strategy based on volume species (Fixed, Volatile, Virtual).

---

## 2. Mathematical Formulation: The "Float Hash"

JavaScript represents all numbers as 64-bit IEEE 754 double-precision floats. Instead of typical 32-bit integer hashing (which forces V8 to convert back and forth between float registers and 32-bit integer representations), the **Descent Hash** operates entirely in the $[0, 1)$ float domain.

### A. Fractional Part Hashing (`descenthash_fract`)
For any float value $x$, we define the fractional function $F(x)$:

```math
F(x) = x - \lfloor x \rfloor
```

In JavaScript (`libcd_descent_hash.mjs`):
```javascript
export function descenthash_fract(x) {
    return x - Math.floor(x)
}
```

Using fractional parts keeps the accumulator bounded within $[0, 1)$, completely preventing overflow issues or loss of precision from large numbers.

### B. Single Node Hash (`descenthash_compute_single`)
Each node in the 32-byte stride buffer contains metadata at fixed offsets:
* **Node ID** (derived from its stride index)
* **Parent ID** (bytes 4–7, `i32_view`)
* **mtime** (bytes 16–23, `f64_view`)
* **size** (bytes 24–27 or 24–31, depending on layout)

We define irrational scaling factors ($k_1, k_2, k_3, k_4$) (`descenthash_k1` .. `descenthash_k4`) to disperse values across the floating-point domain:

```math
\begin{aligned}
k_1 &= \sqrt{2} \approx 1.4142135623730951 \\
k_2 &= \sqrt{3} \approx 1.7320508075688772 \\
k_3 &= \sqrt{5} \approx 2.2360679774997897 \\
k_4 &= \sqrt{7} \approx 2.6457513110645906
\end{aligned}
```

For node $i$:

```math
H_{\text{node}}(i) = F\left( F(\text{mtime}_i \cdot k_1) + F(\text{size}_i \cdot k_2) + F(i \cdot k_3) \right)
```

In JavaScript:
```javascript
export function descenthash_compute_single(mtime, size, id) {
    var h_time= descenthash_fract(mtime * descenthash_k1)
    var h_size= descenthash_fract(size * descenthash_k2)
    var h_id= descenthash_fract(id * descenthash_k3)
    return descenthash_fract(h_time + h_size + h_id)
}
```

### C. Hierarchical Aggregation (`descenthash_compute_dir`)
To compute a directory's hash from its children without strict sorting (which causes allocations and CPU cycles):

```math
H_{\text{dir}} = F\left( H_{\text{node}}(\text{dir}) \cdot k_4 + \sum_{c \in \text{children}} \left( H_{\text{node}}(c) \cdot k_1 \right) \right)
```

*Note on Determinism:* Since floating-point addition is not strictly associative due to rounding limits, we sum children in strict ascending order of their `Node ID` (which is already sorted sequentially in the heap layout by creation order).

---

## 3. Volume Species Adaptation

### A. Volatile Volumes (`descenthash_probe_volatile`)
* **The Problem:** Rapid changes. Walking the entire tree on every operation is too expensive.
* **The Strategy (Stochastic Sampling):** 
  * Do not calculate the full tree. 
  * Calculate $H$ of the root directory plus a pseudo-random subset of nodes based on a sliding index pointer (a "rolling probe" of $N$ nodes per operation).
  * Check the filesystem's global file count or transaction sequence number as a cheap fast-path detector.

### B. Fixed Volumes (`descenthash_update_bubble`)
* **The Problem:** Massive capacity, but slower/ordered drift.
* **The Strategy (Incremental Hashing):**
  * Store node hashes in the buffer itself (reserving 4 or 8 bytes of the 32-byte stride for the node's cached hash).
  * When a file node changes, calculate its new $H_{\text{node}}$.
  * Bubble the change up to its parent (`descenthash_update_bubble`) by executing:

```math
H_{\text{parent-new}} = F\left( H_{\text{parent-old}} - H_{\text{child-old}} \cdot k_1 + H_{\text{child-new}} \cdot k_1 \right)
```

In JavaScript ($O(1)$ bubble update):
```javascript
export function descenthash_update_bubble(parent_old_hash, child_old_hash, child_new_hash) {
    var delta= (child_new_hash * descenthash_k1) - (child_old_hash * descenthash_k1)
    return descenthash_fract(parent_old_hash + delta)
}
```

  * This allows $O(1)$ complexity updates for file writes without re-scanning the entire volume.

### C. Virtual Volumes (e.g., dynamic overlay, VM files)
* **The Problem:** The underlying data doesn't physically exist in a standard structure.
* **The Strategy (On-Demand Hashing):**
  * The hash is computed only when queries hit the edge interfaces.
  * We use dirty bits in the node metadata. When an action is instigated, mark the parent tree dirty. Recompute the float hash lazily when requested.
