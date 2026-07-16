# JavaScript Bitwise Quirks and Limitations

When dealing with a low-level, zero-GC binary architecture in JavaScript, it is critical to understand how the engine handles bitwise operations. This document outlines the pitfalls and the mitigation strategies used in `lib-change-descent`.

## The 32-bit Signed Integer Coercion

In JavaScript, all numbers are fundamentally stored as 64-bit floating point (`Float64`). However, when you use a bitwise operator (`&`, `|`, `^`, `~`, `<<`, `>>`, `>>>`), V8 (and all JS engines) will immediately coerce the operand into a **32-bit signed integer**.

```javascript
let flag = 0b10000000_00000000_00000000_00000000; // Exceeds signed 32-bit max
console.log(flag | 0); // Output: -2147483648 (Silent coercion to negative)
```

### Why This Matters for Our Binary Layout

Our `NODE_STRIDE` is tightly packed:
*   We use a single `Uint8` byte for `Flags` (Offset 0).
*   Bitwise operations on `Uint8` values (`0` to `255`) are perfectly safe because they easily fit within the 32-bit bounds. `val | FLAG` works correctly.

However, as we expand to a 64-byte `NODE_STRIDE` for forensics and security mapping, we must be exceptionally careful:
*   **Do not use bitwise operators on 64-bit pointers or timestamps (like BTime).**
*   **Do not attempt to pack bitwise flags into a `Float64Array`.** Bitwise operators will instantly truncate the 64-bit float, permanently corrupting the data structure.

## Safe Usage Guidelines

1.  **Restrict Bitwise to 8-bit, 16-bit, and 32-bit Integers:** Only perform `&` and `|` operations on views pulled from `Uint8Array`, `Int32Array`, or `Uint32Array`.
2.  **Use `Atomics` for Thread Safety:** Since we intend to use `SharedArrayBuffer` for multi-threaded polling, standard operators (`|=`) are subject to race conditions. Always use `Atomics.or()`, `Atomics.and()`, `Atomics.load()`, and `Atomics.store()`. *Note: Atomics do not support Float64.*
3.  **BigInt for 64-bit Bitwise (If Necessary):** If a 64-bit bitmask is ever strictly required, you must use a `BigInt64Array` and append `n` to your literals (e.g., `1n << 60n`). Keep in mind that converting between standard JS numbers and `BigInt` carries a minor performance overhead, which can accumulate in a tight loop.

By isolating state flags strictly to the initial `Uint8` array segment (Offset 0), we avoid the coercion pitfalls entirely.
