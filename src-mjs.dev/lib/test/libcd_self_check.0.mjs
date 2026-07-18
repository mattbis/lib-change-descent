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
  // 1. Verify micro pause factors
  assert.strictEqual(libcd_micro_pause.get_factor({ profile: "+bg" }), 10)
  assert.strictEqual(libcd_micro_pause.get_factor({ profile: "+fg" }), 1)
  assert.strictEqual(libcd_micro_pause.get_factor({ profile: "-nolimits" }), 0)

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
  LIBCD_VOL_DISCOVER_STRATEGY,
  volume_has_mask,
  volume_add_mask,
  volume_clear_mask,
  volume_imprint
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

  // 2. Verify behavioral discovery strategies check activity busy mask
  var busy_mask = LIBCD_VOLE_MASK.activity.busy
  assert.strictEqual(LIBCD_VOL_DISCOVER_STRATEGY.sequential.next(0, 10, busy_mask), -1, "Sequential skips discovery when volume is busy")
  assert.strictEqual(LIBCD_VOL_DISCOVER_STRATEGY.sequential.next(0, 10, 0), 1, "Sequential advances index when volume is idle")

  // 3. Verify libcd_Volume initialization and imprint operation (both class wrapper and functional primitive)
  var vol = new libcd_Volume({ type: "vm" })
  assert.strictEqual(vol.species, "fixed")
  assert.strictEqual(volume_has_mask(vol.acl_mask, LIBCD_VOLE_MASK.acl.must_io_exclusive), true, "VM volume defaults to exclusive IO")

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






