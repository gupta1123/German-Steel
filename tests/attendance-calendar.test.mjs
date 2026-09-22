import test from 'node:test';
import assert from 'node:assert/strict';

// Regression for custom-calendar crash: normalizeDate must handle undefined/null
// Mirrors components/custom-calendar.tsx:65
const normalizeDate = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') return '';
  return dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
};

test('normalizeDate handles undefined/null without throwing', () => {
  assert.equal(normalizeDate(undefined), '');
  assert.equal(normalizeDate(null), '');
  assert.equal(normalizeDate(''), '');
  // Does not throw
  assert.doesNotThrow(() => normalizeDate(undefined));
  assert.doesNotThrow(() => normalizeDate(null));
});

test('normalizeDate preserves valid dates and strips time', () => {
  assert.equal(normalizeDate('2026-02-10'), '2026-02-10');
  assert.equal(normalizeDate('2026-02-10T10:00:00Z'), '2026-02-10');
  assert.equal(normalizeDate('2026-03-01T00:00:00'), '2026-03-01');
});

test('attendance calendar tolerates records with missing checkinDate', () => {
  const attendanceData = [
    { checkinDate: '2026-02-10', attendanceStatus: 'full day' },
    { checkinDate: undefined, attendanceStatus: 'full day' },
    { checkinDate: null, attendanceStatus: 'half day' },
    { checkinDate: '', attendanceStatus: 'absent' },
    {}, // missing checkinDate entirely
  ];
  const dateKey = '2026-02-10';
  // Should not throw when finding attendance record
  assert.doesNotThrow(() => {
    attendanceData.find((data) => normalizeDate(data.checkinDate) === dateKey);
  });
  const found = attendanceData.find((data) => normalizeDate(data.checkinDate) === dateKey);
  assert.equal(found?.checkinDate, '2026-02-10');
  // Missing dates should normalize to '' and not match
  assert.equal(normalizeDate(undefined), '');
  assert.notEqual(normalizeDate(undefined), dateKey);
});

test('attendanceApi normalizeLog falls back to attendanceDate when checkinDate missing', async () => {
  // Simulate backend response with attendanceDate but no checkinDate
  const mockResponse = {
    content: [
      { id: 1, employeeId: 10, employeeName: 'Test', attendanceDate: '2026-02-15', attendanceStatus: 'full day' },
      { id: 2, employeeId: 11, employeeName: 'Test 2', date: '2026-02-16', attendanceStatus: 'half day' },
      { id: 3, employeeId: 12, employeeName: 'Test 3', checkinDate: undefined, attendanceDate: undefined, date: undefined, attendanceStatus: 'absent' },
    ],
    totalElements: 3,
    totalPages: 1,
    number: 0,
    size: 50,
  };

  // Mock fetch to return our mockResponse
  const prevFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify(mockResponse), { status: 200, headers: { 'Content-Type': 'application/json' } });
  try {
    const { attendanceApi } = await import('../lib/attendance-api.ts');
    const page = await attendanceApi.getByDate('test-token', '2026-02-15', 0, 50);
    // First record: checkinDate should be derived from attendanceDate
    assert.equal(page.content[0].checkinDate, '2026-02-15');
    assert.equal(page.content[0].attendanceDate, '2026-02-15');
    // Second record: checkinDate from date
    assert.equal(page.content[1].checkinDate, '2026-02-16');
    // Third record: missing dates -> checkinDate should be '' (safe empty)
    assert.equal(page.content[2].checkinDate, '');
    // No record should have undefined checkinDate
    for (const r of page.content) {
      assert.ok(typeof r.checkinDate === 'string', 'checkinDate must be string');
      assert.doesNotThrow(() => normalizeDate(r.checkinDate));
    }
  } finally {
    globalThis.fetch = prevFetch;
  }
});

test('breakdown loop skips invalid checkinDate safely', () => {
  const monthStart = new Date(2026, 1, 1); // Feb 1
  const monthEnd = new Date(2026, 1, 28);
  const attendanceData = [
    { checkinDate: '2026-02-10', attendanceStatus: 'full day', rawStatus: 'full day' },
    { checkinDate: undefined, attendanceStatus: 'full day', rawStatus: 'full day' },
    { checkinDate: '', attendanceStatus: 'half day', rawStatus: 'half day' },
    { checkinDate: null, attendanceStatus: 'absent', rawStatus: 'absent' },
    { checkinDate: 'invalid-date', attendanceStatus: 'full day', rawStatus: 'full day' },
  ];
  let counted = 0;
  for (const r of attendanceData) {
    if (!r.checkinDate || typeof r.checkinDate !== 'string' || !r.checkinDate.trim()) continue;
    const d = new Date(r.checkinDate);
    if (Number.isNaN(d.getTime())) continue;
    if (d < monthStart || d > monthEnd) continue;
    counted++;
  }
  assert.equal(counted, 1); // only first record should be counted
});
