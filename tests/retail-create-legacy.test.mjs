import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const modalPath = path.join(process.cwd(), 'components/AddCustomerModal.tsx');
const modalContent = fs.readFileSync(modalPath, 'utf8');
const modalWithoutComments = modalContent.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const retailApiPath = path.join(process.cwd(), 'lib/retail-api.ts');
const retailApiContent = fs.readFileSync(retailApiPath, 'utf8');

const retailAccountPath = path.join(process.cwd(), 'lib/retail-account.ts');
const retailAccountContent = fs.readFileSync(retailAccountPath, 'utf8');

test('Create modal uses documented POST /api/retail/accounts endpoint', () => {
  assert.ok(retailApiContent.includes("'/api/retail/accounts'"), 'RetailAPI.createAccount must POST to /api/retail/accounts');
  assert.ok(retailApiContent.includes("async createAccount"), 'RetailAPI must expose createAccount method');
  assert.ok(retailApiContent.includes("'POST'"), 'createAccount must use POST method');
  assert.ok(modalContent.includes('RetailAPI.createAccount'), 'Modal must call RetailAPI.createAccount');
  assert.ok(modalContent.includes('buildRetailAccountPayload'), 'Modal must use buildRetailAccountPayload to build the payload');
});

test('Create payload matches documented contract fields', () => {
  const requiredFields = [
    'accountName', 'clientType', 'gstNumber', 'clientGroupId', 'accountStatus',
    'ownerEmployeeId', 'addressVillageArea', 'addressTaluka', 'addressCity',
    'addressDistrict', 'addressState', 'pinCode', 'outletLatitude', 'outletLongitude',
    'declaredMonthlySalesMt', 'focusSector', 'creditTermsDays', 'creditLimitAmount',
    'clientTier', 'networkMember', 'networkOnboardingDate', 'networkStatus', 'active',
  ];
  for (const field of requiredFields) {
    assert.ok(retailAccountContent.includes(field), `buildRetailAccountPayload must include ${field}`);
  }
  assert.ok(retailAccountContent.includes("'PROSPECT'"), 'Default accountStatus must be PROSPECT');
  assert.ok(retailAccountContent.includes("'DEALER'"), 'Default clientType must be DEALER');
  assert.ok(retailAccountContent.includes("'B'"), 'Default clientTier must be B');
});

test('Create modal generates fresh unique session ID on each open', () => {
  assert.ok(modalContent.includes('formSessionIdRef'), 'Must have a formSessionIdRef for unique session tracking');
  assert.ok(modalContent.includes('randomUUID') || modalContent.includes('Date.now()'), 'Must generate unique ID via crypto.randomUUID or Date.now fallback');
  // Verify resetForm regenerates the session ID
  assert.ok(modalContent.includes('resetForm'), 'Must have resetForm function');
  const resetFormMatch = modalContent.match(/const resetForm = \(\) => \{[\s\S]*?formSessionIdRef/);
  assert.ok(resetFormMatch, 'resetForm must set formSessionIdRef');
});

test('Create modal does not reuse demo defaults — opens with empty/blank fields', () => {
  assert.ok(retailAccountContent.includes("accountName: ''"), 'Default accountName must be empty string');
  assert.ok(retailAccountContent.includes("gstNumber: ''"), 'Default gstNumber must be empty string');
  assert.ok(retailAccountContent.includes("addressCity: ''"), 'Default addressCity must be empty string');
  assert.ok(retailAccountContent.includes("pinCode: ''"), 'Default pinCode must be empty string');
  assert.ok(retailAccountContent.includes("outletLatitude: ''"), 'Default outletLatitude must be empty string');
  assert.ok(retailAccountContent.includes("outletLongitude: ''"), 'Default outletLongitude must be empty string');
});

test('Create modal preserves required field validation', () => {
  assert.ok(retailAccountContent.includes('validateRetailAccountDraft'), 'Must have validateRetailAccountDraft function');
  assert.ok(retailAccountContent.includes('Client firm name'), 'Must validate accountName');
  assert.ok(retailAccountContent.includes('GST number'), 'Must validate gstNumber');
  assert.ok(retailAccountContent.includes('Assigned salesperson'), 'Must validate ownerEmployeeId');
  assert.ok(retailAccountContent.includes('Village / area'), 'Must validate addressVillageArea');
  assert.ok(retailAccountContent.includes('PIN code'), 'Must validate pinCode');
  assert.ok(retailAccountContent.includes('Outlet latitude'), 'Must validate outletLatitude');
  assert.ok(retailAccountContent.includes('Outlet longitude'), 'Must validate outletLongitude');
  assert.ok(retailAccountContent.includes('GSTIN_PATTERN') || retailAccountContent.includes('GSTIN'), 'Must validate GSTIN format');
});

test('Create modal preserves contact validation', () => {
  assert.ok(modalContent.includes('validateContacts'), 'Must have validateContacts function');
  assert.ok(modalContent.includes('first name is required'), 'Must require contact first name');
  assert.ok(modalContent.includes('designation / role is required'), 'Must require contact designation');
  assert.ok(modalContent.includes('10 digits'), 'Must validate mobile number is 10 digits');
  assert.ok(modalContent.includes('primary contact'), 'Must require exactly one primary contact');
});

test('Create modal preserves Prospect status default and Network No status', () => {
  assert.ok(retailAccountContent.includes("accountStatus: 'PROSPECT'"), 'Default account status must be PROSPECT');
  assert.ok(retailAccountContent.includes('networkMember: false'), 'Default network member must be false');
  assert.ok(modalContent.includes('Prospect'), 'UI must offer Prospect option');
  assert.ok(modalContent.includes('PROSPECT'), 'UI must map to PROSPECT API value');
});

test('Create modal does not use legacy /store/create, /customer/create, or /client/create routes', () => {
  const legacyPatterns = ['/store/create', '/customer/create', '/client/create', '/store/edit', '/store/deleteById'];
  for (const pattern of legacyPatterns) {
    assert.equal(modalWithoutComments.includes(pattern), false, `Must not use legacy ${pattern}`);
    assert.equal(retailApiContent.includes(pattern), false, `RetailAPI must not use legacy ${pattern}`);
  }
});

test('Create modal uses documented contact and brand endpoints', () => {
  assert.ok(retailApiContent.includes("'/api/common/contacts'"), 'Must create master contacts via POST /api/common/contacts');
  assert.ok(retailApiContent.includes("'/api/retail/contacts'"), 'Must link contacts via POST /api/retail/contacts');
  assert.ok(retailApiContent.includes("'/api/retail/brands'"), 'Must add brand usage via POST /api/retail/brands');
  assert.ok(modalContent.includes('RetailAPI.createMasterContact'), 'Modal must call createMasterContact');
  assert.ok(modalContent.includes('RetailAPI.linkContact'), 'Modal must call linkContact');
  assert.ok(modalContent.includes('RetailAPI.addBrandUsage'), 'Modal must call addBrandUsage');
});

test('Create modal navigates to detail page after successful creation', () => {
  assert.ok(modalContent.includes('useRouter'), 'Must import useRouter for navigation');
  assert.ok(modalContent.includes('router.push'), 'Must use router.push for post-create navigation');
  assert.ok(modalContent.includes('/dashboard/customers/'), 'Must navigate to /dashboard/customers/{id} after creation');
});

test('Create modal preserves loading, error, and permission states', () => {
  assert.ok(modalContent.includes('isSubmitting'), 'Must track submitting state');
  assert.ok(modalContent.includes('isLoadingMasters'), 'Must track master data loading state');
  assert.ok(modalContent.includes('submitErrors'), 'Must track validation errors');
  assert.ok(modalContent.includes('masterWarnings'), 'Must track master data load warnings');
  assert.ok(modalContent.includes('isCreating') || modalContent.includes('isSubmitting'), 'Must disable form during submission');
  assert.ok(modalContent.includes('disabled={isSubmitting}'), 'Must disable buttons during submission');
});
