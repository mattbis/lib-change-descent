# Decent Descent Float Hash: Design Proposal

A lightweight, non-cryptographic, zero-allocation hierarchical hashing algorithm designed to detect state changes in a volume's descent tree. It targets maximum mechanical sympathy with JS/V8 engines by using floating-point arithmetic rather than integer bitwise or string manipulations.

---

## 1. Core Objectives

1. **Zero String Decoding:** Never call `TextDecoder` or string comparators. Compute hashes directly from raw binary buffers (`f64_view` and `i32_view`).
2. **Zero GC Allocation:** Execute using native JavaScript `Number` primitives (double-precision floats) without creating objects, arrays, or BigInts.
3. **Speed over Cryptographic Security:** The goal is detection of changes (drift, modification, addition, deletion), not protection against malicious manipulation.
4. **Volume Adaptability:** Adapt computation strategy based on volume species (Fixed, Volatile, Virtual).

---

## 2. Mathematical Formulation: The "Float Hash"

JavaScript represents all numbers as 64-bit IEEE 754 double-precision floats. Instead of typical 32-bit integer hashing (which forces V8 to convert back and forth between float registers and 32-bit integer representations), the **Decent Descent Hash** operates entirely in the $[0, 1)$ float domain.

### A. Fractional Part Hashing (`fract`)
For any float value $x$:

$$\text{fract}(x) = x - \lfloor x \rfloor$$

Using fractional parts keeps the accumulator bounded within $[0, 1)$, completely preventing overflow issues or loss of precision from large numbers.

### B. Single Node Hash
Each node in the 32-byte stride buffer contains metadata at fixed offsets:
* **Node ID** (derived from its stride index)
* **Parent ID** (bytes 4–7, `i32_view`)
* **mtime** (bytes 16–23, `f64_view`)
* **size** (bytes 24–27 or 24–31, depending on layout)

We define irrational scaling factors to disperse values:

$$K_1 = \sqrt{2} \approx 1.4142135623730951$$
$$K_2 = \sqrt{3} \approx 1.7320508075688772$$
$$K_3 = \sqrt{5} \approx 2.2360679774997897$$
$$K_4 = \sqrt{7} \approx 2.6457513110645906$$


For node $i$:

$$H_{\text{node}}(i) = \text{fract}\left( \text{fract}(\text{mtime}_i \cdot K_1) + \text{fract}(\text{size}_i \cdot K_2) + \text{fract}(i \cdot K_3) \right)$$

### C. Hierarchical Aggregation (Descent Hashing)
To compute a directory's hash from its children without strict sorting (which causes allocations and CPU cycles):

$$H_{\text{dir}} = \text{fract}\left( H_{\text{node}}(\text{dir}) \cdot K_4 + \sum_{c \in \text{children}} (H_{\text{node}}(c) \cdot K_1) \right)$$

*Note on Determinism:* Since floating-point addition is not strictly associative due to rounding limits, we sum children in strict ascending order of their `Node ID` (which is already sorted sequentially in the heap layout by creation order).

---

## 3. Volume Species Adaptation

### A. Volatile Volumes (e.g., RAM disk, Volatile USB)
* **The Problem:** Rapid changes. Walking the entire tree on every operation is too expensive.
* **The Strategy (Stochastic Sampling):** 
  * Do not calculate the full tree. 
  * Calculate $H$ of the root directory plus a pseudo-random subset of nodes based on a sliding index pointer (a "rolling probe" of $N$ nodes per operation).
  * Check the filesystem's global file count or transaction sequence number as a cheap fast-path detector.

### B. Fixed Volumes (e.g., SSD, HDD)
* **The Problem:** Massive capacity, but slower/ordered drift.
* **The Strategy (Incremental Hashing):**
  * Store node hashes in the buffer itself (reserving 4 or 8 bytes of the 32-byte stride for the node's cached hash).
  * When a file node changes, calculate its new $H_{\text{node}}$.
  * Bubble the change up to its parent by executing:

    $$H_{\text{parent-new}} = \text{fract}\left( H_{\text{parent-old}} - H_{\text{child-old}} \cdot K_1 + H_{\text{child-new}} \cdot K_1 \right)$$

  * This allows $O(1)$ complexity updates for file writes without re-scanning the entire volume.

### C. Virtual Volumes (e.g., dynamic overlay, VM files)
* **The Problem:** The underlying data doesn't physically exist in a standard structure.
* **The Strategy (On-Demand Hashing):**
  * The hash is computed only when queries hit the edge interfaces.
  * We use dirty bits in the node metadata. When an action is instigated, mark the parent tree dirty. Recompute the float hash lazily when requested.
