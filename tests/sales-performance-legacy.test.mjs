import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const componentPath = path.join(process.cwd(), 'components/SalesPerformanceReport.tsx');
const content = fs.readFileSync(componentPath, 'utf8');
const withoutComments = content.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const legacyMustBeRemoved = [
  '/store/filteredValues',
  'store/filteredValues',
  '/report/getAvgValues',
  'report/getAvgValues',
  'axios.get',
];

test('Sales Performance does not invoke legacy store/report routes (actual fetch)', () => {
  for (const pattern of legacyMustBeRemoved) {
    // Check for actual fetch/API call, not just gap message
    const hasFetch = withoutComments.includes(pattern) && withoutComments.includes('fetch(');
    const hasAxios = withoutComments.includes('axios');
    // For store/report, ensure no fetch to those legacy paths
    if (pattern.includes('/store/') || pattern.includes('/report/')) {
      assert.equal(hasFetch && withoutComments.includes(pattern), false, `Should not fetch legacy ${pattern}`);
    }
    if (pattern === 'axios.get') {
      assert.equal(withoutComments.includes('axios.get'), false, 'Should not use axios.get for legacy store/report');
    }
  }
  // Ensure no direct legacy URL in code (outside gap comment)
  assert.equal(withoutComments.includes('http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/store/filteredValues'), false);
  assert.equal(withoutComments.includes('http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/report/getAvgValues'), false);
});

test('Sales Performance uses documented paginated account endpoint for selector', () => {
  assert.ok(content.includes('RetailAPI.getAccounts'), 'Should use RetailAPI.getAccounts for store selector');
  assert.ok(content.includes('/api/retail/accounts') || content.includes('RetailAPI.getAccounts'), 'Should use GET /api/retail/accounts');
  // Check for pagination handling
  assert.ok(withoutComments.includes('page: 0') && withoutComments.includes('size: 10'), 'Should handle paginated response (page/size)');
});

test('Sales Performance uses documented sales endpoint only where needed and shows gap for aggregate', () => {
  // Should mention the documented sales endpoint in a comment or reference, but not call it for the aggregate gap
  assert.ok(content.includes('/api/retail/accounts/{accountId}/sales') || content.includes('RetailAPI.getSales'), 'Should reference documented GET /api/retail/accounts/{accountId}/sales where needed');
  // Gap message should be present
  assert.ok(content.includes('Sales Performance aggregate is a backend gap'), 'Should show explicit backend-gap for pricing-performance aggregate');
  assert.ok(content.includes('No 404 request was made'), 'Gap message should mention no 404');
  // Ensure no fetch to average-price aggregate
  assert.equal(withoutComments.includes('fetch(') && withoutComments.includes('/report/getAvgValues'), false, 'Should not fetch average-price aggregate');
});

test('Sales Performance preserves filters and prevents duplicate requests', () => {
  assert.ok(withoutComments.includes('cityFilter'), 'Should preserve city filter');
  assert.ok(withoutComments.includes('storeSearchQuery'), 'Should preserve store search');
  assert.ok(withoutComments.includes('dateRangeInvalid'), 'Should preserve date range validation');
  assert.ok(withoutComments.includes('selectedStore'), 'Should preserve account selection');
  assert.ok(content.includes('if (loading) return'), 'Should guard duplicate in-flight report generation');
  assert.ok(content.includes('DateRangeError'), 'Should preserve DateRangeError');
});

test('Sales Performance does not invent pricing-performance aggregate', () => {
  // Check for actual fetch to invented endpoints, not gap message text
  const hasFetchTo = (path) => withoutComments.includes(`fetch(`) && withoutComments.includes(path);
  assert.equal(hasFetchTo('/api/report/pricing-performance'), false, 'Should not fetch /api/report/pricing-performance');
  assert.equal(hasFetchTo('/api/hr/pricing'), false, 'Should not fetch /api/hr/pricing');
  // Gap message may mention average-price, but should not fetch it
  assert.equal(hasFetchTo('average-price'), false, 'Should not fetch average-price endpoint');
});
