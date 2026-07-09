# lib-change-descent

The first part of how lkman is going to work...  This probably exists elsewhere much better.

## CONSTRAINTS

- [ ] only ever load and execute the very minimum required for the operation, no enterprise style bloat.. constructors, runtime, scope, constants, handles
- [ ] define tasks and the object shape...

## WIP

- [ ] ~~TypeScript? depends whether it mangles the output too much, everything has to remain simple and exact, since GC is the enemy~~
- [ ] debug and dev/alpha consistency checks
- [ ] motion types and strategies
- [ ] os stuff
- [ ] offset test and playing
- [ ] page sizes (node size)
- [ ] text storage sizes
- [ ] max limits (views, node count, heap size) - would require aging hash probably or some kinda background clear of cache data, for the core operation - this might grow quite big - depending on the number of volumes. ( this is part of profiles mod +unlimited )
- [ ] session
- [ ] consistent error messages with code and standard `[THING]`
- [ ] shared buffer from host and protocol finish... something is not right here... probably need to get something working to revise it
- [ ] 3 revision for alpha?

performance isn't important - just that this allows integration with other systems and is aimed for function over filesystem
