## runtime operation

- it executes a function that is the current operation, some stuff happens in order, sections then are async, worker, sync and just the calls that are needed... they are compiled, when one of the entry function triggers a cycle, and the lifecycle... keep this in mind , and how lib/internal/operation is changed .... 

## logging : chalkpack or console

- they do the same thign except chalkpack allows some extra presentation and features, and i want to use it in the premise, the output of the cli is the log,.. yo udont need to log that much when your system should be logging anyway... as ai - agents, third party whatever..... so long as that is dated and rotated.... the same calls are automatically streamed to file, not, or written some other way in phase v2 for now its just this way... with those operations.. 

## logging: manifest as imut

- it tried to do something... its always the same formatting and direct calls....

- includes the core operations

- imut log is just for core operations, exernal calls, and low level things.. for example, a timed operation is not suitable for imut log. its meant to be a manifest historic data harvestable for debugging / investigation / historical purposes, not for a log of operations over time.  a test run could take 1-2 hours, and we don't want to keep a running log of all that.
- and that always happens, no matter what the user does... 

## logging: user

- built as streamed files - but using the built in fs stuff - chalkpack and when +trace +debug +verbose ... includes a lot of data... ( its best to compress this dir or use a mountable file system that is one file )
- the main databases and files is not for this purpose... but is an option... creating another process to handle this? TODO (matt): sqlite runtime, and more logging questions...  
