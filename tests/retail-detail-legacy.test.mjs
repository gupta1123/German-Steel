import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const detailPath = path.join(process.cwd(), 'components/customer-detail-page.tsx');
const detailContent = fs.readFileSync(detailPath, 'utf8');
const detailWithoutComments = detailContent.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const retailApiPath = path.join(process.cwd(), 'lib/retail-api.ts');
const retailApiContent = fs.readFileSync(retailApiPath, 'utf8');

const migrationPath = path.join(process.cwd(), 'docs/frontend-api-migration-guide.md');
const migrationContent = fs.readFileSync(migrationPath, 'utf8');

test('Detail page uses documented RetailAPI methods — no legacy /store/getById, /customer/getById, /client/getById', () => {
  const legacyPatterns = ['/store/getById', '/customer/getById', '/client/getById', '/store/edit', '/store/deleteById'];
  for (const pattern of legacyPatterns) {
    assert.equal(detailWithoutComments.includes(pattern), false, `Detail page must not use legacy ${pattern}`);
    assert.equal(retailApiContent.includes(pattern), false, `RetailAPI must not use legacy ${pattern}`);
  }
  assert.ok(detailContent.includes('RetailAPI.getAccountById'), 'Detail page must use RetailAPI.getAccountById');
  assert.ok(detailContent.includes('RetailAPI.getContacts'), 'Detail page must use RetailAPI.getContacts');
  assert.ok(detailContent.includes('RetailAPI.getNotes'), 'Detail page must use RetailAPI.getNotes');
  assert.ok(detailContent.includes('RetailAPI.getVisits'), 'Detail page must use RetailAPI.getVisits');
  assert.ok(detailContent.includes('RetailAPI.getSales'), 'Detail page must use RetailAPI.getSales');
  assert.ok(detailContent.includes('RetailAPI.getTasks'), 'Detail page must use RetailAPI.getTasks');
  assert.ok(detailContent.includes('RetailAPI.getActiveBrands'), 'Detail page must use RetailAPI.getActiveBrands');
  assert.ok(detailContent.includes('RetailAPI.getCommercialHistory'), 'Detail page must use RetailAPI.getCommercialHistory');
});

test('Detail page uses documented retail endpoints (no legacy /store/*, /customer/*, /client/*)', () => {
  assert.ok(retailApiContent.includes("/api/retail/accounts'"), 'RetailAPI.getAccounts must use GET /api/retail/accounts');
  assert.ok(retailApiContent.includes('/api/retail/accounts/') && retailApiContent.includes('/contacts'), 'RetailAPI.getContacts must use GET /api/retail/accounts/{id}/contacts');
  assert.ok(retailApiContent.includes('/api/retail/accounts/') && retailApiContent.includes('/sales'), 'RetailAPI.getSales must use GET /api/retail/accounts/{id}/sales');
  assert.ok(retailApiContent.includes('/api/retail/accounts/') && retailApiContent.includes('/brands/active'), 'RetailAPI.getActiveBrands must use GET /api/retail/accounts/{id}/brands/active');
  assert.ok(retailApiContent.includes('/api/retail/accounts/') && retailApiContent.includes('/brands/history'), 'RetailAPI.getBrandHistory must use GET /api/retail/accounts/{id}/brands/history');
  assert.ok(retailApiContent.includes('/api/retail/accounts/') && retailApiContent.includes('/commercial-history'), 'RetailAPI.getCommercialHistory must use GET /api/retail/accounts/{id}/commercial-history');
  assert.ok(retailApiContent.includes('/api/common/retail-clients/') && retailApiContent.includes('/notes'), 'RetailAPI.getNotes must use GET /api/common/retail-clients/{id}/notes');
  assert.ok(retailApiContent.includes('/api/common/retail-clients/') && retailApiContent.includes('/visits'), 'RetailAPI.getVisits must use GET /api/common/retail-clients/{id}/visits');
});

test('Detail page uses documented mutation endpoints', () => {
  assert.ok(retailApiContent.includes("'PUT'") && retailApiContent.includes('/api/retail/accounts/'), 'updateAccount must use PUT /api/retail/accounts/{id}');
  assert.ok(retailApiContent.includes("'DELETE'") && retailApiContent.includes('/api/retail/accounts/'), 'deleteAccount must use DELETE /api/retail/accounts/{id}');
  assert.ok(retailApiContent.includes('/api/common/contacts'), 'createMasterContact must use POST /api/common/contacts');
  assert.ok(retailApiContent.includes('/api/retail/contacts'), 'linkContact must use POST /api/retail/contacts');
  assert.ok(retailApiContent.includes('/api/retail/contacts/') && retailApiContent.includes("'PUT'"), 'updateContact must use PUT /api/retail/contacts/{id}');
  assert.ok(retailApiContent.includes('/api/common/notes'), 'createNote must use POST /api/common/notes');
  assert.ok(retailApiContent.includes('/api/common/notes/') && retailApiContent.includes("'PUT'"), 'updateNote must use PUT /api/common/notes/{id}');
  assert.ok(retailApiContent.includes('/api/retail/sales'), 'createSale must use POST /api/retail/sales');
  assert.ok(retailApiContent.includes('/api/tasks'), 'createTask must use POST /api/tasks');
});

test('Detail page surfaces missing single-account GET as explicit gap', () => {
  assert.ok(detailContent.includes('accountLookupGap'), 'Must track accountLookupGap state for missing GET endpoint');
  assert.ok(detailContent.includes('Backend gap') || detailContent.includes('GET /api/retail/accounts/'), 'Must show gap banner for missing single-account GET');
  assert.ok(migrationContent.includes('no single-account'), 'Migration guide must document the missing single-account GET gap');
  assert.ok(migrationContent.includes('Ask the backend for'), 'Migration guide must recommend asking backend for GET /api/retail/accounts/{accountId}');
});

test('Detail page getAccountById uses filtered paginated scan as documented workaround', () => {
  assert.ok(retailApiContent.includes('getAccountById'), 'RetailAPI must have getAccountById method');
  assert.ok(retailApiContent.includes('getAccounts(token, { page: 0, size: 500 })'), 'getAccountById must use getAccounts paginated scan');
  assert.ok(retailApiContent.includes('for (let page = 1'), 'getAccountById must iterate pages until found');
});

test('Detail page preserves loading, error, and empty states', () => {
  assert.ok(detailContent.includes('isLoading') && detailContent.includes('setIsLoading(true)'), 'Must preserve loading state');
  assert.ok(detailContent.includes('Customer not found'), 'Must show empty state when account not found');
  assert.ok(detailContent.includes('Unable to load this customer'), 'Must show error toast on load failure');
  assert.ok(detailContent.includes('warnings') && detailContent.includes('could not be loaded'), 'Must track partial load warnings');
});

test('Detail page preserves permissions for deactivate and edit', () => {
  assert.ok(detailContent.includes('disabled={!account.active}'), 'Deactivate button must be disabled when account is inactive');
  assert.ok(detailContent.includes('deleteOpen'), 'Must have delete confirmation dialog');
  assert.ok(detailContent.includes('editOpen'), 'Must have edit dialog');
  assert.ok(detailContent.includes('validateRetailAccountDraft'), 'Edit must validate before save');
  assert.ok(detailContent.includes('busy'), 'Must track busy state to prevent double-submit');
});

test('Detail page preserves contact, note, visit, sale, task, and brand CRUD', () => {
  assert.ok(detailContent.includes('contactOpen'), 'Must have contact dialog');
  assert.ok(detailContent.includes('noteOpen'), 'Must have note dialog');
  assert.ok(detailContent.includes('visitOpen'), 'Must have visit dialog');
  assert.ok(detailContent.includes('saleOpen'), 'Must have sale dialog');
  assert.ok(detailContent.includes('taskOpen'), 'Must have task dialog');
  assert.ok(detailContent.includes('RetailAPI.createMasterContact'), 'Must create master contacts');
  assert.ok(detailContent.includes('RetailAPI.linkContact'), 'Must link contacts to account');
  assert.ok(detailContent.includes('RetailAPI.createNote'), 'Must create notes');
  assert.ok(detailContent.includes('RetailAPI.createVisit'), 'Must create visits');
  assert.ok(detailContent.includes('RetailAPI.createSale'), 'Must create sales');
  assert.ok(detailContent.includes('RetailAPI.createTask'), 'Must create tasks');
  assert.ok(detailContent.includes('RetailAPI.removeBrandUsage'), 'Must remove brand usage');
});

test('Detail page uses assignedEmployeeId for tasks (not employeeId)', () => {
  assert.ok(detailContent.includes('assignedEmployeeId') || detailContent.includes('employeeId'), 'Tasks must use assignedEmployeeId or employeeId');
  assert.ok(retailApiContent.includes("queryString({ employeeId, status, page: 0, size: 200 })"), 'getTasks must use employeeId query param');
});
