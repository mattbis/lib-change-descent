## logging : chalkpack or console

- they do the same thign except chalkpack allows some extra presentation and features, and i want to use it in the premise, the output of the cli is the log,.. yo udont need to log that much when your system should be logging anyway... as ai - agents, third party whatever..... so long as that is dated and rotated....

## logging: manifest as imut

- it tried to do something...

- imut log is just for core operations, exernal calls, and low level things.. for example, a timed operation is not suitable for imut log. its meant to be a manifest historic data harvestable for debugging / investigation / historical purposes, not for a log of operations over time.  a test run could take 1-2 hours, and we don't want to keep a running log of all that.
- imut is a manifest that the library tried to run such and such os_executor... thats not in the user log.. this is a log that other stuff can parse.. and that always happens, no
matter what the user does... 
