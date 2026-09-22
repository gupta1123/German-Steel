import test from 'node:test';
import assert from 'node:assert/strict';
import { formatPersonName, toTitleCase } from '../lib/utils.ts';

test('title-cases person names regardless of backend casing', () => {
  assert.equal(toTitleCase('payal gupta'), 'Payal Gupta');
  assert.equal(toTitleCase('PAYAL GUPTA'), 'Payal Gupta');
  assert.equal(formatPersonName('pAYAL', 'gUPTA'), 'Payal Gupta');
});

test('title-cases labels while preserving business acronyms', () => {
  assert.equal(toTitleCase('field officer performance'), 'Field Officer Performance');
  assert.equal(toTitleCase('pin code and gst id'), 'PIN Code And GST ID');
  assert.equal(toTitleCase('nc closure for tmt order'), 'NC Closure For TMT Order');
});

test('does not alter case-sensitive contact and URL values', () => {
  assert.equal(toTitleCase('payal.gupta@example.com'), 'payal.gupta@example.com');
  assert.equal(toTitleCase('https://example.com/SomePath'), 'https://example.com/SomePath');
});
