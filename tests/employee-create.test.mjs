import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const wizardPath = path.join(process.cwd(), 'components/employee-form-wizard.tsx');
const addPagePath = path.join(process.cwd(), 'app/dashboard/employees/add/page.tsx');
const wizardContent = fs.readFileSync(wizardPath, 'utf8');
let addPageContent = '';
try {
  addPageContent = fs.readFileSync(addPagePath, 'utf8');
} catch {}
const combined = wizardContent + '\n' + addPageContent;

// ============================================================
// 1. Documented contract compliance
// ============================================================

test('Employee Create uses documented POST /api/auth/employees-with-credentials', () => {
  assert.ok(
    wizardContent.includes('/api/auth/employees-with-credentials'),
    'Create must POST to /api/auth/employees-with-credentials'
  );
});

test('Employee Create payload maps mobile (not primaryContact)', () => {
  assert.ok(
    wizardContent.includes('mobile:') || wizardContent.includes('mobile :'),
    'Payload must use `mobile` field (not primaryContact)'
  );
  assert.ok(
    wizardContent.includes('secondaryMobile') || wizardContent.includes('secondaryMobile :'),
    'Payload must use `secondaryMobile` field (not secondaryContact)'
  );
});

test('Employee Create payload maps department (not departmentName)', () => {
  assert.ok(
    wizardContent.includes('department:') || wizardContent.includes('department :'),
    'Payload must use `department` field (not departmentName)'
  );
});

test('Employee Create payload includes documented role values', () => {
  assert.ok(
    wizardContent.includes('RETAIL_FE'),
    'Role mapping must include RETAIL_FE'
  );
  assert.ok(
    wizardContent.includes('MANAGER'),
    'Role mapping must include MANAGER'
  );
});

test('Employee Create payload includes documented fields', () => {
  const requiredFields = [
    'firstName',
    'lastName',
    'email',
    'role',
    'username',
    'password',
    'userRole',
    'dateOfJoining',
  ];
  for (const field of requiredFields) {
    assert.ok(
      wizardContent.includes(field),
      `Payload must include ${field}`
    );
  }
});

test('Employee Create navigates to detail page after success', () => {
  assert.ok(
    wizardContent.includes('/dashboard/employees/${createdId}'),
    'After creation, must navigate to /dashboard/employees/${createdId} (detail page)'
  );
});

// ============================================================
// 2. Form state and UI field alignment
// ============================================================

test('NewEmployeeState uses mobile/secondaryMobile/department', () => {
  assert.ok(
    wizardContent.includes('mobile: string'),
    'State must have mobile field'
  );
  assert.ok(
    wizardContent.includes('secondaryMobile: string'),
    'State must have secondaryMobile field'
  );
  assert.ok(
    wizardContent.includes('department: string'),
    'State must have department field'
  );
  assert.ok(
    !wizardContent.includes('primaryContact: string'),
    'State must NOT have primaryContact field'
  );
  assert.ok(
    !wizardContent.includes('secondaryContact: string'),
    'State must NOT have secondaryContact field'
  );
  assert.ok(
    !wizardContent.includes('departmentName: string'),
    'State must NOT have departmentName field'
  );
});

test('Form input names match state field names', () => {
  assert.ok(
    wizardContent.includes('name="mobile"'),
    'Input must use name="mobile"'
  );
  assert.ok(
    wizardContent.includes('name="secondaryMobile"'),
    'Input must use name="secondaryMobile"'
  );
  assert.ok(
    wizardContent.includes('name="department"') || wizardContent.includes('department: val'),
    'Department select must use department field'
  );
  assert.ok(
    !wizardContent.includes('name="primaryContact"'),
    'No input should use name="primaryContact"'
  );
  assert.ok(
    !wizardContent.includes('name="secondaryContact"'),
    'No input should use name="secondaryContact"'
  );
});

// ============================================================
// 3. Validation
// ============================================================

test('Mobile validation enforces 10 digits', () => {
  assert.ok(
    wizardContent.includes("fieldName === 'mobile'"),
    'handleInputChange must validate mobile field'
  );
  assert.ok(
    wizardContent.includes("fieldName === 'secondaryMobile'"),
    'handleInputChange must validate secondaryMobile field'
  );
  assert.ok(
    wizardContent.includes('Must be 10 digits'),
    'Must show 10-digit validation message'
  );
});

test('formIsValid requires mobile length === 10', () => {
  assert.ok(
    wizardContent.includes('newEmployee.mobile.length === 10'),
    'formIsValid must check mobile length is 10'
  );
  assert.ok(
    wizardContent.includes('!mobileError'),
    'formIsValid must check no mobileError'
  );
});

// ============================================================
// 4. Fresh defaults on each open
// ============================================================

test('Create mode generates fresh password on each mount', () => {
  assert.ok(
    wizardContent.includes('generateTemporaryPassword()'),
    'Must call generateTemporaryPassword() on create mount'
  );
  assert.ok(
    wizardContent.includes('dateOfJoining: format(new Date()'),
    'Must set dateOfJoining to today on create mount'
  );
});

test('Form resets state via resetFormState on create mount', () => {
  assert.ok(
    wizardContent.includes('resetFormState(createDefaults)'),
    'Must call resetFormState with createDefaults on mount'
  );
});

// ============================================================
// 5. No legacy endpoints or patterns
// ============================================================

test('Create mode does not use legacy employee routes', () => {
  const legacyPatterns = [
    '/employee/getAll',
    '/employee/getById',
    '/employee-user/create',
    '/employee/edit',
    '/employee/delete',
    '/employee/setActive',
    'API.getEmployeeById',
    'API.updateEmployee',
  ];
  const withoutComments = wizardContent
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  for (const pattern of legacyPatterns) {
    assert.equal(
      withoutComments.includes(pattern),
      false,
      `Legacy endpoint still present: ${pattern}`
    );
  }
});

test('Create mode does not send employeeId in payload', () => {
  assert.ok(
    !wizardContent.includes('employeeId: newEmployee.employeeId'),
    'Payload must not include employeeId from form state'
  );
});

test('Create mode does not import employeeIdExists', () => {
  assert.ok(
    !wizardContent.includes('employeeIdExists'),
    'Must not import or use employeeIdExists'
  );
});

// ============================================================
// 6. Role mapping
// ============================================================

test('Role mapping converts Field Officer to RETAIL_FE', () => {
  assert.ok(
    wizardContent.includes("roleForApi === 'Field Officer' ? 'RETAIL_FE'") ||
    wizardContent.includes("role === 'Field Officer' ? 'RETAIL_FE'"),
    'Field Officer must map to RETAIL_FE'
  );
});

test('Role mapping converts Manager to MANAGER', () => {
  assert.ok(
    wizardContent.includes("roleForApi === 'MANAGER'") ||
    wizardContent.includes("roleForApi = 'MANAGER'"),
    'Manager must map to MANAGER'
  );
});

test('userRole uses EMPLOYEE or MANAGER (not RETAIL_FE)', () => {
  const userRoleMatch = wizardContent.match(/userRole:\s*roleForApi === 'MANAGER' \? 'MANAGER' : 'EMPLOYEE'/);
  assert.ok(
    userRoleMatch,
    'userRole must be MANAGER or EMPLOYEE (not RETAIL_FE)'
  );
});

// ============================================================
// 7. Error and loading states
// ============================================================

test('Form shows submitting state with loading indicator', () => {
  assert.ok(
    wizardContent.includes('isSubmitting'),
    'Must track isSubmitting state'
  );
  assert.ok(
    wizardContent.includes('Loader2') || wizardContent.includes('animate-spin'),
    'Must show loading spinner during submission'
  );
});

test('Form shows error toast on failure', () => {
  assert.ok(
    wizardContent.includes('toast.error'),
    'Must show toast.error on failure'
  );
});

test('Form shows success toast on creation', () => {
  assert.ok(
    wizardContent.includes('toast.success("Employee created"'),
    'Must show toast.success("Employee created") after success'
  );
});

// ============================================================
// 8. Add page route
// ============================================================

test('Add page renders EmployeeFormWizard in create mode', () => {
  assert.ok(
    addPageContent.includes('EmployeeFormWizard'),
    'Add page must render EmployeeFormWizard'
  );
  assert.ok(
    addPageContent.includes('mode="create"'),
    'Add page must pass mode="create"'
  );
});
