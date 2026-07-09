/**
 * part of the complexity of this library is that there isn't one general set of rules or uses that just work... this stuff can be very brittle
 * particularly when depending on USB interfaces... other connection forms obviously are more robust.
 * only one popular free indexer does this well, but if the disks are missing on startup, which is very easy to happen - perhaps you forgot to 
 * turn on the plug! it will totally rebuild the db.. we never want this - as that is just stupid... I don't know why you would assume all volumes
 * are fixed.. that is a clear - and complete ignorance of world economics, not everyone is as rich as you - or has the latest hardware
 * it's kinda awful and disgusting really... to make such assumptions. Too much software is made by people with overly powerful hardware and no
 * long history in computing since DOS.. since they clearly never once had this thought enter their heads ( I see it all the time with music 
 * software ) ... a clever way to develop and reach the alpha is to test on crap hardware... or deliberately cap CPU. You must think of everyone
 * not just yourself.
 *
 * scale here is important, since this is cost effective, and I'm sure I'm not alone, therefore these strategies are controlled via profile mods at
 * the simplest, and can be user defined if necessary ( i.e., some devices may take a while to spin up - they might be old ) we can't make 
 * assumptions... since until something breaks it could be used as a snapshot or some intermediate: sync, part of a redundant system...
 * 
 * the part missing in the library here is whether to auto assume on magic, if it's some ancient HDD and then probe gently... and hope the OS
 * isn't doing the same thing... TODO (matt): the ultimate interaction uses this as an inverse vector that controls the activity amount... the more
 * batshit insane OS is doing... the less we can do... if it's HDD for example.. as that means head seeking and scratching... we don't want that
 * ever.
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

export const LIBCD_VOL_TYPE= {
  // fixed, / mark as ...                   // cannot be fixed and removable
  // removable, / mark as volatile          // can be removable and temporary
  // temporary / mark as less important     // can be fixed or removable - no speed restrictions
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
    imprint() {}
    /// in many arguments you could say just disable the virus scanner,, if you know what you are doing.. and you have this many disks I can assume a certain
    /// savvyness... 
    
    set(type) {}
    // get 
    constructor() {}
}
