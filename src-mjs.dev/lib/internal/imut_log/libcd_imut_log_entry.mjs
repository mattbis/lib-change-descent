/**
 * imut_log entry shape.
 * Every operation that posts to the imut_log must produce one of these.
 * Kept as a plain object — no class, no GC pressure.
 */

/** @typedef {'OS_CALL' | 'NODE_WRITE' | 'VOL_EVENT' | 'SESSION'} ImutLogKind */

/**
 * @param {ImutLogKind} kind   - broad category of operation
 * @param {string}      op     - specific operation name e.g. 'WMIC_CALL'
 * @param {unknown}     data   - op-specific payload, keep small
 * @returns {{ kind: ImutLogKind, op: string, ts: number, data: unknown }}
 */
export const make_entry= (kind, op, data) => ({
    kind,
    op,
    ts: Date.now(),
    data
})
