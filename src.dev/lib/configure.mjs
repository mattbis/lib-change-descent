/** allows programmatic override of defaults - custom locations etc */

/* I dislike environment variables, this library will not use them they are insecure and messy... instead prefer 
a config file that has *PROPER* permissions... this is much better... */
export const CONFIG_PRECEDENCE= {
    file: 0,
    os: 1,
    env: 2 
}
