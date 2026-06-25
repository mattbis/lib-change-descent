/** gets a byte indicating the status as bits */
export signals() {}
/** gets signals as boolean object */
export flags() {} 
/** there isnt one global state this refers to each volume provider and whether it still exists or not, is known or new... etc */
export const SIG_STATE = {
  ABORT: 0,
  RUN: 1,
  PROCESS: 2
}
