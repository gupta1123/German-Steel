import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  getVisitTimeRangeError,
  VISIT_TIME_REQUIRED_ERROR,
  VISIT_TIME_INVALID_ERROR,
  VISIT_TIME_ORDER_ERROR,
} from '../lib/visit-time-validation.ts';
import { ProjectsAPI } from '../lib/projects-api.ts';

test('same-day positive ranges work across morning, noon, and day boundaries', () => {
  for (const [start, end] of [
    ['10:00', '10:30'], ['09:30', '10:00'], ['11:30', '13:00'], ['15:00', '15:30'],
    ['00:00', '00:01'], ['23:58', '23:59'], ['10:00:00', '10:00:01'],
    ['10:00', '10:00:01'], ['10:00:01', '10:01'],
  ]) assert.equal(getVisitTimeRangeError(start, end), null, `${start}–${end}`);
});

test('earlier, equal, and overnight end times are invalid for a single-date visit', () => {
  for (const [start, end] of [
    ['15:00', '14:00'], ['10:00', '09:59'], ['10:00', '10:00'],
    ['10:00', '10:00:00'], ['10:00:01', '10:00'], ['23:30', '00:15'], ['00:00', '00:00'],
  ]) assert.equal(getVisitTimeRangeError(start, end), VISIT_TIME_ORDER_ERROR, `${start}–${end}`);
});

test('both time fields are required', () => {
  for (const empty of ['', null, undefined]) {
    assert.equal(getVisitTimeRangeError(empty, '10:30'), VISIT_TIME_REQUIRED_ERROR);
    assert.equal(getVisitTimeRangeError('10:00', empty), VISIT_TIME_REQUIRED_ERROR);
    assert.equal(getVisitTimeRangeError(empty, empty), VISIT_TIME_REQUIRED_ERROR);
  }
});

test('invalid 24-hour time values and malformed strings are rejected', () => {
  for (const invalid of ['24:00', '12:60', '10:00:60', '9:00', '10:0', '3:00 PM', '10:00:00:00', ' ', 'not a time', '2026-10-28T10:00:00']) {
    assert.equal(getVisitTimeRangeError(invalid, '23:59'), VISIT_TIME_INVALID_ERROR, invalid);
    assert.equal(getVisitTimeRangeError('00:00', invalid), VISIT_TIME_INVALID_ERROR, invalid);
  }
});

const validPayload = {
  projectId: 31,
  assignedEmployeeId: 99,
  assignedByEmployeeId: 42,
  scheduledVisitDate: '2026-10-29',
  scheduledStartTime: '15:00:00',
  scheduledEndTime: '15:30:00',
  purpose: 'Routine Visit',
  description: 'Visit instructions',
  selfGenerated: false,
};

test('the project API refuses invalid time ranges before sending any request', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', () => { throw new Error('Invalid times must not reach the server'); });
  for (const [start, end, message] of [
    ['15:00:00', '14:00:00', VISIT_TIME_ORDER_ERROR],
    ['15:00:00', '15:00:00', VISIT_TIME_ORDER_ERROR],
    ['23:30:00', '00:15:00', VISIT_TIME_ORDER_ERROR],
    ['', '15:30:00', VISIT_TIME_REQUIRED_ERROR],
    ['15:00:00', '', VISIT_TIME_REQUIRED_ERROR],
    ['15:00:00', '25:30:00', VISIT_TIME_INVALID_ERROR],
  ]) {
    await assert.rejects(ProjectsAPI.planVisit({ ...validPayload, scheduledStartTime: start, scheduledEndTime: end }, 'test-token'), { message });
  }
  assert.equal(fetchMock.mock.callCount(), 0);
});

test('valid project visits retain the documented request contract and selected times', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => Response.json({ id: 700 }));
  await ProjectsAPI.planVisit(validPayload, 'test-token');
  assert.equal(fetchMock.mock.callCount(), 1);
  const [url, options] = fetchMock.mock.calls[0].arguments;
  assert.equal(new URL(url).pathname, '/api/common/visits');
  assert.equal(options.method, 'POST');
  assert.equal(options.headers.Authorization, 'Bearer test-token');
  assert.deepEqual(JSON.parse(options.body), {
    ...validPayload,
    visitType: 'PROJECT_SITE_VISIT',
    clientAccountId: null,
    institutionId: null,
    scheduledLatitude: null,
    scheduledLongitude: null,
    purposeCode: null,
    purposeText: null,
    contactIds: [],
  });
});

test('the project form explains invalid times, disables submission, and guards saving independently', () => {
  const source = fs.readFileSync(new URL('../app/dashboard/projects/[id]/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /submitDisabled=\{Boolean\(visitTimeError\)\}/);
  assert.match(source, /id="project-visit-time-error" role="alert"/);
  assert.match(source, /aria-label="Start time"/);
  assert.match(source, /aria-label="End time"/);
  const handler = source.split('const planVisit = async () => {')[1].split('const saveEdit')[0];
  assert.ok(handler.indexOf('if (timeError)') < handler.indexOf('setBusy(true)'), 'Reject invalid times before starting a save');
  assert.ok(handler.indexOf('if (timeError)') < handler.indexOf('ProjectsAPI.planVisit'), 'Guard even if disabled-button behavior is bypassed');
});
