import test from 'node:test';
import assert from 'node:assert/strict';
import { teamHasManager, getTeamManagers, getTeamAssignedCities, getUniqueFieldOfficersFromTeams } from '../lib/team-access.ts';
import { getEmployeeRoleCategory, isAdminEmployee } from '../lib/employee-role.ts';

test('managed teams recognize each manager and both legacy aliases', () => {
  const teams = [
    { id: 1, officeManagers: [{ id: 10 }, { id: 20 }] },
    { id: 2, officeManager: { id: 20 } },
    { id: 3, office: { id: 20 } },
    { id: 4, office: { id: 30 }, fieldOfficers: [{ id: 20 }] },
  ];
  assert.deepEqual(teams.filter(team => teamHasManager(team, 20)).map(team => team.id), [1, 2, 3]);
  assert.equal(teamHasManager(teams[0], 10), true);
});

test('manager aliases enable the section, field officers and admins do not', () => {
  for (const role of ['Manager', 'Office Manager', 'Regional Manager', 'ROLE_OFFICE_MANAGER']) {
    assert.equal(getEmployeeRoleCategory(role), 'regional-manager');
  }
  for (const role of ['Field Officer', 'Admin', null]) {
    assert.notEqual(getEmployeeRoleCategory(role), 'regional-manager');
  }
});

test('deduplicate managers, assigned cities, and field officers; exclude admin members', () => {
  const manager = { id: 10, assignedCity: [' Pune ', 'BANGALORE', ''] };
  const team = {
    id: 1,
    office: manager,
    officeManagers: [manager, { id: 20, assignedCity: ['pune', 'Surat'] }],
    fieldOfficers: [{ id: 30, role: 'Field Officer' }, { id: 30, role: 'Field Officer' }, { id: 40, role: 'Admin' }],
  };
  assert.equal(getTeamManagers(team).length, 2);
  assert.deepEqual(getTeamAssignedCities(team), ['Pune', 'BANGALORE', 'Surat']);
  assert.deepEqual(getUniqueFieldOfficersFromTeams([team]).filter(person => !isAdminEmployee(person)).map(person => person.id), [30]);
});

test('teams without members or city assignments produce empty lists', () => {
  const team = { id: 1, officeManager: { id: 20 } };
  assert.deepEqual(getUniqueFieldOfficersFromTeams([team]), []);
  assert.deepEqual(getTeamAssignedCities(team), []);
});
