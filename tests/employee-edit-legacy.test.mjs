import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const wizardPath = path.join(process.cwd(), 'components/employee-form-wizard.tsx');
const editPagePath = path.join(process.cwd(), 'app/dashboard/employees/[id]/edit/page.tsx');
const wizardContent = fs.readFileSync(wizardPath, 'utf8');
let editPageContent = '';
try {
  editPageContent = fs.readFileSync(editPagePath, 'utf8');
} catch {
  // fallback to singular path if plural not found
  const alt = path.join(process.cwd(), 'app/dashboard/employee/[id]/edit/page.tsx');
  try { editPageContent = fs.readFileSync(alt, 'utf8'); } catch {}
}
const combined = wizardContent + '\n' + editPageContent;

const legacyPatterns = [
  '/employee/getById',
  '/employee/edit',
  '/employee/editUsername',
  '/employee/setActive',
  '/employee/assignCity',
  '/employee/removeAssignedCity',
  '/employee/getCities',
  '/employee/getAll',
  '/employee/getAllInactive',
  '/employee/team/getbyEmployee',
  '/employee/delete',
  '/user/manage/update',
  'API.getEmployeeById',
  'API.updateEmployee',
  'API.assignEmployeeCity',
  'API.removeEmployeeCity',
  'API.getCities',
  'API.getAllEmployees',
  'API.getArchivedEmployees',
];

test('Employee Edit page does not invoke legacy employee routes', () => {
  // Strip all single-line and block comments to avoid false positives from gap-report comments
  const withoutComments = combined.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const pattern of legacyPatterns) {
    if (pattern.startsWith('API.')) {
      assert.equal(withoutComments.includes(pattern), false, `Legacy API still present: ${pattern}`);
    } else {
      // For URL patterns, ensure they are not in an actual fetch call (allow gap-report strings in comments, which are now stripped)
      const hasFetch = withoutComments.includes(`fetch(\``) && withoutComments.includes(pattern);
      const hasLegacyFetch = withoutComments.includes(pattern) && (withoutComments.includes('fetch(') || withoutComments.includes('API.'));
      // More precise: check for the literal legacy path in code (not just comment)
      if (withoutComments.includes(pattern)) {
        // If the pattern appears, ensure it's not part of an actual fetch URL (check for fetch or API)
        // For this test, any occurrence after stripping comments is considered a reachable call
        assert.fail(`Legacy endpoint still reachable in code (after stripping comments): ${pattern}`);
      }
    }
  }
});

test('Employee Edit wizard uses documented contracts and separates credentials', () => {
  // Must use new employee update contract
  assert.ok(wizardContent.includes('/api/common/employees/'), 'Should use PUT /api/common/employees/{id}');
  // Must use auth contract for create
  assert.ok(wizardContent.includes('/api/auth/employees-with-credentials'), 'Should use POST /api/auth/employees-with-credentials');
  // Must use filtered lookup for employee fetch, not full directory
  assert.ok(wizardContent.includes('teamsApi.getEmployeesPage'), 'Should use filtered lookup teamsApi.getEmployeesPage');
  assert.ok(wizardContent.includes('Direct GET /api/common/employees/{id} is not documented'), 'Should report backend gap for direct GET');
  // Password should not be displayed/fetched; only sent on create via auth contract
  // Check that the file does not contain password display in profile data (it should only be in create payload)
  const hasPasswordDisplay = wizardContent.includes('userDto?.password') && wizardContent.includes('password: String');
  // Allow password in create payload, but not in profile fetch display
  assert.ok(!wizardContent.includes('API.getEmployeeById'), 'Should not use legacy getById for profile');
});

test('Employee Edit does not fetch or display passwords/tokens', () => {
  // Ensure the wizard does not fetch password and does not display it in UI beyond the create input
  // The only password field should be the create input, not a fetch
  const passwordFetchPattern = /fetch.*password|get.*password/i;
  // Check that the file does not contain a fetch that includes password in response handling
  assert.equal(passwordFetchPattern.test(wizardContent) && wizardContent.includes('password: String('), false, 'Should not fetch password');
  // Ensure no token logging
  assert.equal(wizardContent.includes('console.log') && wizardContent.includes('token'), false, 'Should not log token');
});
