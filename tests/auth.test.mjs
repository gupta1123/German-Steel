import test from 'node:test';
import assert from 'node:assert/strict';
import {
  authService,
  tokenManager,
  FIELD_OFFICER_WEB_ACCESS_MESSAGE,
  LOGIN_PROFILE_ERROR_MESSAGE,
  getCorrectedRoleFlags,
  hasFieldOfficerPrivileges,
  hasManagerPrivileges,
  hasAdminSetupPrivileges,
  isFieldOfficerRoleValue,
} from '../lib/auth.ts';

const fieldRoles = [
  'FIELD_OFFICER', 'RETAIL_FE', 'EMPANELMENT_FE', 'PROJECT_FE',
  'RETAIL_EMPANELMENT_FE', 'RETAIL_PROJECT_FE', 'INSTITUTION_PROJECT_FE', 'DUAL_FE',
];

function mockBrowser(t) {
  const values = new Map();
  const browserGlobals = {
    window: { location: { hostname: 'localhost' } },
    document: { cookie: '' },
    localStorage: {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: key => values.delete(key),
    },
  };
  for (const [key, value] of Object.entries(browserGlobals)) {
    const original = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value, configurable: true });
    t.after(() => {
      if (original) Object.defineProperty(globalThis, key, original);
      else delete globalThis[key];
    });
  }
  t.mock.method(console, 'error', () => {});
  return values;
}

function mockLogin(t, profile, profileStatus = 200) {
  return t.mock.method(globalThis, 'fetch', async (url, init) => {
    const pathname = new URL(url).pathname;
    if (pathname === '/api/auth/login') {
      assert.equal(init.method, 'POST');
      assert.equal(init.headers.Authorization, undefined, 'login must not send a stored token');
      assert.deepEqual(JSON.parse(init.body), { username: 'test_user', password: 'test-password' });
      return Response.json({ token: 'test.login.token', role: 'EMPLOYEE' });
    }
    assert.equal(pathname, '/api/auth/me');
    assert.equal(init.method, 'GET');
    assert.equal(init.headers.Authorization, 'Bearer test.login.token');
    return Response.json(profile, { status: profileStatus });
  });
}

const credentials = { username: 'test_user', password: 'test-password' };

test('the manager profile from the screenshot can log in and retains manager permissions after reload', async t => {
  mockBrowser(t);
  tokenManager.setToken('old.session.token');
  const fetchMock = mockLogin(t, {
    id: 42,
    employeeId: 59,
    username: 'test_user',
    role: 'EMPLOYEE',
    active: true,
    authorities: [
      'ROLE_EMPLOYEE', 'EMPLOYEE_ROLE_MANAGER',
      'SCOPE_DIRECT_REPORTS_ZONE_ROLLUP', 'SCOPE_OUTSIDE_ZONE_SUMMARY_ONLY',
    ],
  });

  const result = await authService.login(credentials);
  assert.equal(result.role, 'EMPLOYEE_ROLE_MANAGER');
  assert.equal(fetchMock.mock.callCount(), 2);
  assert.equal(authService.getStoredToken(), 'test.login.token');
  assert.equal(authService.getUserData().employeeId, 59, 'use the employee ID, not the user ID');
  const role = authService.getUserRole();
  const user = authService.getCurrentUser();
  const flags = authService.getCorrectedRoleFlags();
  assert.equal(hasManagerPrivileges(role, user), true);
  assert.equal(hasFieldOfficerPrivileges(role, user, flags), false);
  assert.deepEqual(getCorrectedRoleFlags(role, user, flags, null), {
    isManager: true, isFieldOfficer: false, isAdmin: false,
  });
});

test('manager, supervisor and admin job authorities are recognized alongside generic account roles', () => {
  for (const role of ['MANAGER', 'REGIONAL_MANAGER', 'OFFICE_MANAGER', 'ZONAL_SUPERVISOR']) {
    for (const prefix of ['', 'ROLE_', 'EMPLOYEE_ROLE_']) {
      const user = { authorities: [{ authority: 'ROLE_EMPLOYEE' }, { authority: prefix + role }] };
      assert.equal(hasManagerPrivileges('EMPLOYEE', user), true, prefix + role);
      assert.equal(hasFieldOfficerPrivileges('EMPLOYEE', user), false, prefix + role);
    }
  }
  for (const role of ['ADMIN', 'HO_ADMIN', 'OWNER', 'DEVELOPER']) {
    const user = { authorities: [{ authority: 'ROLE_EMPLOYEE' }, { authority: `EMPLOYEE_ROLE_${role}` }] };
    assert.equal(hasAdminSetupPrivileges('EMPLOYEE', user), true, role);
    assert.equal(hasFieldOfficerPrivileges('EMPLOYEE', user), false, role);
  }
});

test('generic employee accounts and non-field roles are not classified as field officers', () => {
  for (const role of ['EMPLOYEE', 'ROLE_EMPLOYEE', 'HR', 'ACCOUNTS', 'USER', '', null]) {
    assert.equal(isFieldOfficerRoleValue(role), false, String(role));
  }
});

test('every supported field role and authority prefix remains mobile-only', () => {
  for (const role of fieldRoles) {
    for (const prefix of ['', 'ROLE_', 'EMPLOYEE_ROLE_']) {
      const value = prefix + role;
      assert.equal(isFieldOfficerRoleValue(value), true, value);
      assert.equal(hasFieldOfficerPrivileges('EMPLOYEE', { authorities: [{ authority: value }] }), true, value);
    }
  }
  assert.equal(isFieldOfficerRoleValue(' role-field officer '), true);
});

test('non-field employee roles can complete login with string or object authorities', async t => {
  mockBrowser(t);
  const profiles = [
    { role: 'EMPLOYEE', authorities: ['ROLE_EMPLOYEE', 'EMPLOYEE_ROLE_ZONAL_SUPERVISOR'] },
    { role: 'EMPLOYEE', authorities: [{ authority: 'ROLE_EMPLOYEE' }, { authority: 'EMPLOYEE_ROLE_HO_ADMIN' }] },
    { role: 'EMPLOYEE', employeeRole: 'MANAGER' },
    { role: 'EMPLOYEE', employee: { id: 59, role: 'Regional Manager' } },
    { role: 'EMPLOYEE', authorities: ['ROLE_EMPLOYEE', 'EMPLOYEE_ROLE_HR'] },
    { role: 'EMPLOYEE', authorities: ['ROLE_EMPLOYEE'] },
    { role: 'Admin' },
  ];
  for (const profile of profiles) {
    const fetchMock = mockLogin(t, profile);
    await authService.login(credentials);
    assert.equal(authService.isAuthenticated(), true);
    assert.equal(hasFieldOfficerPrivileges(authService.getUserRole(), authService.getCurrentUser()), false);
    fetchMock.mock.restore();
  }
});

test('field-officer login rejects every field role and clears both the token and previous session', async t => {
  const values = mockBrowser(t);
  for (const role of fieldRoles) {
    tokenManager.setToken('old.session.token');
    tokenManager.setUserRole({ roles: 'MANAGER' });
    tokenManager.setCorrectedRoleFlags({ isManager: true, isFieldOfficer: false });
    const fetchMock = mockLogin(t, {
      role: 'EMPLOYEE', authorities: ['ROLE_EMPLOYEE', `EMPLOYEE_ROLE_${role}`],
    });
    await assert.rejects(authService.login(credentials), { message: FIELD_OFFICER_WEB_ACCESS_MESSAGE });
    assert.equal(authService.isAuthenticated(), false);
    assert.equal(values.size, 0, 'a blocked login must not leave any session data behind');
    assert.match(document.cookie, /expires=Thu, 01 Jan 1970/);
    fetchMock.mock.restore();
  }
});

test('legacy field-officer profiles and nested employee job roles remain blocked', async t => {
  mockBrowser(t);
  for (const profile of [
    { role: 'Field Officer' },
    { role: 'EMPLOYEE', employeeRole: 'PROJECT_FE' },
    { role: 'EMPLOYEE', authorities: [{ authority: 'EMPLOYEE_ROLE_RETAIL_FE' }] },
    { role: 'EMPLOYEE', employee: { role: 'Field Officer' } },
  ]) {
    const fetchMock = mockLogin(t, profile);
    await assert.rejects(authService.login(credentials), { message: FIELD_OFFICER_WEB_ACCESS_MESSAGE });
    fetchMock.mock.restore();
  }
});

test('failed profile requests still reject login and remove the new token', async t => {
  const values = mockBrowser(t);
  mockLogin(t, { message: 'Unauthorized' }, 401);
  await assert.rejects(authService.login(credentials), { message: LOGIN_PROFILE_ERROR_MESSAGE });
  assert.equal(values.size, 0);
});
