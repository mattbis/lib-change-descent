### mostly mjs at the moment

- prefer `var x= true`
- prefer no semicolons - they are totally stupid and due to the transition from B to C... much more is legal than you would think
- 2 spaces is a node JS disease, it makes code too dense, 4 spaces....
- prefer `thing.mjs` instead of `get_` `set_` like Go...
- prefer Python and C style snake case methods ( sorry but it's easier to read Node.js and JS has this wrong.. ) this way it's easy to see what is built-in and what is from a core part or thirdparty... This library is very low-level... Its weird i never used to like thing_is_this() but now i do ... hmmm
- ### dep parties
- `1p` this means node js core or whatever language core
- `2p` means libraries and code i wrote, that this will use
- `3p` means someone elses code, in this library its based off of their code, but i really don't want any deps; and so far I am mostly just imagining my own approach for fun, improvement and I need to use it daily...
