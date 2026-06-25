/**
 * expose constructors that allow different ways to consume the library
 */

// TODO: the problem here is that a basic constructor like this needs to support +resident
// essentially loading a bare framework.. until a connected application instigates actions
// or with +start ? 
export class LibChangeDescentBare {
    constructor() {
        
    }    
}

/** the one time DRY might not be sensible - since it would be quite expensive to extend.. however for now */
export class LibChangeDescentOp extends LibChangeDescentBare {
    constructor(options) {
    }
}
