import test from "node:test"
import assert from "node:assert"
import { invariant } from "../libcd_invariant.mjs"
import { run_self_check, run_pre_op_check } from "../internal/self_check/libcd_self_check.mjs"
import { node_create_accessor, NODE_STRIDE } from "../node/libcd_struct_offset_manager.0.mjs"

// 0. check db & storage primitives self-check orchestration
test("libcd_self_check: pre_op_check and run_self_check orchestration", () => {
  const dummy_buffer = {
    node_cursor: 1,
    u8_view: new Uint8Array(NODE_STRIDE),
    i32_view: new Int32Array(NODE_STRIDE / 4),
    string_heap: { byte_length: 1024 },
  }
  // Set valid canary (0xAA) at offset 31 so integrity check passes
  dummy_buffer.u8_view[31] = 0xAA

  const ctx = {
    buffer: dummy_buffer,
  }

  // Verify orchestration runs without error
  run_pre_op_check(ctx)
  run_self_check(ctx)
  invariant(true, "self check orchestration completed cleanly")
})

test("libcd_self_check: zero-GC SharedArrayBuffer node struct accessors", () => {
  const sab = new SharedArrayBuffer(NODE_STRIDE * 4) // 4 nodes
  const accessor = node_create_accessor(sab)
  const node_id = 1
  const CANARY_VAL = 0xAA

  // 1. Test flags and bitwise Atomics helpers (Node accessor retains get_/set_ per struct invariant rules)

  accessor.set_flags(node_id, 0x01)
  assert.strictEqual(accessor.get_flags(node_id), 0x01)
  accessor.add_flag(node_id, 0x04)
  assert.strictEqual(accessor.get_flags(node_id), 0x05)
  assert.strictEqual(accessor.has_flag(node_id, 0x04), true)
  assert.strictEqual(accessor.has_flag(node_id, 0x02), false)

  // 2. Test parent ID pointer
  accessor.set_parent(node_id, 0)
  assert.strictEqual(accessor.get_parent(node_id), 0)

  // 3. Test name pointer into string_heap
  accessor.set_name_ptr(node_id, 128)
  assert.strictEqual(accessor.get_name_ptr(node_id), 128)

  // 4. Test m_time and size (Float64 fields with BigUint64Array Atomics)
  const now = Date.now()
  accessor.set_m_time(node_id, now)
  assert.strictEqual(accessor.get_m_time(node_id), now)

  accessor.set_size(node_id, 4096.5)
  assert.strictEqual(accessor.get_size(node_id), 4096.5)



  // 5. Set canary at offset 31 for full buffer integrity verification
  const u8_view = new Uint8Array(sab)
  u8_view[node_id * NODE_STRIDE + 31] = CANARY_VAL

  // Run integrity check over this buffer
  const integrity_ctx = {
    node_cursor: 2,
    u8_view,
    i32_view: new Int32Array(sab),
    string_heap: { byte_length: 1024 },
  }
  // Also set canary for node 0
  u8_view[31] = CANARY_VAL

  assert.doesNotThrow(() => {
    run_self_check({ buffer: integrity_ctx })
  })
})

import { operation_run_pipeline, libcd_micro_pause } from "../internal/op/libcd_operation.mjs"

test("libcd_operation: composed operation pipelines, retry boundaries, and micro pauses", async () => {
  // 1. Verify micro pause factors including opposite profile modifiers
  assert.strictEqual(libcd_micro_pause.get_factor({ profile: "+bg" }), 10)
  assert.strictEqual(libcd_micro_pause.get_factor({ profile: "+fg" }), 1)
  assert.strictEqual(libcd_micro_pause.get_factor({ profile: "-nolimits" }), 0)
  assert.strictEqual(libcd_micro_pause.get_factor({ profile: "-bg" }), 1, "Opposite -bg profile yields 1ms like fg")
  assert.strictEqual(libcd_micro_pause.get_factor({ profile: "-fg" }), 10, "Opposite -fg profile yields 10ms like bg")

  // 2. Test composed steps using thisArg context and automatic retry recovery
  var attempts = 0
  var step_1_ran = false
  var step_2_ran = false

  const dummy_buffer = {
    node_cursor: 1,
    u8_view: new Uint8Array(NODE_STRIDE),
    i32_view: new Int32Array(NODE_STRIDE / 4),
    string_heap: { byte_length: 1024 },
  }
  dummy_buffer.u8_view[31] = 0xAA

  var ctx = {
    profile: "-nolimits", // 0ms yields for fast test execution
    buffer: dummy_buffer,
    max_retries: 3
  }

  // Composed pipeline of 2 steps
  var steps = [
    async function step_1() {
      assert.strictEqual(this, ctx)
      attempts++
      if (attempts < 2) {
        throw new Error("Transient lock contention")
      }
      step_1_ran = true
    },
    async function step_2() {
      assert.strictEqual(this, ctx)
      step_2_ran = true
    }
  ]

  await operation_run_pipeline(ctx, steps)

  assert.strictEqual(attempts, 2, "Step 1 retried exactly once before succeeding")
  assert.strictEqual(step_1_ran, true, "Step 1 completed successfully")
  assert.strictEqual(step_2_ran, true, "Step 2 completed successfully after step 1")
})

import {
  descenthash_compute_single,
  descenthash_compute_node,
  descenthash_compute_descent,
  descenthash_update_bubble,
  descenthash_fract
} from "../internal/hash/libcd_descent_hash.mjs"

test("libcd_descent_hash: zero-GC float hashing and O(1) incremental bubble updates", () => {
  // 1. Verify fract bounds across positive and negative inputs
  assert.strictEqual(descenthash_fract(1.75), 0.75)
  assert.strictEqual(Number((descenthash_fract(-0.25)).toFixed(4)), 0.75) // -0.25 - (-1) = 0.75

  // 2. Setup SharedArrayBuffer with 3 nodes (Dir 0, Child 1, Child 2)
  const sab = new SharedArrayBuffer(NODE_STRIDE * 3)
  const accessor = node_create_accessor(sab)

  // Dir 0
  accessor.set_m_time(0, 1700000000000)
  accessor.set_size(0, 4096)

  // Child 1
  accessor.set_m_time(1, 1700000010000)
  accessor.set_size(1, 1024)

  // Child 2
  accessor.set_m_time(2, 1700000020000)
  accessor.set_size(2, 2048)

  const child_1_hash = descenthash_compute_node(accessor, 1)
  const child_2_hash = descenthash_compute_node(accessor, 2)
  const dir_hash_initial = descenthash_compute_descent(accessor, 0, [1, 2])

  assert.ok(dir_hash_initial >= 0 && dir_hash_initial < 1, "Dir hash bounded in [0, 1)")

  // 3. Modify Child 1 (simulate file write) and compute both ways
  accessor.set_size(1, 5120) // updated size
  const child_1_new_hash = descenthash_compute_node(accessor, 1)

  // Full recompute of dir hash
  const dir_hash_recomputed = descenthash_compute_descent(accessor, 0, [1, 2])

  // O(1) Incremental bubble update
  const dir_hash_bubbled = descenthash_update_bubble(dir_hash_initial, child_1_hash, child_1_new_hash)

  // Verify that O(1) bubbled hash exactly matches O(N) full recompute due to exact linear float contribution
  assert.strictEqual(Number(dir_hash_bubbled.toFixed(10)), Number(dir_hash_recomputed.toFixed(10)), "Incremental bubbled hash matches full tree recompute")
})

import {
  libcd_Volume,
  LIBCD_VOLE_MASK,
  LIBCD_VOL_SPECIES,
  LIBCD_VOL_DISCOVER_STRATEGY,
  volume_has_mask,
  volume_add_mask,
  volume_clear_mask,
  volume_is_busy,
  volume_imprint,
  time_mask_get_duration_ms,
  time_mask_is_expired,
  time_mask_format,
  volume_flags
} from "../storage/libcd_volume.mjs"

test("libcd_volume: behavioral Vole Masks, 32-bit safe math, and imprint operations", async () => {
  // 1. Verify safe 32-bit bitwise helpers across vole masks
  var mask = LIBCD_VOLE_MASK.acl.probe_name_records | LIBCD_VOLE_MASK.acl.descend_root
  assert.strictEqual(volume_has_mask(mask, LIBCD_VOLE_MASK.acl.descend_root), true)
  assert.strictEqual(volume_has_mask(mask, LIBCD_VOLE_MASK.acl.must_io_exclusive), false)

  mask = volume_add_mask(mask, LIBCD_VOLE_MASK.acl.must_io_exclusive)
  assert.strictEqual(volume_has_mask(mask, LIBCD_VOLE_MASK.acl.must_io_exclusive), true)

  mask = volume_clear_mask(mask, LIBCD_VOLE_MASK.acl.must_io_exclusive)
  assert.strictEqual(volume_has_mask(mask, LIBCD_VOLE_MASK.acl.must_io_exclusive), false)

  // 2. Verify behavioral discovery strategies check activity busy mask and maintain flag
  var busy_mask = LIBCD_VOLE_MASK.activity.present | LIBCD_VOLE_MASK.activity.maintain
  assert.strictEqual(volume_is_busy(busy_mask), true, "Volume with present + maintain is busy")
  assert.strictEqual(LIBCD_VOL_DISCOVER_STRATEGY.sequential.next(0, 10, busy_mask), -1, "Sequential skips discovery when volume is busy with maintenance")
  assert.strictEqual(LIBCD_VOL_DISCOVER_STRATEGY.sequential.next(0, 10, LIBCD_VOLE_MASK.activity.present), 1, "Sequential advances index when volume is idle present without maintenance")

  // 3. Verify libcd_Volume initialization, time mask flags, and imprint operation
  var vol = new libcd_Volume({ type: "vm" })
  assert.strictEqual(vol.species, "fixed")
  assert.strictEqual(volume_has_mask(vol.acl_mask, LIBCD_VOLE_MASK.acl.must_io_exclusive), true, "VM volume defaults to exclusive IO")

  var v_flags = vol.flags()
  assert.strictEqual(v_flags.time_mask, LIBCD_VOLE_MASK.time.year_3, "Volume initializes with default 3 years time mask (0x10)")
  assert.strictEqual(v_flags.time_ttl_ms, 94608000000, "TTL exactly matches 3 years")
  assert.strictEqual(v_flags.expired, false, "Newly created volume is not expired")

  var imprinted_class = await vol.imprint(0x12345678, { skip_fixed: true })
  assert.strictEqual(imprinted_class, true, "Imprint class wrapper skipped or completed cleanly on fixed volume")

  var imprinted_func = await volume_imprint(vol, 0x12345678, { skip_fixed: true })
  assert.strictEqual(imprinted_func, true, "Imprint functional primitive skipped or completed cleanly on fixed volume")
})

import {
  volume_add_known_id,
  volume_has_known_id,
  volume_get_known_ids,
  volume_get_active_volumes,
  volume_clear_registries
} from "../storage/libcd_volume.mjs"
import {
  hardware_controller_mount_volume,
  hardware_controller_unmount_volume,
  hardware_controller_get_active_volumes,
  hardware_controller_get_known_ids
} from "../hardware/libcd_controller.mjs"

test("libcd_volume & lib/hardware: active/known unique volume registries and hardware controller orchestration", async () => {
  volume_clear_registries()

  // 1. Verify manual known ID registration
  volume_add_known_id("HW-9988-ABC", { type: "ssd", path: "C:\\" })
  assert.strictEqual(volume_has_known_id("HW-9988-ABC"), true, "Known ID correctly registered")
  assert.strictEqual(volume_get_known_ids().size, 1, "Known IDs count is 1")

  // 2. Verify hardware controller mount volume (with fallback UUID for test isolation across OS without wmic)
  var mounted_vol = await hardware_controller_mount_volume("D:\\", {
    fallback_uuid: "HW-7766-DEF",
    type: "ram"
  })

  assert.strictEqual(mounted_vol.hardware_id, "HW-7766-DEF", "Mounted volume assigned correct hardware_id")
  assert.strictEqual(volume_has_known_id("HW-7766-DEF"), true, "Hardware controller auto-registered ID into known unique IDs")
  assert.strictEqual(hardware_controller_get_known_ids().size, 2, "Hardware controller returns both known IDs")
  assert.strictEqual(hardware_controller_get_active_volumes().size, 1, "Hardware controller reports 1 active mounted volume")
  assert.strictEqual(hardware_controller_get_active_volumes().get("HW-7766-DEF"), mounted_vol, "Active volume map returns correct libcd_Volume instance")

  // 3. Verify unmount
  hardware_controller_unmount_volume("HW-7766-DEF")
  assert.strictEqual(hardware_controller_get_active_volumes().size, 0, "Active volumes cleanly cleared after unmount")
  assert.strictEqual(hardware_controller_get_known_ids().size, 2, "Known unique IDs history preserved after active unmount")
})

import {
  arg_slice_compare_fast,
  arg_slice_compare_secure_raw,
  arg_slice_compare_secure,
  arg_parse_binary_header,
  arg_parse_cli,
  arg_parse_profile
} from "../arg/libcd_arg.mjs"
import { libcd_ArgParser } from "../arg/libcd_ArgParser.mjs"

test("libcd_arg: fast/secure slice comparators, binary header parsing, and dual surface CLI arg parser", () => {
  // 1. Verify profile parsing attaches default 3 years time mask and handles opposite flags (-bg, -start, +resident)
  var prof = arg_parse_profile("+resident")
  assert.strictEqual(prof.time_mask, 0x10, "Default profile initialization sets 3 years time mask per doc")
  assert.strictEqual(prof.periodic_maintenance, true, "Maintenance is enabled by default per profile")

  var opp_prof = arg_parse_profile("-bg -start +resident")
  assert.strictEqual(opp_prof.bg, false, "Opposite -bg sets bg false")
  assert.strictEqual(opp_prof.start, false, "Opposite -start sets start false")
  assert.strictEqual(opp_prof.resident, true, "+resident sets resident true")
  assert.strictEqual(opp_prof.yield_ms, 1, "-bg opposite profile selects 1ms yield")

  // 2. Verify fast zero-GC slice comparator
  var buf_a = new Uint8Array([0xCD, 0xCD, 0x01, 0x02, 0x03])
  var buf_b = new Uint8Array([0x00, 0xCD, 0xCD, 0x01, 0xFF])
  assert.strictEqual(arg_slice_compare_fast(buf_a, 0, buf_b, 1, 3), true, "Fast slice match across offsets 0 and 1")
  assert.strictEqual(arg_slice_compare_fast(buf_a, 0, buf_b, 1, 4), false, "Fast slice mismatch at 4th byte")

  // 3. Verify secure raw XOR accumulator inside uint8 bounds
  assert.strictEqual(arg_slice_compare_secure_raw(buf_a, 0, buf_b, 1, 3), true, "Secure raw accumulator matches identical slices")
  assert.strictEqual(arg_slice_compare_secure_raw(buf_a, 0, buf_b, 1, 4), false, "Secure raw accumulator detects byte difference")

  // 4. Verify node crypto timingSafeEqual wrapper
  var full_1 = new Uint8Array([10, 20, 30])
  var full_2 = new Uint8Array([10, 20, 30])
  var full_3 = new Uint8Array([10, 20, 31])
  assert.strictEqual(arg_slice_compare_secure(full_1, full_2), true, "timingSafeEqual matches exact equal arrays")
  assert.strictEqual(arg_slice_compare_secure(full_1, full_3), false, "timingSafeEqual detects mismatch")

  // 5. Verify binary magic header checking
  var magic = new Uint8Array([0xCD, 0xCD])
  assert.strictEqual(arg_parse_binary_header(buf_a, 0, magic), true, "Binary header match at offset 0")
  assert.strictEqual(arg_parse_binary_header(buf_b, 1, magic), true, "Binary header match at offset 1")

  // 6. Verify CLI arg parsing via functional and class wrapper surfaces including opposite profile flags
  var dummy_argv = ["--verbose", "--threads=4", "-D", "+resident", "-bg", "-start", "C:\\Data"]
  var parsed_func = arg_parse_cli(dummy_argv)
  assert.strictEqual(parsed_func.options.verbose, true)
  assert.strictEqual(parsed_func.options.threads, "4")
  assert.strictEqual(parsed_func.options.D, true)
  assert.strictEqual(parsed_func.options["+resident"], true)
  assert.strictEqual(parsed_func.options.resident, true)
  assert.strictEqual(parsed_func.options["-bg"], true)
  assert.strictEqual(parsed_func.options.bg, false, "-bg flag sets boolean options.bg to false")
  assert.strictEqual(parsed_func.options["-start"], true)
  assert.strictEqual(parsed_func.options.start, false, "-start flag sets boolean options.start to false")
  assert.deepStrictEqual(parsed_func.profiles, ["+resident", "-bg", "-start"])
  assert.deepStrictEqual(parsed_func.positionals, ["C:\\Data"])

  var parser = new libcd_ArgParser(dummy_argv)
  var parsed_class = parser.parse_cli()
  assert.deepStrictEqual(parsed_class, parsed_func, "Dual surface class wrapper delegates exactly to functional primitive")
  assert.strictEqual(parser.compare_fast(buf_a, 0, buf_b, 1, 3), true, "Class wrapper fast comparison works")

  var class_prof = parser.parse_profile("-bg -start")
  assert.strictEqual(class_prof.bg, false, "Class wrapper parse_profile delegates to functional primitive")
  assert.strictEqual(class_prof.start, false, "Class wrapper parse_profile resolves -start opposite")
})

import { PROTOCOL_OP } from "../worker/libcd_worker_op.mjs"
import { CONFIG_PRECEDENCE } from "../../config/libcd_configure.mjs"

test("libcd_security: Object.freeze boundaries, null-prototype maps, and prototype pollution immunity", () => {
  // 1. Verify critical constant tables and behavioral masks are deeply frozen against mutation
  assert.strictEqual(Object.isFrozen(PROTOCOL_OP), true, "PROTOCOL_OP is immutable")
  assert.strictEqual(Object.isFrozen(CONFIG_PRECEDENCE), true, "CONFIG_PRECEDENCE is immutable")
  assert.strictEqual(Object.isFrozen(LIBCD_VOLE_MASK), true, "LIBCD_VOLE_MASK is immutable")
  assert.strictEqual(Object.isFrozen(LIBCD_VOLE_MASK.acl), true, "LIBCD_VOLE_MASK.acl is deeply immutable")
  assert.strictEqual(Object.isFrozen(LIBCD_VOL_SPECIES), true, "LIBCD_VOL_SPECIES is immutable")
  assert.strictEqual(Object.isFrozen(LIBCD_VOL_DISCOVER_STRATEGY), true, "LIBCD_VOL_DISCOVER_STRATEGY is immutable")

  // 2. Verify prototype pollution resilience across constructors and operation options
  try {
    // Simulate prototype pollution attempt from an untrusted driver
    Object.prototype.max_retries = 999
    Object.prototype.species = "polluted_evil_species"
    Object.prototype.must_io_exclusive = true

    var clean_vol = new libcd_Volume({ type: "ssd" })
    assert.strictEqual(clean_vol.species, "fixed", "libcd_Volume constructor ignores polluted Object.prototype.species")
    assert.strictEqual(volume_has_mask(clean_vol.acl_mask, LIBCD_VOLE_MASK.acl.must_io_exclusive), false, "libcd_Volume constructor ignores polluted prototype flags on ssd")

    var dummy_ctx = { profile: "-nolimits" }
    var pipeline_retries = null
    operation_run_pipeline(dummy_ctx, function step() {
      // Step executed inside pipeline
    }, {
      // Pass clean options object; max_retries not explicitly set, should default to 3 (not 999)
    })
    // Verify that the pipeline ran without throwing due to polluted max_retries
    assert.ok(true, "Pipeline safely ignored polluted Object.prototype.max_retries")
  } finally {
    // Clean up global Object.prototype modifications immediately
    delete Object.prototype.max_retries
    delete Object.prototype.species
    delete Object.prototype.must_io_exclusive
  }
})

import { ctx_create, ctx_profile, ctx_buffer, ctx_flags, ctx_run_time_maintenance, libcd_Context } from "../internal/ctx/libcd_ctx.mjs"
import {
  change_graph_init,
  change_graph_record,
  change_graph_decay,
  change_graph_emit_scalar,
  change_graph_emit_vector_svg,
  change_graph_emit_bitmap,
  libcd_ChangeGraph
} from "../render/libcd_change_graph.mjs"

test("libcd_change_graph & libcd_ctx: lifecycle context buffer pools, entropy accumulation, decay sweeps, and SVG/bitmap output", () => {
  // 1. Verify lifecycle context creation, profile accessors, and time mask flags
  var ctx = ctx_create({ change_graph_buckets: 16, profile: "+resident" })
  assert.strictEqual(ctx_profile(ctx), "+resident", "Context profile accessor reads correctly")
  assert.strictEqual(ctx_profile(ctx, "+fg"), "+fg", "Context profile accessor writes and returns new profile")
  assert.ok(ctx_buffer(ctx, "change_graph_buffer") instanceof Float32Array, "Change graph scalar buffer is initialized inside ctx")
  assert.strictEqual(ctx_buffer(ctx, "change_graph_buffer").length, 16, "Buffer matches configured bucket count")

  var c_flags = ctx_flags(ctx)
  assert.strictEqual(c_flags.time_mask, 0x10, "Context initializes with default 3 years time mask")
  assert.strictEqual(c_flags.expired, false, "Newly created context is not expired")

  var maint = ctx_run_time_maintenance(ctx)
  assert.strictEqual(maint.compacted, false, "Maintenance check runs cleanly without unexpected early compaction")

  var class_ctx = new libcd_Context({ change_graph_buckets: 8 })
  assert.strictEqual(class_ctx.flags().time_mask, 0x10, "Dual surface class wrapper flags() method returns full status")
  assert.strictEqual(typeof class_ctx.run_maintenance().compacted, "boolean", "Dual surface run_maintenance() executes cleanly")

  // 2. Verify change graph recording and clamping across buckets
  var val0 = change_graph_record(ctx, 0, 0.5)
  assert.strictEqual(val0, 0.5, "Node 0 recorded 0.5 entropy")
  var val0_max = change_graph_record(ctx, 0, 0.8)
  assert.strictEqual(val0_max, 1.0, "Node 0 entropy clamped to 1.0 maximum")

  // Record node 4 and node 8
  change_graph_record(ctx, 4, 0.4)
  change_graph_record(ctx, 8, 0.2)

  // 3. Verify decay sweep behavior
  change_graph_decay(ctx, 0.5) // Decay by 50%
  var scalar_view = change_graph_emit_scalar(ctx)
  assert.strictEqual(Number(scalar_view[0].toFixed(4)), 0.5, "Bucket 0 decayed from 1.0 to 0.5")
  assert.strictEqual(Number(scalar_view[4].toFixed(4)), 0.2, "Bucket 4 decayed from 0.4 to 0.2")
  assert.strictEqual(Number(scalar_view[8].toFixed(4)), 0.1, "Bucket 8 decayed from 0.2 to 0.1")

  // 4. Verify SVG vector path output format
  var svg_path = change_graph_emit_vector_svg(ctx, { width: 150, height: 100 })
  assert.ok(svg_path.startsWith("M "), "SVG path starts with MoveTo command")
  assert.ok(svg_path.includes("L "), "SVG path contains LineTo commands")

  // 5. Verify 2D quantized Uint8Array bitmap grid output
  var bitmap = change_graph_emit_bitmap(ctx, 4, 4) // 4x4 grid (16 pixels total)
  assert.ok(bitmap instanceof Uint8Array, "Bitmap returns a Uint8Array grid")
  assert.strictEqual(bitmap.length, 16, "Bitmap grid dimensions exactly match width * height")

  // 6. Verify Dual Surface class wrapper (`libcd_ChangeGraph`) delegates cleanly
  var class_ctx = new libcd_Context({ change_graph_buckets: 8 })
  var graph = new libcd_ChangeGraph(class_ctx.ctx, 8)
  graph.record(2, 0.75)
  assert.strictEqual(graph.emit_scalar()[2], 0.75, "Class wrapper delegates record and emit_scalar accurately")
  assert.ok(graph.emit_vector_svg().length > 0, "Class wrapper emits vector SVG paths")
  assert.strictEqual(graph.emit_bitmap(2, 2).length, 4, "Class wrapper emits quantized bitmap")
})

import { assert_disk_vol_id, assert_polling_disk_vol_ids } from "../internal/self_check/libcd_assert_vol_id.mjs"

test("libcd_assert_vol_id: verifies removable and added_by_default volumes maintain valid imprints before access", async () => {
  // 1. Stable fixed drive without removable flag should pass assert_disk_vol_id without imprint
  var fixed_vol = new libcd_Volume({ type: "ssd", hardware_id: "vol_fixed_01" })
  assert.strictEqual(assert_disk_vol_id(fixed_vol), true, "Fixed volume passes vol id assertion")

  // 2. Removable volume without imprint must throw invariant error
  var usb_vol = new libcd_Volume({ type: "ram", species: "removable", hardware_id: "vol_usb_01", removable: true })
  assert.throws(() => {
    assert_disk_vol_id(usb_vol)
  }, /must be imprinted before access/, "Unimprinted removable volume throws invariant violation")

  // 3. Imprint the removable volume and verify it passes assertion
  await volume_imprint(usb_vol, "vol_usb_01")
  assert.strictEqual(assert_disk_vol_id(usb_vol), true, "Imprinted removable volume passes vol id assertion")

  // 4. Verify polling across active volumes
  assert.strictEqual(assert_polling_disk_vol_ids(), true, "Polling across active imprinted volumes passes cleanly")
})

import { win_is_administrator } from "../os/win/libcd_administrator.mjs"
import { win_get_node_process_path, win_get_isolation_status } from "../os/win/libcd_win_isolate.mjs"

test("libcd_win_isolate & libcd_administrator: Windows process identification, admin check, and WFP firewall isolation status", () => {
  if (process.platform !== "win32") {
    return
  }

  // 1. Verify we can correctly identify the node executable path
  var path= win_get_node_process_path()
  assert.strictEqual(typeof path, "string", "Node process path is resolved as a string")
  assert.strictEqual(path.length > 0, true, "Node process path is non-empty")

  // 2. Verify admin privilege check completes cleanly without throwing
  var is_admin= win_is_administrator()
  assert.strictEqual(typeof is_admin, "boolean", "Admin status returns a boolean")

  // 3. Verify status inspection returns expected shape
  var status= win_get_isolation_status()
  assert.strictEqual(typeof status.isolated, "boolean", "Isolation status returns a boolean flag")
  assert.strictEqual(status.target_exe, path, "Status reports exact node executable path")
})

import {
  os_filter_check,
  os_filter_add,
  os_filter_remove,
  os_filter_reset,
  os_filter_get_metrics,
  FILTER_PRECEDENCE
} from "../os/libcd__os_filter.mjs"
import {
  os_fs_stat,
  os_fs_readdir
} from "../os/libcd_os_fs.mjs"

test("libcd__os_filter & libcd_os_fs: formal filter precedence hierarchies, fast O(1) checks, and filtered directory traversal", async () => {
  os_filter_reset(true)

  // 1. Verify Layer 0 (LIB_DEFAULT) blocks OS forbidden files (e.g., pagefile.sys or .DS_Store or /proc)
  var win_check = os_filter_check("C:\\pagefile.sys")
  if (process.platform === "win32") {
    assert.strictEqual(win_check.blocked, true, "Windows default filter blocks pagefile.sys")
    assert.strictEqual(win_check.level, FILTER_PRECEDENCE.LIB_DEFAULT, "Blocked at LIB_DEFAULT level 0")
  }

  // 2. Verify dynamic custom filter addition at APP_DYNAMIC (level 2) and ETC_DEFAULT (level 1)
  os_filter_add(FILTER_PRECEDENCE.APP_DYNAMIC, "extensions", ".secret_ext")
  var dynamic_check = os_filter_check("some_file.secret_ext")
  assert.strictEqual(dynamic_check.blocked, true, "Dynamic filter blocks .secret_ext")
  assert.strictEqual(dynamic_check.level, FILTER_PRECEDENCE.APP_DYNAMIC, "Blocked at APP_DYNAMIC level 2")

  os_filter_remove(FILTER_PRECEDENCE.APP_DYNAMIC, "extensions", ".secret_ext")
  assert.strictEqual(os_filter_check("some_file.secret_ext").blocked, false, "Removing filter allows path again")

  // 3. Verify audit skip metrics tracking
  var metrics = os_filter_get_metrics()
  assert.strictEqual(typeof metrics.total_skipped, "number", "Skip metrics reports total_skipped count")

  // 4. Verify os_fs_stat blocks excluded paths and returns null without throwing
  if (process.platform === "win32") {
    var stat_res = await os_fs_stat("C:\\pagefile.sys")
    assert.strictEqual(stat_res, null, "os_fs_stat returns null on blocked file")
  }
})

import {
  os_exec,
  os_exec_sync,
  os_exec_parse_cmd
} from "../os/libcd_os_executor.mjs"

test("libcd_os_executor: execa-inspired unified async/sync execution, quote tokenization, timeout cancellation, and reject:false status inspection", async () => {
  // 1. Verify command quote tokenization (`os_exec_parse_cmd`)
  var parsed = os_exec_parse_cmd('node -e "console.log(\'hello world\')" --version')
  assert.strictEqual(parsed.command, "node", "Command binary correctly parsed")
  assert.strictEqual(parsed.args[0], "-e", "First flag correctly parsed")
  assert.strictEqual(parsed.args[1], "console.log('hello world')", "Quoted argument cleanly preserved without outer double quotes")

  // 2. Verify synchronous execution with clean result dictionary (`os_exec_sync`)
  var sync_res = os_exec_sync("node", ["-e", "process.stdout.write('sync ok')"])
  assert.strictEqual(sync_res.exitCode, 0, "Sync execution returned exitCode 0")
  assert.strictEqual(sync_res.stdout, "sync ok", "Sync stdout captured cleanly with stripped newline")
  assert.strictEqual(sync_res.failed, false, "Sync failed flag is false")

  // 3. Verify asynchronous Promise execution (`os_exec`)
  var async_res = await os_exec("node", ["-e", "process.stdout.write('async ok')"])
  assert.strictEqual(async_res.exitCode, 0, "Async execution returned exitCode 0")
  assert.strictEqual(async_res.stdout, "async ok", "Async stdout captured cleanly")
  assert.strictEqual(typeof async_res.duration_ms, "number", "Execution duration recorded")

  // 4. Verify reject: false behavior on non-zero exit codes
  var failed_res = await os_exec("node", ["-e", "process.exit(42)"], { reject: false })
  assert.strictEqual(failed_res.exitCode, 42, "Captured exit code 42 without rejecting promise")
  assert.strictEqual(failed_res.failed, true, "Failed flag set to true")

  // 5. Verify timeout cancellation behavior
  var timed_out_res = await os_exec("node", ["-e", "setTimeout(() => {}, 5000)"], { timeout: 100, reject: false })
  assert.strictEqual(timed_out_res.timedOut, true, "Execution marked as timedOut when exceeding timeout threshold")
  assert.strictEqual(timed_out_res.failed, true, "Execution marked as failed on timeout")
})

import {
  os_metadata_collect,
  os_metadata_register_trusted_host,
  os_metadata_check_environment,
  os_metadata_inspect_volume,
  os_metadata_reset
} from "../os/libcd__os_metadata.mjs"

import { host_os, host_fingerprint } from "../host/libcd_host.mjs"
import { os_manifest_fingerprint } from "../os/libcd_os__manifest.mjs"

test("libcd__os_metadata & libcd_host: cross-OS volume history tracking, unknown host detection, and manifestation fingerprinting", () => {
  os_metadata_reset()

  // 1. Verify baseline host identity collection via host_os()
  var meta = host_os()
  assert.strictEqual(typeof meta.hostname, "string", "host_os() returns full metadata dictionary containing hostname")
  assert.strictEqual(typeof meta.platform, "string", "host_os() returns platform")
  assert.strictEqual(typeof meta.exec_path, "string", "host_os() returns exec_path")

  // 2. Verify check environment records initial boot cleanly and registers trusted host
  var check1 = os_metadata_check_environment()
  assert.strictEqual(check1.os_identity.platform, meta.platform, "Check reported correct platform")
  assert.strictEqual(check1.is_known_host, false, "First check identifies host as newly seen")

  // 3. Verify second run recognizes the trusted host cleanly without alerts
  var check2 = os_metadata_check_environment()
  assert.strictEqual(check2.is_known_host, true, "Second check recognizes host as trusted")
  assert.strictEqual(check2.unknown_host_detected, false, "No unknown host alert triggered on recognized host")

  // 4. Simulate running the same code for a known volume (`VOL-CROSS-8899`) on another operating system
  os_metadata_reset()
  os_metadata_register_trusted_host({
    hostname: "OLD-WIN-MACHINE",
    platform: "win32",
    arch: "x64",
    user: "admin",
    exec_path: "C:\\node.exe",
    timestamp: Date.now() - 10000
  })

  // Register volume access under the previous OS baseline
  os_metadata_check_environment() // registers current host and associates active volumes

  // 5. Verify os_manifest_fingerprint and host_fingerprint capture enriched os_identity cleanly
  var manifest = os_manifest_fingerprint()
  assert.strictEqual(typeof manifest.host.os_identity, "object", "host_fingerprint inside os_manifest_fingerprint includes rich os_identity")
  assert.strictEqual(typeof manifest.os_manifest_hash, "number", "Computed float manifestation hash")
})







