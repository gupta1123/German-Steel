import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  getNcDateError,
  NC_RAISED_DATE_REQUIRED_ERROR,
  NC_RAISED_DATE_INVALID_ERROR,
  NC_TARGET_DATE_INVALID_ERROR,
  NC_TARGET_DATE_ORDER_ERROR,
} from '../lib/nc-date-validation.ts';
import { ProjectsAPI } from '../lib/projects-api.ts';

test('NC targets may be on or after the raised date, including month/year and leap-day boundaries', () => {
  for (const [raised, target] of [
    ['2026-10-28', '2026-10-28'], ['2026-10-28', '2026-10-29'],
    ['2026-10-31', '2026-11-01'], ['2026-12-31', '2027-01-01'],
    ['2024-02-29', '2024-02-29'], ['2024-02-29', '2024-03-01'],
    ['2026-10-28', '2099-12-31'],
  ]) assert.equal(getNcDateError(raised, target), null, `${raised}–${target}`);
});

test('a target before its raised date is rejected across calendar boundaries', () => {
  for (const [raised, target] of [
    ['2026-10-28', '2026-10-27'], ['2026-11-01', '2026-10-31'],
    ['2027-01-01', '2026-12-31'], ['2024-02-29', '2024-02-28'],
  ]) assert.equal(getNcDateError(raised, target), NC_TARGET_DATE_ORDER_ERROR);
});

test('raised date is required, but target closure remains optional', () => {
  for (const empty of ['', null, undefined]) {
    assert.equal(getNcDateError('2026-10-28', empty), null);
    assert.equal(getNcDateError(empty, '2026-10-29'), NC_RAISED_DATE_REQUIRED_ERROR);
    assert.equal(getNcDateError(empty, empty), NC_RAISED_DATE_REQUIRED_ERROR);
  }
});

test('malformed and impossible dates are rejected without applying a future-date restriction', () => {
  for (const invalid of [
    '2026-02-29', '2024-02-30', '1900-02-29', '2026-04-31', '2026-00-10',
    '2026-13-01', '2026-10-00', '0000-01-01', '2026-1-01', '28/10/2026',
    '2026-10-28T00:00:00Z', ' ', 'not a date',
  ]) {
    assert.equal(getNcDateError(invalid, null), NC_RAISED_DATE_INVALID_ERROR, invalid);
    assert.equal(getNcDateError('2026-10-28', invalid), NC_TARGET_DATE_INVALID_ERROR, invalid);
  }
  assert.equal(getNcDateError('2000-02-29', '2000-03-01'), null);
  assert.equal(getNcDateError('2099-01-01', '2099-01-02'), null);
});

const ncPayload = {
  projectId: 31,
  description: 'NC date validation test',
  raisedDate: '2026-10-28',
  raisedByOfficialText: 'Test official',
  targetClosureDate: '2026-10-29',
  closureMethod: null,
  closureDate: null,
  status: 'OPEN',
  responsibleEmployeeId: 99,
};

test('creating an NC refuses invalid dates before sending any API request', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', () => { throw new Error('Invalid NC dates must not reach the server'); });
  for (const [raisedDate, targetClosureDate, message] of [
    ['2026-10-28', '2026-10-27', NC_TARGET_DATE_ORDER_ERROR],
    ['', '2026-10-29', NC_RAISED_DATE_REQUIRED_ERROR],
    ['2026-02-30', null, NC_RAISED_DATE_INVALID_ERROR],
    ['2026-10-28', '2026-11-31', NC_TARGET_DATE_INVALID_ERROR],
  ]) await assert.rejects(ProjectsAPI.createNc({ ...ncPayload, raisedDate, targetClosureDate }, 'test-token'), { message });
  assert.equal(fetchMock.mock.callCount(), 0);
});

test('same-day, later, and omitted NC targets retain the documented creation payload', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => Response.json({ id: 700 }));
  for (const targetClosureDate of ['2026-10-28', '2026-10-29', null]) {
    const payload = { ...ncPayload, targetClosureDate };
    assert.equal(await ProjectsAPI.createNc(payload, 'test-token'), 700);
    const [url, options] = fetchMock.mock.calls.at(-1).arguments;
    assert.equal(new URL(url).pathname, '/api/projects/nc');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    assert.deepEqual(JSON.parse(options.body), payload);
  }
  assert.equal(fetchMock.mock.callCount(), 3);
});

test('the project NC form guards dates without changing stage eligibility', () => {
  const source = fs.readFileSync(new URL('../app/dashboard/projects/[id]/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /submitDisabled=\{Boolean\(ncDateError\)\}/);
  assert.match(source, /min=\{ncForm.raisedDate \|\| undefined\}/);
  assert.match(source, /id="project-nc-date-error" role="alert"/);
  assert.match(source, /aria-label="Raised date"/);
  assert.match(source, /aria-label="Target closure date"/);
  const handler = source.split('const createNc = async () => {')[1].split('const openSubmitNc')[0];
  assert.ok(handler.indexOf('if (dateError)') < handler.indexOf('setBusy(true)'));
  assert.ok(handler.indexOf('if (dateError)') < handler.indexOf('ProjectsAPI.createNc'));
  assert.match(source, /const canRaiseNc = !hasClosedNc && \['TECHNICAL_VISIT_SCHEDULED', 'NC_RAISED', 'NC_CLOSURE_SUBMITTED', 'UNDER_REVIEW'\]\.includes\(stage\)/);
});
