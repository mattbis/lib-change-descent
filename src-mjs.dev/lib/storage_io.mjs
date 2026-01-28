// 1p
// 2p
// 3p
import {}

/**
 * storage_io provides two interfaces: temporary and persistent
 * 
 * these are configured via the main session and configure 
 */

export const STORAGE_IO_PRIORTY= {
  FG: 0,
  BG: 1
}

export const STORAGE_IO_HASH= {

}

/** get or set a  storage record */
export function stor_record(stor_record_id/* hash */, data/* blob */ ) {
}

/** write a blob */
export function stor_write(stor_record_id/* hash */, data/* blob */ ) {
}

/**
 * 
 * @param {Blob} data 
 * @returns {Promise<string>} hash
 */
export function stor_tmp(arg_one/* id or blob */ ) {
  /* if arg 1 is id return blob, otherwise store blob */
  const p= Promise.resolve()
  return p
}
