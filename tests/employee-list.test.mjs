import test from 'node:test';
import assert from 'node:assert/strict';
import { getEmployeeListPage } from '../lib/employee-list.ts';

const employee = (id, role = 'RETAIL_FE', extra = {}) => ({
  id, firstName: `Employee ${id}`, lastName: 'Test', role, email: `employee${id}@example.test`, ...extra,
});

test('hiding three admins does not turn a ten-row page into seven rows or inflate the total', () => {
  const employees = Array.from({ length: 23 }, (_, i) => employee(i + 1));
  employees[0].role = 'HO_ADMIN';
  employees[4].role = 'ROLE_ADMIN';
  employees[8].userDto = { roles: 'ROLE_ADMIN' };

  const first = getEmployeeListPage(employees, { page: 1, pageSize: 10 });
  const second = getEmployeeListPage(employees, { page: 2, pageSize: 10 });
  assert.equal(first.content.length, 10);
  assert.equal(second.content.length, 10);
  assert.equal(first.totalElements, 20);
  assert.equal(first.totalPages, 2);
  const ids = [...first.content, ...second.content].map(row => row.id);
  assert.equal(new Set(ids).size, 20, 'employees must not repeat across pages');
  assert.deepEqual(ids, employees.filter(row => ![1, 5, 9].includes(row.id)).map(row => row.id));
});

test('all supported page sizes use the same filtered total and only the last page is partial', () => {
  const employees = Array.from({ length: 57 }, (_, i) => employee(i + 1));
  for (const pageSize of [10, 25, 50, 100]) {
    const first = getEmployeeListPage(employees, { pageSize });
    const last = getEmployeeListPage(employees, { pageSize, page: first.totalPages });
    assert.equal(first.totalElements, 57);
    assert.equal(first.content.length, Math.min(pageSize, 57));
    assert.equal(first.totalPages, Math.ceil(57 / pageSize));
    assert.equal(last.content.length, 57 - (last.page - 1) * pageSize);
  }
});

test('role filters include every field-executive and supervisor variant before counting', () => {
  const fields = ['RETAIL_FE', 'EMPANELMENT_FE', 'PROJECT_FE', 'RETAIL_EMPANELMENT_FE', 'RETAIL_PROJECT_FE', 'INSTITUTION_PROJECT_FE', 'DUAL_FE', 'ROLE_FIELD_OFFICER'];
  const supervisors = ['MANAGER', 'REGIONAL_MANAGER', 'OFFICE_MANAGER', 'ZONAL_SUPERVISOR', 'EMPLOYEE_ROLE_MANAGER'];
  const employees = [...fields, ...supervisors, 'ROLE_HO_ADMIN'].map((role, i) => employee(i + 1, role));
  const fieldPage = getEmployeeListPage(employees, { roleFilter: 'field-officer', pageSize: 5 });
  const supervisorPage = getEmployeeListPage(employees, { roleFilter: 'regional-manager' });
  assert.equal(fieldPage.totalElements, fields.length);
  assert.equal(fieldPage.content.length, 5);
  assert.equal(fieldPage.totalPages, 2);
  assert.equal(supervisorPage.totalElements, supervisors.length);
  assert.deepEqual(new Set(supervisorPage.content.map(row => row.role)), new Set(supervisors));
});

test('search counts all matches, including readable role names and missing optional fields', () => {
  const employees = [
    employee(1, 'MANAGER', { firstName: 'Bhargav', lastName: 'Dave', email: '' }),
    employee(2, 'ZONAL_SUPERVISOR', { firstName: 'Ashish', department: 'Sales' }),
    employee(3, 'PROJECT_FE'),
    employee(4, 'HO_ADMIN', { firstName: 'Bhargav', lastName: 'Dave' }),
  ];
  assert.deepEqual(getEmployeeListPage(employees, { query: '  bhargav dave  ' }).content.map(row => row.id), [1]);
  assert.equal(getEmployeeListPage(employees, { query: 'supervisor' }).totalElements, 2);
  assert.equal(getEmployeeListPage(employees, { query: 'SALES' }).totalElements, 1);
  assert.equal(getEmployeeListPage(employees, { query: 'employee3@example.test' }).totalElements, 1);
  assert.equal(getEmployeeListPage(employees, { query: 'not found' }).totalElements, 0);
});

test('sorting applies to the complete directory without changing source data', () => {
  const employees = Array.from({ length: 23 }, (_, i) => employee(23 - i));
  const snapshot = structuredClone(employees);
  assert.deepEqual(getEmployeeListPage(employees, { pageSize: 10 }).content.map(row => row.id), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(getEmployeeListPage(employees, { page: 2, pageSize: 10, sortDirection: 'desc' }).content.map(row => row.id), [13, 12, 11, 10, 9, 8, 7, 6, 5, 4]);
  assert.deepEqual(employees, snapshot);
});

test('a deleted final-page employee or a restored out-of-range page clamps to an existing page', () => {
  const employees = Array.from({ length: 21 }, (_, i) => employee(i + 1));
  assert.equal(getEmployeeListPage(employees, { page: 3, pageSize: 10 }).content.length, 1);
  const afterDeletion = getEmployeeListPage(employees.slice(0, -1), { page: 3, pageSize: 10 });
  assert.equal(afterDeletion.page, 2);
  assert.equal(afterDeletion.totalElements, 20);
  assert.equal(afterDeletion.content.length, 10);
  const filtered = getEmployeeListPage(employees, { page: 99, pageSize: 10, query: 'Employee 21' });
  assert.equal(filtered.page, 1);
  assert.equal(filtered.content.length, 1);
});

test('duplicate API rows are counted once and empty lists remain on page one', () => {
  const first = employee(1);
  const result = getEmployeeListPage([first, first, employee(2)], { pageSize: 1, page: 2 });
  assert.equal(result.totalElements, 2);
  assert.deepEqual(result.content.map(row => row.id), [2]);
  assert.deepEqual(getEmployeeListPage([], { page: 20, pageSize: 10 }), { content: [], totalElements: 0, totalPages: 1, page: 1 });
});
