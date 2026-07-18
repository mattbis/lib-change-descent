/**
 * macOS / OSX default filesystem exclusions (`OSX_FILTERS`) (`LIB_DEFAULT` level 0).
 * prevents traversal into Spotlight indices, Trashes, FSEvents buffers, VolumeIcon metadata,
 * and virtual kernel paths.
 */

export const OSX_FILTERS = Object.freeze({
    path_prefixes: Object.freeze([
        '.Spotlight-V100',
        '.Trashes',
        '.fseventsd',
        '.TemporaryItems',
        '/.MobileBackups',
        '/dev',
        '/proc',
        '/sys'
    ]),
    filenames: Object.freeze([
        '.DS_Store',
        '.VolumeIcon.icns',
        '._.DS_Store'
    ]),
    extensions: Object.freeze([
        '.tmp',
        '.log',
        '.lock'
    ])
})
