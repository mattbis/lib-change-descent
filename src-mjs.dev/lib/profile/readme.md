1. this couples the library more closely to a consuming application in userspace.. and that means its defining " too much "
2. its easier to do it this way - as a way to tie up much of the functionality into succinct topics, so its easier to make it " just work "

They essentially start the initial config bundle, so a command to start the application is assumed to have precedence over static 
configuration variables. TODO (matt): precedence? would need to be a runtime manifest mechanism.. that defines the order. Usually
I would just enforce " it works this way " but in this instance, to make a library for a specific purpose, but to make it useful
means you have to allow a flexible config stage... such that a manifest which is embedded into a consuming application can specify
everything... so long as its ordered when needed, or we have a tree, that means that isn't important ( the latter would avoid
lots of stupid config blocking cut / paste ) and if I am going to make something this complicated anyway... one extra thing
doesn't bother me..

The aim here is that once its basically completed, it should work forever... this is all low-level stuff... none of the kernel
or layers on top ( that are near the bottom ) are ever going to change... the only changes expected will be mistakes & security
: hopefully.

There is a v2 phase which would mean liberalising a lot of stuff, to make re using some useful logic, or functions much easier...
