/** 
 * base library constants 
 * these will eventually be schema generated in phase 2 
 * library releases are configured atop this base via etc/
 */

// core architectural constants
export const LIBCD_HEADER_SIZE= 64
export const LIBCD_MAGIC= 'LKMAN001' // the magic will jncrement.. then migration i possible if needed.... 
export const LIBCD_CONFIG= ''

// static release configuration (previously libcd_config.mjs)
// 0x118CD (hexspeak for 'libcd') - used as a user-space marker for disk imprint ownership manifests
export const LIBCD_IMPRINT_MAGIC= 0x118CD

// OS journal binary packet magic header
export const LIBCD_JOURNAL_MAGIC= 0xCDCD
