import test from 'node:test';
import assert from 'node:assert/strict';
import { syncPageQuery, isPageQuerySyncInProgress } from '../lib/page-query-sync.ts';

const currentUrl = 'http://localhost:3000/dashboard/employees?page=3';

test('list query updates bypass navigation confirmation only during the history write', () => {
  const calls = [];
  const browser = {
    location: { href: currentUrl },
    history: { replaceState(state, title, href) {
      assert.equal(isPageQuerySyncInProgress(), true);
      calls.push(href);
    } },
  };
  assert.equal(isPageQuerySyncInProgress(), false);
  syncPageQuery('/dashboard/employees?page=2', browser);
  assert.deepEqual(calls, ['http://localhost:3000/dashboard/employees?page=2']);
  assert.equal(isPageQuerySyncInProgress(), false);
});

test('unchanged URL does not emit navigation or schedule a route transition', () => {
  syncPageQuery(currentUrl, {
    location: { href: currentUrl },
    history: { replaceState() { assert.fail('must not update unchanged history'); } },
  });
});

test('page navigation, external destinations, and hash changes cannot bypass the guard', () => {
  for (const href of ['/dashboard/settings', 'https://example.com/dashboard/employees', '#other']) {
    assert.throws(() => syncPageQuery(href, {
      location: { href: currentUrl },
      history: { replaceState() { assert.fail('must not navigate'); } },
    }), /current page/);
    assert.equal(isPageQuerySyncInProgress(), false);
  }
});

test('history failures do not leave unsaved-changes protection disabled', () => {
  assert.throws(() => syncPageQuery('/dashboard/employees?page=2', {
    location: { href: currentUrl },
    history: { replaceState() { throw new Error('history failure'); } },
  }), /history failure/);
  assert.equal(isPageQuerySyncInProgress(), false);
});

test('existing anchor is retained while filters change', () => {
  syncPageQuery('/dashboard/employees?page=2#list', {
    location: { href: `${currentUrl}#list` },
    history: { replaceState(state, title, href) {
      assert.equal(href, 'http://localhost:3000/dashboard/employees?page=2#list');
    } },
  });
});
