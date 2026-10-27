import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  FUTURE_DATE_OF_BIRTH_ERROR,
  INVALID_DATE_OF_BIRTH_ERROR,
  getDateOfBirthError,
  localDateInputValue,
} from '../lib/contact-validation.ts';
import { RetailAPI } from '../lib/retail-api.ts';

const referenceDate = new Date(2026, 9, 27, 0, 5);

test('date of birth remains optional', () => {
  for (const value of ['', null, undefined]) {
    assert.equal(getDateOfBirthError(value, referenceDate), null);
  }
});

test('past dates and today are allowed; tomorrow and later dates are rejected', () => {
  for (const value of ['1990-01-01', '2026-10-26', '2026-10-27']) {
    assert.equal(getDateOfBirthError(value, referenceDate), null);
  }
  for (const value of ['2026-10-28', '2026-11-01', '2027-01-01']) {
    assert.equal(getDateOfBirthError(value, referenceDate), FUTURE_DATE_OF_BIRTH_ERROR);
  }
});

test('malformed dates and impossible calendar dates are rejected', () => {
  for (const value of [
    '2026-02-29', '2024-02-30', '1900-02-29', '2026-04-31',
    '2026-00-01', '2026-13-01', '2026-10-00', '0000-01-01',
    '2026-1-01', '27/10/2026', 'not a date', ' ', '2026-10-27T00:00:00Z',
  ]) {
    assert.equal(getDateOfBirthError(value, referenceDate), INVALID_DATE_OF_BIRTH_ERROR, value);
  }
  for (const value of ['2000-02-29', '2024-02-29', '0001-01-01']) {
    assert.equal(getDateOfBirthError(value, referenceDate), null, value);
  }
});

test('the date limit follows the local calendar on both sides of UTC midnight', () => {
  const helperUrl = new URL('../lib/contact-validation.ts', import.meta.url).href;
  for (const [timezone, instant, expected] of [
    ['Asia/Kolkata', '2026-10-26T20:00:00Z', '2026-10-27'],
    ['America/Los_Angeles', '2026-10-27T02:00:00Z', '2026-10-26'],
  ]) {
    const script = `
      import { localDateInputValue, getDateOfBirthError } from ${JSON.stringify(helperUrl)};
      const now = new Date(${JSON.stringify(instant)});
      process.stdout.write(JSON.stringify({ today: localDateInputValue(now), error: getDateOfBirthError(${JSON.stringify(expected)}, now) }));
    `;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
      env: { ...process.env, TZ: timezone },
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { today: expected, error: null });
  }
});

const contactPayload = {
  firstName: 'Test',
  lastName: 'Contact',
  mobile: '9876543210',
  email: null,
  dateOfBirth: null,
  anniversaryDate: null,
  active: true,
};

test('create and edit refuse future or invalid DOBs before making any API request', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', () => {
    throw new Error('Invalid date of birth must not reach the server');
  });
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  for (const [dateOfBirth, expected] of [
    [localDateInputValue(tomorrow), FUTURE_DATE_OF_BIRTH_ERROR],
    ['2026-02-30', INVALID_DATE_OF_BIRTH_ERROR],
  ]) {
    await assert.rejects(
      RetailAPI.createMasterContact({ ...contactPayload, dateOfBirth }, 'test-token'),
      { message: expected },
    );
    await assert.rejects(
      RetailAPI.updateMasterContact(123, { dateOfBirth, anniversaryDate: null }, 'test-token'),
      { message: expected },
    );
  }
  assert.equal(fetchMock.mock.callCount(), 0);
});

test('create and edit send accepted DOBs unchanged and do not restrict anniversary dates', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => Response.json({ id: 123 }));
  for (const dateOfBirth of [null, '1990-01-01', localDateInputValue()]) {
    const payload = { ...contactPayload, dateOfBirth, anniversaryDate: '2099-01-01' };
    assert.equal(await RetailAPI.createMasterContact(payload, 'test-token'), 123);
    await RetailAPI.updateMasterContact(123, payload, 'test-token');
    const calls = fetchMock.mock.calls.slice(-2);
    assert.match(calls[0].arguments[0], /\/api\/common\/contacts$/);
    assert.match(calls[1].arguments[0], /\/api\/common\/contacts\/123$/);
    assert.equal(calls[0].arguments[1].method, 'POST');
    assert.equal(calls[1].arguments[1].method, 'PUT');
    for (const call of calls) assert.deepEqual(JSON.parse(call.arguments[1].body), payload);
  }
  assert.equal(fetchMock.mock.callCount(), 6);
});
