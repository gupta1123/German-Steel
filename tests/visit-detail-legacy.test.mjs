import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const filePath = path.join(process.cwd(), 'components/visit-detail-page.tsx');
const brandTabPath = path.join(process.cwd(), 'components/BrandTab.tsx');
const content = fs.readFileSync(filePath, 'utf8');
const brandContent = fs.readFileSync(brandTabPath, 'utf8');
const combined = content + '\n' + brandContent;

// Strip comments to avoid false positives from gap-report comments
const withoutComments = combined.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const legacyPatternsMustBeRemoved = [
  '/visit/checkOut',
  'api.checkoutVisit',
  '/notes/getByVisit',
  'getNotesByVisit',
  '/task/getByVisit',
  'getTasksByVisit',
];
// Gap-allowed (no documented replacement, keep with gap UI, not 404)
const legacyPatternsGapAllowed = [
  '/visit/getById',
  '/visit/getProsAndCons',
  '/visit/getProCons',
  '/visit/addProCons',
  '/visit/deleteProCons',
  '/intent-audit/getByVisit',
  'getIntentAuditByVisit',
  '/monthly-sale/getByVisit',
  'getMonthlySaleByVisit',
  '/visit/getByStore',
  'getVisitsByStore',
];

test('Visit detail page does not invoke legacy visit detail routes where replacement exists', () => {
  for (const pattern of legacyPatternsMustBeRemoved) {
    assert.equal(withoutComments.includes(pattern), false, `Legacy route still present (should be replaced): ${pattern}`);
  }
  // Explicitly ensure new check-out is used
  assert.ok(withoutComments.includes('/api/common/visits/') && withoutComments.includes('/check-out'), 'Should use POST /api/common/visits/{id}/check-out');
  // Gap-allowed legacy calls should have explicit gap handling, not be called as primary
  for (const pattern of legacyPatternsGapAllowed) {
    if (withoutComments.includes(pattern)) {
      const hasGap = content.includes('Backend gap') || content.includes('no visit-level brand') || content.includes('is not documented') || brandContent.includes('Backend gap');
      assert.ok(hasGap, `Legacy gap-allowed ${pattern} should have explicit gap UI`);
    }
  }
});

test('Visit detail uses documented note and task contracts where available', () => {
  assert.ok(withoutComments.includes('/api/common/notes'), 'Should use POST/GET /api/common/notes');
  // Tasks should be via /api/tasks with assignedEmployeeId/status where documented, not getByVisit
  // The new code should contain /api/tasks?assignedEmployeeId
  assert.ok(content.includes('/api/tasks?assignedEmployeeId') || content.includes('/api/tasks'), 'Should use GET /api/tasks for visit tasks where documented');
});

test('Visit detail shows explicit backend gaps for missing contracts', () => {
  // Check for gap UI for missing detail and brand pros/cons
  assert.ok(content.includes('Backend gap: GET /api/common/visits/{visitId} is not documented') || content.includes('backend-gap'), 'Should show gap for missing detail');
  assert.ok(brandContent.includes('Backend gap: no visit-level brand') || brandContent.includes('no visit-level brand'), 'BrandTab should show gap for pros/cons');
});

test('BrandTab does not call legacy brand endpoints', () => {
  assert.equal(brandContent.includes('/visit/getProCons'), false, 'BrandTab should not call /visit/getProCons');
  assert.equal(brandContent.includes('/visit/addProCons'), false, 'BrandTab should not call /visit/addProCons');
  assert.equal(brandContent.includes('/visit/deleteProCons'), false, 'BrandTab should not call /visit/deleteProCons');
});
