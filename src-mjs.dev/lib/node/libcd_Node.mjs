/**
 * SCHEMA DEFINITION (32 Bytes per Node)
 * 
 * 0: Flags (Uint8) 
 * 1-3: Reserved/Padding
 * 4: ParentId (Int32)
 * 8: NamePointer (Int32)
 * 12: HashPointer (Int32)
 * 16: MTime (Float64)
 * 24: Size (Float64)
 */

// TODO (matt): maybe ... or dynamically counted, to allow seeking magnitude
const NODE_TYPE = {
  Super: () => a[3] // points to ... 
  // Or ... 
}
