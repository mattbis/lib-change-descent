/**
 * Linux & Nix default filesystem exclusions (`NIX_FILTERS`) (`LIB_DEFAULT` level 0).
 * exempts virtual kernel filesystems (`/proc`, `/sys`, `/dev`), temporary run paths (`/run`, `/var/run`),
 * and volatile history files.
 */

export const NIX_FILTERS = Object.freeze({
    path_prefixes: Object.freeze([
        '/proc',
        '/sys',
        '/dev',
        '/run',
        '/tmp',
        'lost+found',
        '/var/run',
        '/var/lock'
    ]),
    filenames: Object.freeze([
        '.bash_history',
        '.node_repl_history',
        '.lesshst'
    ]),
    extensions: Object.freeze([
        '.tmp',
        '.log',
        '.pid',
        '.lock'
    ])
})
