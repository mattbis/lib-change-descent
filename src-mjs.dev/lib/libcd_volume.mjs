/**
 * define volume management, with sympathy to the __REAL WORLD__ that we are addressing..... 
 */

export const LIBCD_VOL_DISCOVER_STRATEGY = {
    // one by one
    sequential: {
        next: (index, count) = {}
    },
    // groups of queries - in ordered procession
    staggered: {
        next: (index, count) = {}
    },
    // random sample - of possible total
    random_sample: {
        next: (index, count) = {}
    }
}

export const LIBCD_VOL_SPECIES= {
  // fixed, / mark as ...                   // cannot be fixed and removable
  // removable, / mark as volatile          // can be removable and temporary
  // temporary / mark as less important     // can be ram, fixed or removable - no speed restrictions
}

export const LIBCD_VOL_TYPE= {
    // ram /// volatile, temporary
    // needs to know if dynamic or fixed
    // same as ssd... 

    // vm /// --> points to ssd or hdd - interaction... 
    
    // ssd /// avoid writes when necessary, take advantage of speed
    // handles many small files well, can burst when bus controllers aren't busy
    // can handle write and read
    
    // hdd /// backup is better - since if not used will retain data.. writes are mostly slower, 
    // fragmentation in some fs is awful for speed. Doesn't handle many small files well.
    // one big file is better, can burst... when not busy. 
    // should only be doing one operation type: read, or write
}

// TODO (matt): as mentioned elsewhere the activity mods... 

export class LIBCD_VOL {
    d= {
        type_log: [], // as LIBCD_VOL_TYPE
        identifiers: [], // I almost feel like this object is recreated and static.identifiers is all known os dependent volume path / drive identifiers seen
        // which is then a metric that can be seen or used... here there is a problem OS are stupid... windows can arbitarirly change driver letters in certain
        // scenarios......

        /// TODO (matt): we need an intelligence, that knows whats not been changed for sometime, and uses this as a internal fingerprint of what disk is likely
        // however, if the user changes teh contents of a disk a lot .... its very hard to infer....

        acl_log: [
            // stores when something raised an exception that bubbled up and made an operation hang... or succeed... 
            // TODO (matt): log pollution, too many of same type.. windows, does a ton of event logging, and its burning cpu
        ]
    }
    
    // TODO: (matt): lib_cd.volume.imprint -- creates a user space marker of the disk id... that doesn't trip external virus detection for no good reasons... 
    imprint(imprint_options) {
        /// if it can't imprint bubble highest log....
        //// if it can't write retry 3 times, over a long period privately
        //// the first imprint is a ownership manifest.... that lives in root `\libcd\var\db`
        /// if you only have fixed disks you can skip this stage, via profile , or programmaticalkly
    }
    /// in many arguments you could say just disable the virus scanner,, if you know what you are doing.. and you have this many disks I can assume a certain
    /// savvyness... 
    
    set(type) {}
    // get 
    constructor() {}
}
