# lib-change-descent

The first part of how lkman is gonna work...  This probably exists elsewhere much better.

## CONSTRAINTS

- [ ] only ever load and execute the very minimum required for the operation, no enterprise style bloat.. ctors, runtime, scope, constants, handles
- [ ] define tasks and the object shape...

## WIP

- [ ] ~~Typescript? depends whether it mangles the output too much, everything has to remain simple and exact, since GC is the enemy~~
- [ ] research phase more prior art or hack 

- [ ] get second and third opinions on the current arch and suggested structure
- [ ] debug and dev/alpha consistency checks
- [ ] core descent logic
- [ ] offset test and playing
- [ ] page sizes (node size)
- [ ] text storage sizes
- [ ] max limits (views, node count, heap size) - would require aging hash probably or some kinda background clear of cache data, for the core operation - this might grow quite big - depending on the number of volumes. ( this is part of profiles mod +unlimited )
- [ ] session
- [ ] consistent error messages with code and standard `[THING]`
- [ ] shared buffer from host and protocol finish... smt is not right here... probably need to get smt working to revise it
- [ ] 3 revision for alpha?
- [ ] performance metrics
