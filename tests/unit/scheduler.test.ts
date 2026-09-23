import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LayoutScheduler } from '../../src/viewer/scheduler.ts';
test('V07 coalesces pending layouts and commits only the latest revision', async () => {
  const started: number[] = []; const committed: number[] = [];
  const jobs: ((value: number) => void)[] = [];
  const scheduler = new LayoutScheduler<number, number>(state => { started.push(state); return new Promise(resolve => jobs.push(resolve)); }, result => committed.push(result));
  scheduler.request(1); scheduler.request(2); scheduler.request(3);
  assert.deepEqual(started, [1]);
  jobs.shift()!(1); await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(started, [1, 3]); assert.deepEqual(committed, []);
  jobs.shift()!(3); await scheduler.whenIdle(); assert.deepEqual(committed, [3]);
});
test('V07 rejected latest layout is observable and next valid operation recovers', async () => {
  const committed: number[] = [];
  const scheduler = new LayoutScheduler<number, number>(async state => { if (state === 1) throw new Error('layout failed'); return state; }, result => committed.push(result));
  scheduler.request(1); await assert.rejects(scheduler.whenIdle(), /layout failed/);
  scheduler.request(2); await scheduler.whenIdle(); assert.deepEqual(committed, [2]);
});
