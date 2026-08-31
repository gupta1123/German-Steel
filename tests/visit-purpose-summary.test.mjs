import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeVisitPurposes } from '../lib/visit-purpose-summary.ts';

test('purpose summary normalizes established labels and merges custom purposes without losing counts', () => {
  const result = summarizeVisitPurposes([
    { purpose: ' FIRST_VISIT ', count: 2 }, { purpose: 'First Visit', count: 1 },
    { purpose: 'monthly-visit', count: 2 }, { purpose: 'Order', count: 5 },
    { purpose: 'Smoke Matrix Visit 20260812', count: 4 },
    { purpose: 'Others', count: 1 }, { purpose: null, count: 1 },
  ]);
  assert.deepEqual(result, [
    { purpose: 'Order', visits: 5 }, { purpose: 'First visit', visits: 3 },
    { purpose: 'Monthly visit', visits: 2 }, { purpose: 'Others', visits: 6 },
  ]);
  assert.equal(result.reduce((sum, row) => sum + row.visits, 0), 16);
});

test('empty and invalid counts do not render phantom bars; all-custom data stays visible', () => {
  assert.deepEqual(summarizeVisitPurposes([]), []);
  assert.deepEqual(summarizeVisitPurposes([{ purpose: 'Order', count: NaN }, { purpose: 'Order', count: -1 }, { purpose: 'Order', count: 0 }]), []);
  assert.deepEqual(summarizeVisitPurposes([{ purpose: 'Custom', count: 2 }]), [{ purpose: 'Others', visits: 2 }]);
});
