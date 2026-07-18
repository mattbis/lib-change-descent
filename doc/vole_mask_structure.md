
- the vole mask structure, contains bits for:-

# acl mask - for all functions

in a resident scenario, the first thing is to discover the environment and what to monitor... the discovery stage.
the acl is dynamically changed... its not possible to trigger a very expensive operation without a key stage, or 
guaged lock being solved.

- applied when `initialised` after setup initialisation will scan, it will probe the hardware and controllers... 
- applied when `setup` 1. has been processed, 2. is allowed, and 3. to guage tree size.
- applied when `setup` indicates a legacy device
- 5. is applied during `setup` if the disk has nothing but system stuff in it .. TODO (matt): reduce work...

1. can probe name and records
2. can descend root
3. can descend children
4. must io is exclusive
5. system only

# read mask - for an op

0. no resitrction, 4 still exists... since reads are inner grouped TODO (matt): we can easily soup into a mess of calls...
1. can query root dirs
2. can query root dirs children
3. can seek node size
4. is a vector this allows orders of magnitude and " size of work "

# write mask - for an op

0. no write restriction
1. volatile buffer writes into chunks, and write in one go
2. serial writes

# speed mask

- read and write obey the speed mask

1. no restrictions
2. careful ramp
3. must be system controlled ( TODO (matt): is it possible to know when you can do stuff in the background more intelligently? )
4. phase v3 : resident monitored activiy coupled with os - or native... 

# activity mask

1. missing
2. present
3. busy ( 2+ 4|5|6 )
4. read
5. write
6. maintain // means its doing someting the user didn't request, for example imprinting...

# history mask

1. volatile
2. storing

# time mask 

- for each context you can create a mask that determines how long something lives for - by default the storage is small but it will grow...
a connected app will be reminded of this when you query flags()

its also in the logs

a profile can set this value automatically and the default config file init has it set to 3 years...

- maintenance is enabled by default periodically which compacts this data, using the inbuilt compression functions

`the mask is a time binary value` or a JS date object... 

1. the value as bits

## TODO

- the vol strategies are almost hte same thing... this makes me think to redesign as behavioural more.. since the operations are similar
