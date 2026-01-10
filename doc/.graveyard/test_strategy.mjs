import test from 'node:test';
import assert from 'node:assert/strict';
import { createNodeAccessor } from './lib-change-descent.mjs';

test('Memory Accessor: Read/Write Consistency', () => {
  const buffer = new SharedArrayBuffer(1024);
  const accessor = createNodeAccessor(buffer);
  
  accessor.setParent(1, 99);
  assert.equal(accessor.getParent(1), 99);
});
