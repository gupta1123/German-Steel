import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const targetsApi = fs.readFileSync(path.join(process.cwd(), 'lib/targets-api.ts'), 'utf8');
const targetsPage = fs.readFileSync(path.join(process.cwd(), 'components/OfficerTargets.tsx'), 'utf8');
const targetSheet = fs.readFileSync(path.join(process.cwd(), 'components/EmployeeKpiSheet.tsx'), 'utf8');
const quarterKpis = fs.readFileSync(path.join(process.cwd(), 'lib/use-officer-quarter-kpis.ts'), 'utf8');

test('target directory supports the documented managerId direct-report filter', () => {
  assert.ok(targetsApi.includes('options: { managerId?: number }'));
  assert.ok(targetsApi.includes('query.set("managerId", String(options.managerId))'));
  assert.ok(targetsApi.includes('`/api/common/employees/${employeeId}`'));
});

test('manager view loads the manager and their direct reports', () => {
  assert.ok(targetsPage.includes('targetsApi.getEmployee(token, viewerEmployeeId)'));
  assert.ok(targetsPage.includes('targetsApi.getEmployees(token, { managerId: viewerEmployeeId })'));
  assert.ok(targetsPage.includes('My targets and direct reports'));
  assert.ok(targetsPage.includes('scopedKpiEmployeeIds'));
  assert.ok(quarterKpis.includes('employeeId: employeeId ?? undefined'));
  assert.ok(quarterKpis.includes('target.employeeId !== request.employeeId'));
});

test('admin directory offers supervisor and field-officer role filters', () => {
  assert.ok(targetsPage.includes('<SelectItem value="manager">Supervisors</SelectItem>'));
  assert.ok(targetsPage.includes('<SelectItem value="field_officer">Field officers</SelectItem>'));
  assert.ok(targetsPage.includes('getTargetRecipientType(employee)'));
});

test('employee target writes use the documented full create and edit body', () => {
  for (const field of ['targetType: "EMPLOYEE"', 'metric: params.metric', 'targetValue: params.targetValue', 'employeeId: params.employeeId', 'active: true']) {
    assert.ok(targetsApi.includes(field), `Missing target payload field: ${field}`);
  }
  assert.ok(targetsApi.includes('request("/api/hr/targets", token, { method: "POST", body })'));
  assert.ok(targetsApi.includes('request(`/api/hr/targets/${params.id}`, token, { method: "PUT", body })'));
});

test('a manager can view their own target without editing it', () => {
  assert.ok(targetsPage.includes('readOnly={viewerIsManager && selectedOfficer.id === viewerEmployeeId}'));
  assert.ok(targetSheet.includes("quarterly KPI targets${readOnly ? ' · view only' : ''}"));
  assert.ok(targetSheet.includes('if (!token || readOnly) return'));
});
