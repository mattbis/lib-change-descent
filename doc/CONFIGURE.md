- all paths are configurable -- from one root - to diversion
- age of the system - by default it keeps records for 3 years but these are periodically compressed - this will grow in sqlite or pg... if its fs config.. and nothing else is configured TODO(matt): 30 days? 3 months? 1year 25 years? aging... hmmm... ED: you would only be storing as a unconfigured dep the manifest, and the user log is just what it did for that user, .... or the current.
  So this means the defaults, for verbose and debug are low...
- TODO (matt): CONFIG / command / ... `--verbose` `0..5` `--debug` `0..5` ? `--severity` meta to -dv ? 
