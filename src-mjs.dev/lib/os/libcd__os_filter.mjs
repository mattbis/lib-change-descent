/**
 * OS filesystem exclusion filter engine (`libcd__os_filter.mjs`).
 * 
 * always runs when querying structures of disk contents via `os_fs`.
 * works in strict precedence hierarchy (`FILTER_PRECEDENCE`):
 *   0: LIB_DEFAULT — built-in defaults for the operating system (`WIN_FILTERS`, `NIX_FILTERS`, `OSX_FILTERS`).
 *   1: ETC_DEFAULT — configuration release `.0.` rules parsed at boot time.
 *   2: APP_DYNAMIC — connected application or standalone call adding dynamic exemptions at runtime.
 * 
 * attributes/mode bit checking (`attrib bit check`) is avoided for high-speed scanning (`O(1)` bounds).
 * instead, exact filename, extension, and path prefix matching is evaluated in constant/linear time.
 * records whenever skipped files/directories are missed and keeps an immutable audit log (`IMUT_LOG`).
 */

// 1p
import process from 'node:process'
import { basename, extname } from 'node:path'

// 2p
import { post } from '../internal/imut_log/libcd_imut_log.mjs'
import { make_entry } from '../internal/imut_log/libcd_imut_log_entry.mjs'

export const WIN_FILTERS = Object.freeze({
    path_prefixes: Object.freeze(['$Recycle.Bin', 'System Volume Information', 'Windows\\System32', 'Windows\\SysWOW64', 'Config.Msi']),
    filenames: Object.freeze(['pagefile.sys', 'hiberfil.sys', 'swapfile.sys', 'DumpStack.log.tmp', '$MFT', '$LogFile', '$Volume', '$Bitmap', '$Boot', '$BadClus']),
    extensions: Object.freeze(['.tmp', '.log', '.lock'])
})

export const NIX_FILTERS = Object.freeze({
    path_prefixes: Object.freeze(['/proc', '/sys', '/dev', '/run', '/tmp', 'lost+found', '/var/run', '/var/lock']),
    filenames: Object.freeze(['.bash_history', '.node_repl_history', '.lesshst']),
    extensions: Object.freeze(['.tmp', '.log', '.pid', '.lock'])
})

export const OSX_FILTERS = Object.freeze({
    path_prefixes: Object.freeze(['.Spotlight-V100', '.Trashes', '.fseventsd', '.TemporaryItems', '/.MobileBackups', '/dev', '/proc', '/sys']),
    filenames: Object.freeze(['.DS_Store', '.VolumeIcon.icns', '._.DS_Store']),
    extensions: Object.freeze(['.tmp', '.log', '.lock'])
})

export const FILTER_PRECEDENCE = Object.freeze({
    LIB_DEFAULT: 0,
    ETC_DEFAULT: 1,
    APP_DYNAMIC: 2
})

var _filter_layers = [
    { path_prefixes: new Set(), filenames: new Set(), extensions: new Set() },
    { path_prefixes: new Set(), filenames: new Set(), extensions: new Set() },
    { path_prefixes: new Set(), filenames: new Set(), extensions: new Set() }
]

var _skip_metrics = {
    total_skipped: 0,
    by_precedence: { 0: 0, 1: 0, 2: 0 },
    by_type: { path_prefixes: 0, filenames: 0, extensions: 0 }
}

var _initialized = false

/**
 * initializes Layer 0 (`LIB_DEFAULT`) based on `process.platform`.
 */
export function os_filter_init(force= false) {
    if (_initialized && !force) return
    _filter_layers[0].path_prefixes.clear()
    _filter_layers[0].filenames.clear()
    _filter_layers[0].extensions.clear()

    var defaults= process.platform === 'win32' ? WIN_FILTERS : (process.platform === 'darwin' ? OSX_FILTERS : NIX_FILTERS)
    
    var i= 0
    if (defaults.path_prefixes) {
        for (i= 0; i < defaults.path_prefixes.length; i++) {
            _filter_layers[0].path_prefixes.add(defaults.path_prefixes[i])
        }
    }
    if (defaults.filenames) {
        for (i= 0; i < defaults.filenames.length; i++) {
            _filter_layers[0].filenames.add(defaults.filenames[i])
        }
    }
    if (defaults.extensions) {
        for (i= 0; i < defaults.extensions.length; i++) {
            _filter_layers[0].extensions.add(defaults.extensions[i].toLowerCase())
        }
    }
    _initialized = true
}

/**
 * adds a filter rule (`value`) to a specified precedence level (`level`: 0, 1, or 2)
 * under `type` (`'path_prefixes'`, `'filenames'`, or `'extensions'`).
 */
export function os_filter_add(level, type, value) {
    if (level < 0 || level > 2) throw new Error('[OS_FILTER] Invalid precedence level: ' + level)
    if (!_filter_layers[level][type]) throw new Error('[OS_FILTER] Invalid filter type: ' + type)
    _filter_layers[level][type].add(type === 'extensions' ? value.toLowerCase() : value)
}

/**
 * removes a filter rule from a specified precedence level.
 */
export function os_filter_remove(level, type, value) {
    if (level >= 0 && level <= 2 && _filter_layers[level][type]) {
        _filter_layers[level][type].delete(type === 'extensions' ? value.toLowerCase() : value)
    }
}

/**
 * clears all dynamic (`APP_DYNAMIC` 2) and config (`ETC_DEFAULT` 1) filters and resets metrics.
 */
export function os_filter_reset(clear_metrics= false) {
    _filter_layers[1].path_prefixes.clear()
    _filter_layers[1].filenames.clear()
    _filter_layers[1].extensions.clear()
    _filter_layers[2].path_prefixes.clear()
    _filter_layers[2].filenames.clear()
    _filter_layers[2].extensions.clear()
    if (clear_metrics) {
        _skip_metrics.total_skipped= 0
        _skip_metrics.by_precedence[0]= 0
        _skip_metrics.by_precedence[1]= 0
        _skip_metrics.by_precedence[2]= 0
        _skip_metrics.by_type.path_prefixes= 0
        _skip_metrics.by_type.filenames= 0
        _skip_metrics.by_type.extensions= 0
    }
    os_filter_init(true)
}

/**
 * records an immutable log event when a filesystem node is filtered/skipped.
 */
function os_filter_record_skip(filepath, level, type, reason) {
    _skip_metrics.total_skipped= _skip_metrics.total_skipped + 1
    _skip_metrics.by_precedence[level]= (_skip_metrics.by_precedence[level] || 0) + 1
    _skip_metrics.by_type[type]= (_skip_metrics.by_type[type] || 0) + 1

    post(make_entry('OS_CALL', 'FS_FILTER_SKIP', {
        path: filepath,
        precedence: level,
        type: type,
        reason: reason
    }))
}

/**
 * fast $O(1)$ / linear evaluation check. returns `{ blocked: true, level, type, reason }`
 * if the path should be skipped, or `{ blocked: false }` if clean to parse.
 */
export function os_filter_check(filepath) {
    if (!_initialized) os_filter_init()
    if (!filepath || typeof filepath !== 'string') return { blocked: true, level: 0, type: 'invalid', reason: 'null_path' }

    var filename= basename(filepath)
    var ext= extname(filepath).toLowerCase()

    // evaluate in precedence hierarchy: level 2 (`APP_DYNAMIC`), then 1 (`ETC_DEFAULT`), then 0 (`LIB_DEFAULT`)
    for (var level= 2; level >= 0; level--) {
        var layer= _filter_layers[level]

        // check exact filename
        if (layer.filenames.has(filename)) {
            os_filter_record_skip(filepath, level, 'filenames', filename)
            return { blocked: true, level: level, type: 'filenames', reason: filename }
        }

        // check extension
        if (ext && layer.extensions.has(ext)) {
            os_filter_record_skip(filepath, level, 'extensions', ext)
            return { blocked: true, level: level, type: 'extensions', reason: ext }
        }

        // check path prefixes (substring/prefix check across known forbidden patterns)
        for (var prefix of layer.path_prefixes) {
            if (filepath.includes(prefix)) {
                os_filter_record_skip(filepath, level, 'path_prefixes', prefix)
                return { blocked: true, level: level, type: 'path_prefixes', reason: prefix }
            }
        }
    }

    return { blocked: false }
}

/**
 * returns a snapshot of filter skip audit metrics across all precedence levels.
 */
export function os_filter_get_metrics() {
    return {
        total_skipped: _skip_metrics.total_skipped,
        by_precedence: Object.assign({}, _skip_metrics.by_precedence),
        by_type: Object.assign({}, _skip_metrics.by_type)
    }
}

// auto-init Layer 0 at module load
os_filter_init()
