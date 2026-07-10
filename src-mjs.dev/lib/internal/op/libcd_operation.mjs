// triggers very important things - even if not with `+start` and `+resident`

/// each op has context, when run... a pipeline tracks the progress...
export class libcd_Operation {}

//// the main runtime should be as light as possible... depending on how it is modded...
/// if +bg is enabled... , if +fg or programmatic: burst within reasonable operation
/// limits....

///// TODO (matt): use -nolimits... to make it as fast as possible?
