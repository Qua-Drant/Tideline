import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {transform} from 'esbuild';

const source = await readFile(new URL('../src/pages/timeline-labels.ts', import.meta.url), 'utf8');
const {code} = await transform(source, {loader: 'ts', format: 'esm'});
const {packTimelineLabels} = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));

function check(items, width) {
  const result = packTimelineLabels(items, width);
  assert.equal(result.labels.length, items.length);
  for (const a of result.labels) {
    assert(a.left >= 0 && a.right <= width + 0.01, 'caption stays inside timeline');
    for (const b of result.labels) {
      if (a.index >= b.index || a.lane !== b.lane) continue;
      assert(a.right + 16 <= b.left || b.right + 16 <= a.left, 'same-lane captions cannot overlap');
    }
  }
  return result;
}
const dense = [{anchor: 0, width: 390}, {anchor: 350, width: 700}, {anchor: 600, width: 680}, {anchor: 690, width: 600}, {anchor: 1380, width: 500}];
assert(check(dense, 1600).lanes > 1);
check(dense, 360);
assert.equal(check([{anchor: 120, width: 300}, {anchor: 120, width: 300}, {anchor: 120, width: 300}], 800).lanes, 3);
assert.equal(check([{anchor: 0, width: 100}, {anchor: 500, width: 100}], 1000).lanes, 1);
assert.equal(check([], 360).lanes, 0);
check([{anchor: 0, width: 1200}], 40);
assert.deepEqual(packTimelineLabels(dense, 1600), packTimelineLabels(dense, 1600));
console.log('PASS: dense/same-time/edge/narrow/long-title/empty/deterministic timeline labels');
