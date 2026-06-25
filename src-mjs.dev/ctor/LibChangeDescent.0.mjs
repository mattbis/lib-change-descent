/**
 * expose constructors that allow different ways to consume the library
 */

export class LibChangeDescentBare {
    constructor() {
        
    }    
}

/** the one time DRY might not be sensible - since it would be quite expensive to extend.. however for now */
export class LibChangeDescentOp extends LibChangeDescentBare {
    constructor(options) {
    }
}
