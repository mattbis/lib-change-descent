
/**
 * part of the complexity of this library is that there isn't one general set of rules or uses that just work... this stuff can be very brittle
 * particular when depending on USB interfaces... other connection forms obvious are more robust.
 *
 * scale here is important, since this is cost effective, and im sure im not alone, therefore these strategies are controlled via profile mods at
 * the most simplest, and can be user defined if necessary ( IE. some devices make take awhile to spin up - they might be old ) we can't make 
 * assumptions... since until something breaks it could be used as a snapshot or some intermediate: sync, part of a redundant system...
 * 
 * the part missing in the library here, is whether to auto assume on magic , if its some ancient hdd and then probe gently... and hope the os
 * isnt doing the same thing... TODO (matt): the ultimate interaction uses this as a inverse vector that controls the activity amount... the more
 * batshit insane os is doing... the less we can do ... if its HDD for example.. as that means head seeking and scratching... we don't want that
 * ever.
 */
export VOL_DISCOVER_STRATEGIES = {
    // one by one
    sequential: {},
    // groups of queries - in ordered procession
    staggered: {},
    // random sample - of possible total
    random_sample: {}
}
