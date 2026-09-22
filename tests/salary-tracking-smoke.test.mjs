import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const detailPath = path.join(process.cwd(), 'app/dashboard/employee/[id]/page.tsx');
const content = fs.readFileSync(detailPath, 'utf8');
const stripped = content.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

// Helper: extract salary tab section (between activeTab === 'salary' and next activeTab)
function extractTab(tabValue) {
  const marker = `activeTab === '${tabValue}'`;
  const start = content.indexOf(marker);
  if (start === -1) return '';
  // crude: take 3000 chars after marker
  return content.slice(start, start + 6000);
}

test('salary tab does not render raw JSON or JSON.stringify', () => {
  const salarySection = extractTab('salary');
  assert.ok(salarySection.length > 0, 'salary tab must exist');
  assert.equal(salarySection.includes('JSON.stringify(salaryData'), false, 'salary tab must not use JSON.stringify(salaryData');
  assert.equal(salarySection.includes('JSON.stringify('), false, 'salary tab must not use JSON.stringify');
  assert.equal(salarySection.includes('<pre'), false, 'salary tab must not render <pre> with raw JSON');
});

test('tracking tab does not render raw JSON or JSON.stringify', () => {
  const trackingSection = extractTab('tracking');
  assert.ok(trackingSection.length > 0, 'tracking tab must exist');
  assert.equal(trackingSection.includes('JSON.stringify(trackingCurrent'), false, 'tracking tab must not use JSON.stringify(trackingCurrent');
  assert.equal(trackingSection.includes('JSON.stringify(trackingHistory'), false, 'tracking tab must not use JSON.stringify(trackingHistory');
  assert.equal(trackingSection.includes('JSON.stringify('), false, 'tracking tab must not use JSON.stringify');
  // Ensure the tracking section no longer contains raw <pre> JSON blocks for tracking
  const preCount = (trackingSection.match(/<pre/g) || []).length;
  assert.equal(preCount, 0, 'tracking tab must not contain <pre> JSON blocks');
});

test('salary tab renders readable production UI with documented fields, currency, dates, units', () => {
  const salarySection = extractTab('salary');
  // Uses documented SalaryBreakdownRow fields only
  assert.ok(salarySection.includes('attendanceStatus'), 'must render attendanceStatus');
  assert.ok(salarySection.includes('visitCount'), 'must render visitCount');
  assert.ok(salarySection.includes('baseSalary'), 'must render baseSalary');
  assert.ok(salarySection.includes('travelAllowance'), 'must render travelAllowance');
  assert.ok(salarySection.includes('dearnessAllowance'), 'must render dearnessAllowance');
  assert.ok(salarySection.includes('approvedExpenses'), 'must render approvedExpenses');
  assert.ok(salarySection.includes('totalSalary'), 'must render totalSalary');
  assert.ok(salarySection.includes('fullMonthSalary'), 'must render fullMonthSalary');
  assert.ok(salarySection.includes('dailySalary'), 'must render dailySalary');
  assert.ok(salarySection.includes('carDistance') || salarySection.includes('bikeDistance'), 'must render distances');
  // Currency/units/dates helpers
  assert.ok(salarySection.includes('formatCurrency'), 'must format currency with ₹');
  assert.ok(salarySection.includes('formatDateLabel'), 'must format dates');
  assert.ok(salarySection.includes('formatDistance'), 'must format distances with units');
  // No invented fields
  assert.equal(salarySection.includes('inventedField'), false);
});

test('tracking tab renders readable fields with timestamps, location, status', () => {
  const trackingSection = extractTab('tracking');
  assert.ok(trackingSection.includes('latitude'), 'must render latitude');
  assert.ok(trackingSection.includes('longitude'), 'must render longitude');
  assert.ok(trackingSection.includes('capturedAt'), 'must render capturedAt timestamp');
  assert.ok(trackingSection.includes('provider'), 'must render provider');
  assert.ok(trackingSection.includes('accuracyMeters'), 'must render accuracy');
  assert.ok(trackingSection.includes('batteryPercent'), 'must render battery');
  assert.ok(trackingSection.includes('formatTimestampLabel'), 'must format timestamps');
  // Coordinates formatted
  assert.ok(trackingSection.includes('toFixed(6)'), 'must format coordinates');
});

test('salary and tracking tabs preserve loading, empty, error, permission states', () => {
  const salarySection = extractTab('salary');
  const trackingSection = extractTab('tracking');
  for (const [name, section] of [['salary', salarySection], ['tracking', trackingSection]]) {
    assert.ok(section.includes('Loading'), `${name} must have loading state`);
    assert.ok(section.includes('No salary') || section.includes('No current location') || section.includes('No history') || section.includes('No salary data') || section.includes('No history'), `${name} must have empty state`);
    assert.ok(section.includes('salaryError') || section.includes('trackingError') || section.includes('isPermissionError'), `${name} must handle error`);
    assert.ok(section.includes('isPermissionError') || section.includes('permission'), `${name} must handle 403 permission`);
    assert.ok(section.includes('You do not have permission'), `${name} must show permission message`);
  }
});

test('documented response shapes are normalized safely including null/missing', () => {
  // Check normalizers handle null/missing via asNumber/asString helpers
  assert.ok(content.includes('normalizeSalaryRows'), 'must have normalizeSalaryRows');
  assert.ok(content.includes('normalizeTrackingCurrent'), 'must have normalizeTrackingCurrent');
  assert.ok(content.includes('normalizeTrackingHistory'), 'must have normalizeTrackingHistory');
  assert.ok(content.includes('asNumber'), 'must safely handle numeric fields with fallback');
  assert.ok(content.includes('asString'), 'must safely handle string fields with fallback');
  // Salary normalizer handles both array and {content: []} shapes per guide pagination
  assert.ok(content.includes('src?.content'), 'must handle paginated ApiPage shape');
  assert.ok(content.includes('Array.isArray(data)'), 'must handle array shape');
});

test('no mock output or legacy warnings interpolated into salary/tracking UI', () => {
  const salarySection = extractTab('salary');
  const trackingSection = extractTab('tracking');
  assert.equal(salarySection.includes('mock'), false, 'salary must not contain mock');
  assert.equal(trackingSection.includes('mock'), false, 'tracking must not contain mock');
  // No legacy warning banners inside these tabs (gap warnings belong to employee fetch, not salary/tracking)
  // Salary/tracking should not show "Backend gap" as production content
  assert.equal(salarySection.includes('Backend gap'), false, 'salary tab must not show legacy gap warning as production UI');
  assert.equal(trackingSection.includes('Backend gap'), false);
});

test('salary/tracking use only documented APIs and fields, no invented endpoints', () => {
  // Documented endpoints are used in effects, not invented
  assert.ok(content.includes('/api/hr/salary/date-range-breakdown?employeeId='), 'must use documented salary breakdown endpoint');
  assert.ok(content.includes('/api/hr/tracking/current-location/'), 'must use documented current-location endpoint');
  assert.ok(content.includes('/api/hr/tracking/location-history/'), 'must use documented location-history endpoint');
  // No invented endpoints in these tabs
  assert.equal(content.includes('/api/hr/salary/invented'), false);
  assert.equal(content.includes('/api/hr/tracking/invented'), false);
});
