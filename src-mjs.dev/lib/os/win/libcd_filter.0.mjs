/**
 * Windows default filesystem exclusions (`WIN_FILTERS`) (`LIB_DEFAULT` level 0).
 * prevents expensive or illegal traversal into system swap/hibernate files, Volume Shadow Copy,
 * Recycle Bin, and core OS system directories (`doc/os_journal.md`).
 */

export const WIN_FILTERS = Object.freeze({
    path_prefixes: Object.freeze([
        '$Recycle.Bin',
        'System Volume Information',
        'Windows\\System32',
        'Windows\\SysWOW64',
        'Config.Msi'
    ]),
    filenames: Object.freeze([
        'pagefile.sys',
        'hiberfil.sys',
        'swapfile.sys',
        'DumpStack.log.tmp',
        '$MFT',
        '$LogFile',
        '$Volume',
        '$Bitmap',
        '$Boot',
        '$BadClus'
    ]),
    extensions: Object.freeze([
        '.tmp',
        '.log',
        '.lock'
    ])
})
