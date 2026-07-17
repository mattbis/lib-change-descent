# Graveyard: Early README Constraints & Raw WIP Notes

*Preserved from the original README.md prior to roadmap consolidation. These notes contain critical, unfiltered hacker philosophy and design constraints that shouldn't be lost to formulaic documentation.*

## CONSTRAINTS

- [ ] only ever load and execute the very minimum required for the operation, no enterprise style bloat.. constructors, runtime, scope, constants, handles
- [ ] define tasks and the object shape...
- [ ] toleration, severity, security, reliability, resilence
- [ ] strict separation of invariant assertions (`invariant()`) for non-operation setup vs operation-controlled code that runs inside `try {} catch {}` with automatic `retry()` up to failure thresholds

## WIP

- [ ] ~~TypeScript? depends whether it mangles the output too much, everything has to remain simple and exact, since GC is the enemy~~
- [ ] memory layout & bounds: node stride, text storage sizes, and offset testing
- [ ] scale limits: max views, node count, and heap size (needs cache aging/clearing for massive multi-volume profiles to prevent heap blowouts)
- [ ] os interop & concurrency: os filters and resolving the shared buffer host protocol (needs a working prototype to revise)
- [ ] engine core: motion types, strategies, and session management
- [ ] diagnostics & release: dev/alpha consistency checks, standardized error codes `[THING]`, targeting 3 revisions for alpha
- [ ] codify masks... that are the mechanical description of controlling byte codes to change behaviour

performance isn't important - just that this allows integration with other systems and is aimed for function over filesystem

## PHASE 2

- schema generation on use case, its static, but still architecture phase ( 1 )
- fixed limit custom byte size 
