/**
 * I have my own project that I need to finish for logging that is brutally simple... and very succinct... we will use this 
 * or you can have it use some other thing, or just console() via new Console() ( this is part of my log library -- as it 
 * allows output and input streams.... ) TODO (matt): implications of this stream and handles, and corruption etc...
 * 
 * since we are session orientated - if something of this severity - doesn't work - it should not be a total deal breaker...
 * a fallback or automatic name suffix incrementation is a possible solution ( for example if the log file is suddenly corrupted )
 * as mentioned somewhere else, eventually id implement os level logging using event log in windows, and linux var/log? and osx
 * who knows, its probably horrific...
 * 
 * however, having a proxy for logging would be expensive in terms of function context, and engine overhead... and is silly
 * so whatever solution would need to embed the code as close as possible to runtime bundle, as our aim is the opposite of enterprise 
 * style stuff.... so its likely it will be chalkpack or console... and later on more flexible ( in a this is going to cost you mode
 * or probably still pretty expensive - probably solved by bundle messaging of message, instead of real time... ) to os mechanism...
 * I think here, we need to consult other libraries that are quite low level 
 */
