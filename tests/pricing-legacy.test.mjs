import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const pricingPath = path.join(process.cwd(), 'app/dashboard/pricing/page.tsx');
const content = fs.readFileSync(pricingPath, 'utf8');
const withoutComments = content.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const legacyPatterns = [
  '/brand/getByTeamAndDate',
  '/brand/getByDateRange',
  '/brand/create',
  '/brand/',
  'brand/getBy',
  '/store/filteredValues',
  '/store/*',
  '/report/getAvgValues',
  'getAvgValues',
  'API.getTeamByEmployee',
  '/employee/team/getbyEmployee',
  '/user/manage/current-user',
];

test('Pricing does not invoke legacy brand/store/report routes (actual fetch)', () => {
  for (const pattern of legacyPatterns) {
    // Check for actual fetch/API call, not just gap message
    const hasFetch = withoutComments.includes('fetch(') && withoutComments.includes(pattern);
    const hasApiCall = withoutComments.includes('API.') && withoutComments.includes(pattern);
    // For brand/store/report, ensure no fetch to those paths
    if (pattern.startsWith('/brand') || pattern.startsWith('/store') || pattern.startsWith('/report')) {
      assert.equal(hasFetch, false, `Should not fetch legacy ${pattern}`);
    }
    if (pattern === 'API.getTeamByEmployee' || pattern === '/employee/team/getbyEmployee') {
      assert.equal(withoutComments.includes('API.getTeamByEmployee'), false, 'Should not call API.getTeamByEmployee');
      assert.equal(withoutComments.includes('/employee/team/getbyEmployee'), false);
    }
    if (pattern === '/user/manage/current-user') {
      assert.equal(withoutComments.includes('/user/manage/current-user'), false);
    }
  }
  // Ensure no axios or direct brand fetch (gap message may mention the path, but not as fetch)
  assert.equal(withoutComments.includes('axios.get'), false, 'Should not use axios.get for brand');
  const hasBrandFetch = withoutComments.includes('fetch(') && withoutComments.includes('brand/getBy');
  assert.equal(hasBrandFetch, false, 'Should not fetch brand/getBy*');
});

test('Pricing shows explicit backend-gap and does not map brand usage', () => {
  assert.ok(content.includes('Pricing Intelligence — compatibility view (backend blocked)') || content.includes('backend blocked'), 'Should show compatibility/backend-gap banner');
  assert.ok(content.includes('competitor brand master list'), 'Should list missing competitor brand master');
  assert.ok(content.includes('paginated price observations'), 'Should list missing paginated observations');
  assert.ok(content.includes('summary/average response'), 'Should list missing summary/average');
  assert.ok(content.includes('/brand/*') || content.includes('/brand/'), 'Should mention legacy /brand/* as removed');
  // Ensure brand usage is not mapped onto pricing
  assert.ok(content.includes('Brand usage') && content.includes('must not be mapped'), 'Should state brand usage not mapped');
  assert.equal(withoutComments.includes('/api/retail/brands'), false, 'Should not fetch /api/retail/brands for pricing');
});

test('Pricing preserves permissions/loading/error/empty and prevents duplicate requests', () => {
  // Permissions via useAuth/hasManagerPrivileges, not legacy fetch
  assert.ok(content.includes('useAuth') && content.includes('isManagerRoleValue'), 'Should use useAuth for permissions, not legacy fetch');
  assert.equal(withoutComments.includes("fetch('http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/user/manage/current-user'"), false, 'Should not fetch legacy current-user for permissions');
  // No loading loop — page makes no fetch, so no duplicate; check that there is no useEffect with fetchBrandData
  assert.equal(withoutComments.includes('fetchBrandData'), false, 'Should not have fetchBrandData loop');
  assert.equal(withoutComments.includes('pricingRequest'), false, 'Should not have legacy pricingRequest dedup for brand fetch');
  // Should still have disabled filters and empty states
  assert.ok(content.includes('disabled'), 'Filters should be disabled in gap state');
  assert.ok(content.includes('Pricing is paused') || content.includes('Nothing to compare yet'), 'Should show empty gap states');
});
