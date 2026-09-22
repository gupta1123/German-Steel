import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const teamsApiPath = path.join(process.cwd(), 'lib/teams-api.ts');
const teamsApiContent = fs.readFileSync(teamsApiPath, 'utf8');

const pluralPagePath = path.join(process.cwd(), 'app/dashboard/employees/[id]/page.tsx');
const pluralContent = fs.readFileSync(pluralPagePath, 'utf8');

const singularPagePath = path.join(process.cwd(), 'app/dashboard/employee/[id]/page.tsx');
const singularContent = fs.readFileSync(singularPagePath, 'utf8');

const managedTeamsPath = path.join(process.cwd(), 'components/employee-managed-teams.tsx');
const managedTeamsContent = fs.readFileSync(managedTeamsPath, 'utf8');

const detailCompPath = path.join(process.cwd(), 'components/employee-detail-page.tsx');
const detailCompContent = fs.readFileSync(detailCompPath, 'utf8');

// --- TeamsApi client ---
test('teamsApi exposes getEmployeeById with documented GET /api/common/employees/{id}', () => {
  assert.ok(teamsApiContent.includes('async getEmployeeById'), 'teamsApi must have getEmployeeById');
  assert.ok(teamsApiContent.includes('/api/common/employees/${employeeId}'), 'must use exact documented URL /api/common/employees/{id}');
  assert.ok(teamsApiContent.includes('request(`/api/common/employees/${employeeId}`'), 'must call request helper with documented path');
  // Uses authenticated client (request helper sets Authorization: Bearer <token>)
  assert.ok(teamsApiContent.includes('Authorization: `Bearer ${token}`') || teamsApiContent.includes("Authorization: `Bearer"), 'must use authenticated request helper');
  // No hardcoded credentials
  assert.equal(teamsApiContent.includes('password') && teamsApiContent.includes('getEmployeeById'), false, 'getEmployeeById must not hardcode credentials');
});

test('teamsApi getEmployeeById normalizes response and throws 404 if not found', () => {
  assert.ok(teamsApiContent.includes('normalizeEmployee'), 'must normalize via normalizeEmployee');
  assert.ok(teamsApiContent.includes('TeamsApiError') && teamsApiContent.includes('not found'), 'must throw 404 if not found');
});

// --- Plural detail route ---
test('plural employee detail route uses documented GET via teamsApi.getEmployeeById', () => {
  assert.ok(pluralContent.includes('teamsApi.getEmployeeById'), 'must call teamsApi.getEmployeeById');
  assert.ok(pluralContent.includes('GET /api/common/employees/{employeeId}'), 'must reference documented endpoint in comment');
  // No legacy API
  const stripped = pluralContent.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.equal(stripped.includes('API.getEmployeeById'), false, 'must not use legacy API.getEmployeeById');
  assert.equal(stripped.includes('/employee/getById'), false, 'must not use legacy /employee/getById');
  assert.equal(stripped.includes('EmployeeUserDto'), false, 'must not import legacy EmployeeUserDto');
  // No hardcoded URL
  assert.equal(stripped.includes('http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/employee'), false, 'must not hardcode legacy employee URL');
  // Preserves loading/error/empty states
  assert.ok(pluralContent.includes('isLoading'), 'must keep loading state');
  assert.ok(pluralContent.includes('error'), 'must keep error state');
  assert.ok(pluralContent.includes('Employee not found'), 'must keep empty state');
});

test('plural detail route maps documented fields (mobile, department, assignedCity)', () => {
  assert.ok(pluralContent.includes('data.mobile'), 'must read mobile (not primaryContact)');
  assert.ok(pluralContent.includes('data.department'), 'must read department');
  assert.ok(pluralContent.includes('data.assignedCity'), 'must read assignedCity');
  assert.ok(pluralContent.includes('data.employeeCode'), 'must read employeeCode');
});

// --- Singular detail route ---
test('singular employee detail route uses documented GET via teamsApi.getEmployeeById', () => {
  assert.ok(singularContent.includes('teamsApi.getEmployeeById'), 'must call teamsApi.getEmployeeById');
  assert.ok(singularContent.includes('GET /api/common/employees/{employeeId}'), 'must reference documented endpoint');
  const stripped = singularContent.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.equal(stripped.includes('/employee/getById'), false, 'must not use legacy /employee/getById');
  assert.equal(stripped.includes('API.getEmployeeById'), false, 'must not use legacy API.getEmployeeById');
  // Also singular page keeps documented sub-resources (visits, attendance, etc.)
  assert.ok(singularContent.includes('visitsApi.getCommonVisits'), 'must keep visitsApi');
  assert.ok(singularContent.includes('attendanceApi.getByEmployee'), 'must keep attendanceApi');
  assert.ok(singularContent.includes('expensesApi.getByEmployee'), 'must keep expensesApi');
  assert.ok(singularContent.includes('/api/hr/salary/date-range-breakdown'), 'must keep salary breakdown');
  assert.ok(singularContent.includes('/api/hr/targets?employeeId'), 'must keep targets');
  assert.ok(singularContent.includes('/api/hr/tracking/current-location'), 'must keep tracking');
});

// --- Managed teams component ---
test('employee-managed-teams no longer uses legacy /employee/team/getbyEmployee', () => {
  const stripped = managedTeamsContent.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.equal(stripped.includes('API.getTeamByEmployee'), false, 'must not use API.getTeamByEmployee');
  assert.equal(stripped.includes('/employee/team/getbyEmployee'), false, 'must not use legacy endpoint');
  assert.equal(stripped.includes("from '@/lib/api'"), false, 'must not import from lib/api');
  assert.ok(managedTeamsContent.includes('teamsApi.getTeamsPage'), 'must use documented GET /api/common/teams');
  assert.ok(managedTeamsContent.includes('officeManagerId'), 'must filter by officeManagerId');
  assert.ok(managedTeamsContent.includes('getTeamEmployeesPage'), 'must use GET /api/common/teams/{id}/employees');
  assert.ok(managedTeamsContent.includes('/api/common/teams'), 'must reference documented teams endpoint');
});

// --- Detail component (plural) ---
test('employee-detail-page component does not use legacy or mock production endpoints', () => {
  const stripped = detailCompContent.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  // No legacy fetches
  assert.equal(stripped.includes('/employee/dashboard-summary'), false);
  assert.equal(stripped.includes('/visit/getByDateRange'), false);
  assert.equal(stripped.includes('/expense/getByEmployeeAndDate'), false);
  assert.equal(stripped.includes('/brand/getByDateRangeForEmployee'), false);
  // No mock data as production
  assert.equal(stripped.includes('mockVisits'), false, 'must not render mockVisits as production');
  assert.equal(stripped.includes('mockAttendance'), false);
  assert.equal(stripped.includes('mockExpenses'), false);
  assert.equal(stripped.includes('mockPricing'), false);
  // No invented pricing endpoint
  assert.equal(stripped.includes('/brand/create'), false);
  // Pricing tab is disabled with gap notice
  assert.ok(detailCompContent.includes('Backend contract required') || detailCompContent.includes('no replacement pricing contract'), 'pricing must show backend gap');
  // Preserves empty states for documented APIs
  assert.ok(detailCompContent.includes('GET /api/common/visits'), 'must reference documented visits endpoint in empty state');
  assert.ok(detailCompContent.includes('/api/hr/attendance/logs/by-employee'), 'must reference attendance endpoint');
  assert.ok(detailCompContent.includes('/api/hr/expenses/by-employee'), 'must reference expenses endpoint');
});

// --- No hardcoded URL/credentials in detail route files ---
test('detail routes do not hardcode URL or credentials', () => {
  for (const [name, content] of [['plural', pluralContent], ['singular', singularContent], ['teamsApi', teamsApiContent]]) {
    const stripped = content.replace(/\/\/.*$/gm, '');
    // No hardcoded password in detail pages
    assert.equal(stripped.includes('password:') && name !== 'teamsApi', false, `${name} must not hardcode password`);
    // Plural page must not hardcode http://
    if (name === 'plural') {
      assert.equal(content.includes('http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/employee'), false);
    }
  }
});
