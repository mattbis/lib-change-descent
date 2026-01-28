//1p
import { hrtime } from 'node:process'
import { performance } from 'node:perf_hooks'

/**
 * call a function and time it
 */
export function timed(fn) {
    const start= hrtime()
    const start_perf= performance.now()

    fn()
    
    const end= hrtime(start)
    const end_perf= performance.now() - start_perf
    // TODO(matt): noqa
    console.log(`${fn.name||fn.toString().split(" ")[1]} took ${end[0]}s ${end[1] / 1e6}ms (${end_perf}ms)`)
}