// TODO: (matt) used when -D someting i havent decided is switched on....

export function invariant(condition, message) {
    if (!condition) throw new Error(`[INTERNAL_INVARIANT]: ${message}`)
}
