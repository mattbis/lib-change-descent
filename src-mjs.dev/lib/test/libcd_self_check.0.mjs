import test from "node:test"
import assert from "node:assert"
import { invariant } from "../libcd_invariant.mjs"
import { run_self_check, run_pre_op_check } from "../internal/self_check/libcd_self_check.mjs"
import { create_node_accessor, NODE_STRIDE } from "../node/libcd_struct_offset_manager.0.mjs"

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
  const accessor = create_node_accessor(sab)

  const node_id = 1
  const CANARY_VAL = 0xAA

  // 1. Test flags and bitwise Atomics helpers
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

  // 4. Test mtime and size (Float64 fields)
  const now = Date.now()
  accessor.set_m_time(node_id, now)
  assert.strictEqual(accessor.get_m_time(node_id), now)

  accessor.set_size(node_id, 4096.5)
  // Check size offset 24 directly or via getter if added
  const f64_view = new Float64Array(sab)
  assert.strictEqual(f64_view[(node_id * NODE_STRIDE + 24) / 8], 4096.5)

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

import { run_operation, libcd_micro_pause } from "../internal/op/libcd_operation.mjs"

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

  await run_operation(ctx, steps)

  assert.strictEqual(attempts, 2, "Step 1 retried exactly once before succeeding")
  assert.strictEqual(step_1_ran, true, "Step 1 completed successfully")
  assert.strictEqual(step_2_ran, true, "Step 2 completed successfully after step 1")
})

