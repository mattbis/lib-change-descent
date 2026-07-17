/// libcd.configure

/// is teh base configuration layer, everything else is on top of this... per session., each session is unique

export const CONFIG_PRECEDENCE= {
    'static':0,
    'command':1,
    'manifest':2
}

/** 
 * options allows programmatic overriding of configuration
 */
export function configure(options= {}) {
    
}

/** 
 * synchronous function to execute order of predecence
 */
export function config_gather() {}

/**
 * resolve files in order... allow patches????
 */ 
export function config_gather_reduce() {}

/**
 * changes teh actual runtime .... compound
 */
export function config_set() {}
export function config_get() {}

export function config_ispath() {}
/** 
 * get or set path
 */
export function config_path() {}

/**
 * files must be in where it expects... 
 */

// for a config path get defaults.... 
export function _config_defaults() {}

export function _config_from_env() {}
export function _config_from_file() {}

// TODO (matt): os/win/_config_from_registry() {} , .config , 
// TODO (matt): should all config be actually interchangeable to allow exchange of manifests? probably almost certainly yes ... XML, Yaml, or json, or all of them

// export const CONFIG_MOD= {
//     'main': 0,
//     'file': 1,
//     'env': 2
// }

/**
 * create a config bundle in exchangeable format
 **/
export function _config_export(options= {format: 0}) {}

