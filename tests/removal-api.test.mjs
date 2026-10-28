import test from 'node:test';
import assert from 'node:assert/strict';
import { removeRecord } from '../lib/removal-api.ts';

test('archive sends one authenticated DELETE and accepts an empty success response', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 204 }));
  await removeRecord('test-token', '/api/common/documents/12');
  assert.equal(fetch.mock.callCount(), 1);
  const [url, init] = fetch.mock.calls[0].arguments;
  assert.equal(new URL(url).pathname, '/api/common/documents/12');
  assert.equal(init.method, 'DELETE');
  assert.equal(init.headers.Authorization, 'Bearer test-token');
  assert.equal(init.body, undefined);
});

test('voiding a sale posts the trimmed correction reason', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json({ saleStatus: 'VOIDED' }));
  await removeRecord('test-token', '/api/retail/sales/3/void', { method: 'POST', reasonField: 'correctionReason', reason: '  Duplicate entry  ' });
  const [, init] = fetch.mock.calls[0].arguments;
  assert.equal(init.method, 'POST');
  assert.deepEqual(JSON.parse(init.body), { correctionReason: 'Duplicate entry' });
});

test('missing token, missing reason and foreign endpoints never issue a request', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json({}));
  await assert.rejects(removeRecord('', '/api/hr/expenses/1'), /sign in/);
  await assert.rejects(removeRecord('test-token', '/api/retail/sales/1/void', { reasonField: 'correctionReason', reason: '  ' }), /reason/);
  await assert.rejects(removeRecord('test-token', 'https://example.com/api/records/1'), /endpoint/);
  assert.equal(fetch.mock.callCount(), 0);
});

test('protected records and permission failures surface the backend explanation without retries', async t => {
  for (const status of [403, 409]) {
    const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json({ message: 'Accepted decision evidence cannot be deactivated' }, { status }));
    await assert.rejects(removeRecord('test-token', '/api/common/documents/12'), /Accepted decision evidence/);
    assert.equal(fetch.mock.callCount(), 1);
    fetch.mock.restore();
  }
});

test('a network interruption is not retried', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Failed to fetch'); });
  await assert.rejects(removeRecord('test-token', '/api/hr/expenses/1'), /Failed to fetch/);
  assert.equal(fetch.mock.callCount(), 1);
});
