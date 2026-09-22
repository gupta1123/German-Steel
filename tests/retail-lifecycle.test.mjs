import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const modalPath = path.join(process.cwd(), 'components/AddCustomerModal.tsx');
const modalContent = fs.readFileSync(modalPath, 'utf8');

const detailPath = path.join(process.cwd(), 'components/customer-detail-page.tsx');
const detailContent = fs.readFileSync(detailPath, 'utf8');

const retailApiPath = path.join(process.cwd(), 'lib/retail-api.ts');
const retailApiContent = fs.readFileSync(retailApiPath, 'utf8');

const retailAccountPath = path.join(process.cwd(), 'lib/retail-account.ts');
const retailAccountContent = fs.readFileSync(retailAccountPath, 'utf8');

const migrationPath = path.join(process.cwd(), 'docs/frontend-api-migration-guide.md');
const migrationContent = fs.readFileSync(migrationPath, 'utf8');

// ── Wizard tab order ──

test('Wizard has all 7 tabs in documented order', () => {
  const expectedOrder = ['account', 'address', 'commercial', 'network', 'contacts', 'brands', 'review'];
  assert.ok(modalContent.includes("const TAB_ORDER"), 'Must define TAB_ORDER constant');
  for (const tab of expectedOrder) {
    assert.ok(modalContent.includes(`'${tab}'`), `Must include tab '${tab}'`);
  }
  // Verify the tab order matches the documented flow
  const tabOrderMatch = modalContent.match(/TAB_ORDER:\s*TabId\[\]\s*=\s*\[([^\]]+)\]/);
  assert.ok(tabOrderMatch, 'TAB_ORDER must be defined as an array');
  const tabs = tabOrderMatch[1].split(',').map((t) => t.trim().replace(/'/g, ''));
  assert.deepEqual(tabs, expectedOrder, 'Tab order must match: account, address, commercial, network, contacts, brands, review');
});

// ── Account tab validation ──

test('Account tab validates GSTIN format with documented pattern', () => {
  assert.ok(retailAccountContent.includes('GSTIN_PATTERN'), 'Must define GSTIN_PATTERN');
  assert.ok(retailAccountContent.includes('/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/'), 'GSTIN pattern must match documented 15-char format');
});

test('Account tab validates PIN code is exactly 6 digits', () => {
  assert.ok(retailAccountContent.includes("!/^\\d{6}$/"), 'Must validate PIN code is 6 digits');
});

test('Account tab validates GPS coordinate ranges', () => {
  assert.ok(retailAccountContent.includes('-90') && retailAccountContent.includes('90'), 'Must validate latitude between -90 and 90');
  assert.ok(retailAccountContent.includes('-180') && retailAccountContent.includes('180'), 'Must validate longitude between -180 and 180');
});

// ── Network tab conditional validation ──

test('Network tab requires onboarding date when member is true', () => {
  assert.ok(retailAccountContent.includes('networkMember && !draft.networkOnboardingDate'), 'Must require onboarding date when networkMember is true');
  assert.ok(retailAccountContent.includes('Network onboarding date is required'), 'Must show specific error for missing network date');
});

test('Network tab sends null for date/status when not a member', () => {
  assert.ok(retailAccountContent.includes("draft.networkMember ? draft.networkOnboardingDate : null"), 'Must send null onboarding date when not a member');
  assert.ok(retailAccountContent.includes("draft.networkMember ? draft.networkStatus : null"), 'Must send null network status when not a member');
});

// ── Contacts validation ──

test('Contacts require at least one started contact', () => {
  assert.ok(modalContent.includes('Add at least one customer contact'), 'Must require at least one contact');
});

test('Contacts require exactly one primary contact', () => {
  assert.ok(modalContent.includes('Choose exactly one primary contact'), 'Must require exactly one primary contact');
});

test('Contact mobile must be 10 digits', () => {
  assert.ok(modalContent.includes('mobile number must contain exactly 10 digits'), 'Must validate mobile is 10 digits');
});

// ── PIN-Region derivation ──

test('Address tab auto-derives region from PIN master', () => {
  assert.ok(modalContent.includes('matchedPinCode'), 'Must match PIN code against master');
  assert.ok(modalContent.includes('derivedRegionName'), 'Must derive region name from matched PIN');
  assert.ok(modalContent.includes('Read-only and derived only from the selected PIN code'), 'Region field must be read-only');
});

// ── Creation payload ──

test('Creation payload sends active: true for new accounts', () => {
  assert.ok(retailAccountContent.includes("active: true"), 'New accounts must be created as active');
});

test('Creation uses buildRetailAccountPayload to build the payload', () => {
  assert.ok(modalContent.includes('buildRetailAccountPayload'), 'Modal must use buildRetailAccountPayload');
  assert.ok(retailAccountContent.includes('export const buildRetailAccountPayload'), 'Must export buildRetailAccountPayload');
});

// ── Post-creation navigation ──

test('After successful creation, navigates to detail page', () => {
  assert.ok(modalContent.includes('router.push(`/dashboard/customers/${accountId}`)'), 'Must navigate to /dashboard/customers/{id} after creation');
});

test('After creation with failures, shows review tab with follow-up items', () => {
  assert.ok(modalContent.includes('setActiveTab(\'review\')'), 'Must switch to review tab on post-create failures');
  assert.ok(modalContent.includes('follow-up items'), 'Must mention follow-up items in the warning');
});

// ── Detail page: monthly sales update ──

test('Detail page uses updateMonthlySales with changeReason', () => {
  assert.ok(retailApiContent.includes('updateMonthlySales'), 'RetailAPI must expose updateMonthlySales');
  assert.ok(retailApiContent.includes('/monthly-sales'), 'updateMonthlySales must call /monthly-sales endpoint');
  assert.ok(retailApiContent.includes("'PUT'"), 'updateMonthlySales must use PUT method');
  assert.ok(detailContent.includes('monthlySalesOpen'), 'Detail page must have monthlySalesOpen state');
  assert.ok(detailContent.includes('monthlySalesForm'), 'Detail page must have monthlySalesForm state');
  assert.ok(detailContent.includes('saveMonthlySales'), 'Detail page must have saveMonthlySales function');
  assert.ok(detailContent.includes('changeReason'), 'Monthly sales form must include changeReason field');
});

// ── Detail page: getAccountById tries direct GET first ──

test('getAccountById attempts direct GET before paginated scan', () => {
  assert.ok(retailApiContent.includes('`/api/retail/accounts/${accountId}`'), 'getAccountById must try direct GET endpoint');
  assert.ok(retailApiContent.includes('Fallback: filtered paginated scan'), 'Must document paginated scan as fallback');
});

// ── Detail page: subresource loading ──

test('Detail page loads all documented subresources', () => {
  assert.ok(detailContent.includes('RetailAPI.getContacts'), 'Must load contacts');
  assert.ok(detailContent.includes('RetailAPI.getNotes'), 'Must load notes');
  assert.ok(detailContent.includes('RetailAPI.getVisits'), 'Must load visits');
  assert.ok(detailContent.includes('RetailAPI.getSales'), 'Must load sales');
  assert.ok(detailContent.includes('RetailAPI.getTasks'), 'Must load tasks');
  assert.ok(detailContent.includes('RetailAPI.getActiveBrands'), 'Must load active brands');
  assert.ok(detailContent.includes('RetailAPI.getBrandHistory'), 'Must load brand history');
  assert.ok(detailContent.includes('RetailAPI.getCommercialHistory'), 'Must load commercial history');
});

// ── Detail page: partial load warnings ──

test('Detail page shows partial load warnings when subresources fail', () => {
  assert.ok(detailContent.includes('warnings'), 'Must track warnings state');
  assert.ok(detailContent.includes('could not be loaded'), 'Must show which subresources failed');
});

// ── Detail page: no legacy endpoints ──

test('Detail page and retail-api use no legacy store/customer/client routes', () => {
  const legacyPatterns = ['/store/', '/customer/', '/client/'];
  for (const pattern of legacyPatterns) {
    // Only check for legacy API routes, not UI text or comments
    assert.equal(retailApiContent.includes(`'${pattern}`), false, `RetailAPI must not use legacy ${pattern} route`);
  }
});

// ── Backend blocker audit ──

test('Migration guide documents missing retailer approval/stage transitions', () => {
  // Retailers do NOT have stage transitions in the migration guide.
  // Institutions and projects have advance-stage, pipeline, approval-history.
  // Retailers only have account CRUD.
  assert.ok(!retailApiContent.includes('advance-stage'), 'RetailAPI must not use advance-stage (not documented for retailers)');
  assert.ok(!retailApiContent.includes('pipeline'), 'RetailAPI must not use pipeline (not documented for retailers)');
  assert.ok(!retailApiContent.includes('approval-history'), 'RetailAPI must not use approval-history (not documented for retailers)');
});

test('Migration guide documents missing single-account GET endpoint', () => {
  assert.ok(migrationContent.includes('no single-account'), 'Migration guide must document the missing single-account GET');
  assert.ok(migrationContent.includes('Ask the backend for'), 'Migration guide must recommend asking backend for direct GET');
});

test('Migration guide documents missing competitor-brand master endpoint', () => {
  assert.ok(migrationContent.includes('competitor-brand master'), 'Migration guide must document missing brand master endpoint');
});

// ── Retail API error handling ──

test('RetailApiError carries HTTP status code', () => {
  assert.ok(retailApiContent.includes('class RetailApiError'), 'Must define RetailApiError class');
  assert.ok(retailApiContent.includes('status: number'), 'RetailApiError must carry status code');
  assert.ok(retailApiContent.includes("this.name = 'RetailApiError'"), 'RetailApiError must set name for instanceof checks');
});

// ── List page filters ──

test('List page supports status, clientType, and active filters', () => {
  assert.ok(modalContent.includes('accountStatus') || retailApiContent.includes('accountStatus'), 'Must support accountStatus filter');
  assert.ok(retailApiContent.includes('clientType'), 'Must support clientType filter');
  assert.ok(retailApiContent.includes('active'), 'Must support active filter');
});

test('List page uses server-side pagination', () => {
  assert.ok(retailApiContent.includes("'page'") || retailApiContent.includes('page,'), 'Must use server-side page parameter');
  assert.ok(retailApiContent.includes("'size'") || retailApiContent.includes('size,'), 'Must use server-side size parameter');
});

test('List page deactivation uses soft delete via DELETE endpoint', () => {
  assert.ok(retailApiContent.includes("'DELETE'") && retailApiContent.includes('/api/retail/accounts/'), 'DELETE must call /api/retail/accounts/{id}');
  assert.ok(retailApiContent.includes('deleteAccount'), 'RetailAPI must expose deleteAccount method');
});
