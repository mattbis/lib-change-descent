export function _house_keep() {}
export function start() {
  return resume()
}
export function background() {}
export function foreground() {}
export function abort() {}
export function stop() {}
export function resume() {
   // 0. check db integrity 
   // 0. check fail safe store is aok
   // 1. house keep interrupted operations
   // 2. resume buffer load
}
