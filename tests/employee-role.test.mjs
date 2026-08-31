import test from 'node:test';
import assert from 'node:assert/strict';
import { isAdminEmployee, getEmployeeRoleFormValue } from '../lib/employee-role.ts';

test('edit form prefills every supported manager role with the Regional Manager option', () => {
  for (const role of ['Office Manager', 'Regional Manager', 'Manager', ' office manager ', 'REGIONAL_MANAGER', 'ROLE_OFFICE_MANAGER', 'regional-manager']) {
    assert.equal(getEmployeeRoleFormValue(role), 'Manager');
  }
});

test('edit form normalizes field officer roles without assigning missing or unsupported roles', () => {
  for (const role of ['Field Officer', 'field officer', ' FIELD_OFFICER ', 'ROLE_FIELD_OFFICER', 'field-officer']) {
    assert.equal(getEmployeeRoleFormValue(role), 'Field Officer');
  }
  assert.equal(getEmployeeRoleFormValue(null), '');
  assert.equal(getEmployeeRoleFormValue(undefined), '');
  assert.equal(getEmployeeRoleFormValue('Admin'), 'Admin');
  assert.equal(getEmployeeRoleFormValue('Other'), 'Other');
});

test('employee lists exclude admins from employee or linked account roles', () => {
  for (const employee of [
    { role: 'Admin' }, { role: ' ROLE_ADMIN ' },
    { role: 'Field Officer', userDto: { roles: 'ROLE_ADMIN' } },
    { role: null, userDto: { roles: 'ROLE_USER,ROLE_ADMIN' } },
    { userDto: { roles: ['ROLE_USER', 'ADMIN'] } },
  ]) assert.equal(isAdminEmployee(employee), true);
});

test('employee lists retain non-admin staff and do not infer roles from names', () => {
  for (const employee of [
    { role: 'Field Officer' }, { role: 'Office Manager' }, { role: 'Regional Manager' },
    { role: 'Field Officer', firstName: 'Admin', userDto: { roles: 'ROLE_USER' } },
    { role: null, userDto: null },
  ]) assert.equal(isAdminEmployee(employee), false);
});
