/** expose main functions that allow different ways to consume the library */

export function main() {
}

export function _main_resident() {}
export function _main_standalone() {}

export function __main_mod(profileMod= 'bg') {
    // TODO (matt): something like
    profileMod.split(/\+/gi).forEach(m => {
        switch(m) {
            case 'bg':
                break
            case 'fg':
                break
            default:
                break
        }
    })
}
