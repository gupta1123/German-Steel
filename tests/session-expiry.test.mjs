import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_SESSION_TIMER_DELAY, scheduleSessionExpiry } from '../lib/session-expiry.ts';

function clock(t) {
  let now = 0;
  let nextId = 0;
  const timers = new Map();
  t.mock.method(Date, 'now', () => now);
  t.mock.method(globalThis, 'setTimeout', (callback, delay) => {
    assert(delay > 0 && delay <= MAX_SESSION_TIMER_DELAY, 'delay must fit the browser timer');
    const id = ++nextId;
    timers.set(id, { callback, delay });
    return id;
  });
  t.mock.method(globalThis, 'clearTimeout', id => timers.delete(id));
  return {
    timers,
    advance() {
      const [id, timer] = timers.entries().next().value;
      timers.delete(id);
      now += timer.delay;
      timer.callback();
    },
  };
}

test('a long-lived login stays signed in through safe timer intervals until actual expiry', t => {
  const c = clock(t);
  let logouts = 0;
  scheduleSessionExpiry(60 * 24 * 60 * 60 * 1000, () => logouts++);
  assert.equal(logouts, 0);
  c.advance();
  assert.equal(logouts, 0, 'the first timer interval must not log out an unexpired session');
  c.advance();
  assert.equal(logouts, 0);
  c.advance();
  assert.equal(logouts, 1);
  assert.equal(c.timers.size, 0);
});

test('ordinary sessions log out at expiry and expired sessions log out immediately', t => {
  const c = clock(t);
  let logouts = 0;
  scheduleSessionExpiry(3600_000, () => logouts++);
  c.advance();
  assert.equal(logouts, 1);
  scheduleSessionExpiry(0, () => logouts++);
  assert.equal(logouts, 2);
  assert.equal(c.timers.size, 0);
});

test('logout or a new login cancels the previous expiry timer', t => {
  const c = clock(t);
  let logouts = 0;
  const cancel = scheduleSessionExpiry(MAX_SESSION_TIMER_DELAY * 3, () => logouts++);
  c.advance();
  cancel();
  assert.equal(c.timers.size, 0);
  assert.equal(logouts, 0);
});
