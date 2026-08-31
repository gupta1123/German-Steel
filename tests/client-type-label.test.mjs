import test from 'node:test';
import assert from 'node:assert/strict';
import { formatClientTypeLabel } from '../lib/client-type-label.ts';

test('client type labels use sentence case without changing source values', () => {
  for (const [value, label] of [['SHOP', 'Shop'], ['Site Visit', 'Site visit'], [' site_visit ', 'Site visit'], ['ARCHITECT', 'Architect'], ['civil-engineer', 'Civil engineer'], ['', ''], [null, '']]) {
    assert.equal(formatClientTypeLabel(value), label);
  }
  const option = { value: 'SITE_VISIT' };
  assert.equal(formatClientTypeLabel(option.value), 'Site visit');
  assert.equal(option.value, 'SITE_VISIT');
});
