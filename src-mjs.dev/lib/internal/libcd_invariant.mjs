// TODO (matt): used when -D someting i havent decided is switched on....

export function invariant(condition, message) {
    if (!condition) throw new Error(`[INTERNAL_INVARIANT]: ${message}`)
}

// TODO (matt): the runtime can operate in modes, which mean the severity of assertions 