/** Exported memory */
export declare const memory: WebAssembly.Memory;
/**
 * assembly/blake3/blake3
 * @param input `~lib/typedarray/Uint8Array`
 * @returns `~lib/typedarray/Uint8Array`
 */
export declare function blake3(input: Uint8Array): Uint8Array;
/**
 * assembly/blake3/blake3Hex
 * @param input `~lib/typedarray/Uint8Array`
 * @returns `~lib/string/String`
 */
export declare function blake3Hex(input: Uint8Array): string;
/**
 * assembly/blake3/createHasher
 * @returns `assembly/blake3/Blake3Hasher`
 */
export declare function createHasher(): __Internref7;
/**
 * assembly/blake3/update
 * @param hasher `assembly/blake3/Blake3Hasher`
 * @param input `~lib/typedarray/Uint8Array`
 */
export declare function update(hasher: __Internref7, input: Uint8Array): void;
/**
 * assembly/blake3/finalize
 * @param hasher `assembly/blake3/Blake3Hasher`
 * @returns `~lib/typedarray/Uint8Array`
 */
export declare function finalize(hasher: __Internref7): Uint8Array;
/** assembly/blake3/Blake3Hasher */
declare class __Internref7 extends Number {
  private __nominal7: symbol;
  private __nominal0: symbol;
}
