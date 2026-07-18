### mostly mjs at the moment

- resident process hardening & defensive coding (see `doc/security.md`):
  - dictionaries and string/path caches must use `Object.create(null)` or `new Map()`, never plain `{}`.
  - exported constant tables, protocol enums (`PROTOCOL_OP`), and vole masks must be frozen with `Object.freeze()`.
  - constructor and driver options must be extracted safely (`arg_get_opt(opts, 'key', def)` or `Object.hasOwn()`), avoiding plain logical OR assignments (`options.foo || def`).
- make the significant part of a declaration the important part in spacing semantics:-
  - prefer `var x= true`
  - prefer `function foo(a= )`
- prefer tertiary ( in this formatting ) when the valueExpression is complicated enough to warrant it, if not it can be a one liner if simple enough ... the indent of the tertiary `?` `:` are the important aspect, for readability and so far as i know this has no performance aspect... :-

```
var x= (cond)
    ? .5+(Math.cos(x*pi)*.5)*.5
    : 1-(Math.cos(x*pi)*.2)*Math.sin(x*pi)*(x*.22)+.22
```
- chaining tertiary is fine instead of huge if else... xD
- prefer intelligent usage of var for performance
  - Since we aren't using TS we can optimise using var, however, where applicable in execution semantics its legible to use const and let...
- prefer no semicolons - they are totally stupid and due to the transition from B to C... much more is legal than you would think
- 2 spaces is too dense, 4 spaces....
- prefer `thing.mjs` instead of `get_` `set_` like Go...
  - this means methods should avoid being `get_volume_id` `set_volume_id` `volume_id(val)` means if val set val, if not return val. We dont want a huge thing you are making a huge thing already... 
- prefer Python and C style snake case methods ( sorry but it's easier to read Node.js and JS has this wrong.. ) this way it's easy to see what is built-in and what is from a core part or thirdparty... This library is very low-level... Its weird i never used to like `grouping_thing_thing()`. Its allowable for main constructors to be `SnakeCase()`
- all files are now gonna be `libcd_` so its easy to find, undecided on the actual call paths... 
