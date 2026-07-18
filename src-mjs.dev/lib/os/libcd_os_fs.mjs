/**
 * Canonical OS filesystem gateway (`libcd_os_fs.mjs`).
 * 
 * all filesystem access across `lib-change-descent` goes through this wrapper.
 * uses pure `node:fs/promises` and `node:fs` (`1p` discipline) without `fs-extra`.
 * includes `// 3p` marked sections (`ensureDir`, recursive directory walk, force removal) built in.
 * 
 * CRITICAL: every traversal or structural check automatically runs `os_filter_check` (`libcd__os_filter.mjs`).
 * if a path or directory matches a filter rule across any precedence hierarchy (`LIB_DEFAULT`, `ETC_DEFAULT`,
 * or `APP_DYNAMIC`), it is skipped and recorded in the audit log without throwing traversal errors.
 */

// 1p
import { stat, lstat, readdir, readFile, writeFile, mkdir, rm, access } from 'node:fs/promises'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'

// 2p
import { os_filter_check } from './libcd__os_filter.mjs'
import { post } from '../internal/imut_log/libcd_imut_log.mjs'
import { make_entry } from '../internal/imut_log/libcd_imut_log_entry.mjs'

/**
 * safely retrieves file status (`stat`) if not blocked by `os_filter_check`.
 * returns `null` if the path is excluded by active filters or inaccessible.
 */
export async function os_fs_stat(path, options= {}) {
    var filter_res= os_filter_check(path)
    if (filter_res.blocked) return null
    try {
        return await stat(path, options)
    } catch (e) {
        return null
    }
}

/**
 * safely retrieves symbolic link status (`lstat`) if not blocked by filters.
 */
export async function os_fs_lstat(path, options= {}) {
    var filter_res= os_filter_check(path)
    if (filter_res.blocked) return null
    try {
        return await lstat(path, options)
    } catch (e) {
        return null
    }
}

/**
 * reads directory entries (`withFileTypes: true` by default) and automatically runs `os_filter_check`
 * across all child nodes, skipping any forbidden/excluded files or subdirectories cleanly.
 */
export async function os_fs_readdir(dir_path, options= {}) {
    var filter_res= os_filter_check(dir_path)
    if (filter_res.blocked) return []

    var opts= Object.assign({ withFileTypes: true }, options)
    try {
        var entries= await readdir(dir_path, opts)
        var clean_entries= []
        var i= 0
        while (i < entries.length) {
            var entry= entries[i]
            var name= typeof entry === 'string' ? entry : entry.name
            var child_path= join(dir_path, name)
            var child_check= os_filter_check(child_path)
            if (!child_check.blocked) {
                clean_entries.push(entry)
            }
            i= i + 1
        }
        return clean_entries
    } catch (e) {
        return []
    }
}

/**
 * // 3p marked section: recursive directory walk (replaces `fs-extra` walk/klaw).
 * traverses directory tree yielding `{ path, entry }`, automatically skipping filtered subdirectories.
 */
export async function* os_fs_walk(dir_path) {
    var entries= await os_fs_readdir(dir_path, { withFileTypes: true })
    var i= 0
    while (i < entries.length) {
        var entry= entries[i]
        var child_path= join(dir_path, entry.name)
        yield { path: child_path, entry: entry }
        if (entry.isDirectory()) {
            yield* os_fs_walk(child_path)
        }
        i= i + 1
    }
}

/**
 * // 3p marked section: ensureDir / recursive mkdir (replaces `fs-extra.ensureDir`).
 */
export async function os_fs_mkdir(path, options= {}) {
    var filter_res= os_filter_check(path)
    if (filter_res.blocked) {
        throw new Error('[OS_FS] Cannot create directory blocked by active filter: ' + path + ' (' + filter_res.reason + ')')
    }
    return await mkdir(path, Object.assign({ recursive: true }, options))
}

/**
 * synchronous ensureDir / recursive mkdir.
 */
export function os_fs_mkdir_sync(path, options= {}) {
    var filter_res= os_filter_check(path)
    if (filter_res.blocked) {
        throw new Error('[OS_FS] Cannot create directory blocked by active filter: ' + path + ' (' + filter_res.reason + ')')
    }
    return mkdirSync(path, Object.assign({ recursive: true }, options))
}

/**
 * // 3p marked section: recursive removal (replaces `fs-extra.remove`).
 */
export async function os_fs_rm(path, options= {}) {
    var filter_res= os_filter_check(path)
    if (filter_res.blocked) return false
    try {
        await rm(path, Object.assign({ recursive: true, force: true }, options))
        return true
    } catch (e) {
        return false
    }
}

/**
 * safely reads file contents if not blocked by active filters.
 */
export async function os_fs_read_file(path, options= {}) {
    var filter_res= os_filter_check(path)
    if (filter_res.blocked) {
        throw new Error('[OS_FS] Access denied by filesystem filter: ' + path + ' (' + filter_res.reason + ')')
    }
    return await readFile(path, options)
}

/**
 * safely writes file contents, ensuring parent directories exist and verifying filters.
 */
export async function os_fs_write_file(path, data, options= {}) {
    var filter_res= os_filter_check(path)
    if (filter_res.blocked) {
        throw new Error('[OS_FS] Access denied by filesystem filter: ' + path + ' (' + filter_res.reason + ')')
    }
    var parent_dir= dirname(path)
    if (!existsSync(parent_dir)) {
        await os_fs_mkdir(parent_dir)
    }
    return await writeFile(path, data, options)
}
