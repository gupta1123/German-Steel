import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeferredAction } from '../lib/deferred-action.ts';

test('navigation confirmation never updates state in the browser event / insertion-effect stack', async () => {
  const deferred = createDeferredAction();
  let inBrowserEvent = true;
  let called = false;
  const completed = new Promise(resolve => deferred.schedule(() => {
    assert.equal(inBrowserEvent, false);
    called = true;
    resolve();
  }));
  assert.equal(called, false);
  inBrowserEvent = false;
  await completed;
  assert.equal(called, true);
});

test('rapid navigation requests retain only the latest destination', async () => {
  const deferred = createDeferredAction();
  const calls = [];
  deferred.schedule(() => calls.push('old'));
  await new Promise(resolve => deferred.schedule(() => { calls.push('latest'); resolve(); }));
  assert.deepEqual(calls, ['latest']);
});

test('cleanup cancels a queued confirmation after unmount or route change', async () => {
  const deferred = createDeferredAction();
  let called = false;
  deferred.schedule(() => { called = true; });
  deferred.cancel();
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(called, false);
});
