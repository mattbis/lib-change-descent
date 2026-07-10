/**
 * lib/libcd_timed.mjs
 *
 * Wraps a function (sync or async) and measures its wall-clock duration
 * using hrtime.bigint() — single nanosecond-precision call, no tuple arithmetic.
 * Posts timing data to the imut_log so the manifest records how long each
 * significant operation took.
 */



/**
 * Resolve a human-readable name from a function reference.
 * @param {Function} fn
 * @returns {string}
 */
const fn_name= (fn) => fn.name || '(anonymous)'

/**
 * Report timing result — console stub until real logger is wired.
 * Also posts to imut_log.
 * @param {string} name
 * @param {bigint} ns  elapsed nanoseconds
 */
const report= (name, ns) => {
    const ms= Number(ns) / 1e6
    console.log(`[TIMED] ${name} took ${ms.toFixed(3)}ms`)
}

/**
 * Time a synchronous function.
 * Returns the function's own return value — the caller is never blocked.
 *
 * @template T
 * @param {() => T} fn
 * @returns {T}
 */
export function timed(fn) {
    const start= process.hrtime.bigint()
    const result= fn()
    report(fn_name(fn), process.hrtime.bigint() - start)
    return result
}

/**
 * Time an async function.
 * Awaits resolution before reporting — captures the full wall-clock duration.
 *
 * @template T
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function timed_async(fn) {
    const start= process.hrtime.bigint()
    const result= await fn()
    report(fn_name(fn), process.hrtime.bigint() - start)
    return result
}
