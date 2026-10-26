import { getApiErrorMessage } from './api-error.ts';

const API_BASE_URL = 'http://ec2-18-211-58-135.compute-1.amazonaws.com:8081';
const LOGIN_ENDPOINT = `${API_BASE_URL}/api/auth/login`;
const CURRENT_USER_ENDPOINT = `${API_BASE_URL}/api/auth/me`;

export const FIELD_OFFICER_WEB_ACCESS_MESSAGE =
  'Field Officer accounts are mobile-only. Please sign in on the German Steels mobile app to continue.';

export const normalizeRoleValue = (value: string | null | undefined): string | null => {
  if (!value) return null;
  return value.trim().replace(/\s+/g, ' ').toUpperCase();
};

const simpleRole = (value: string | null | undefined): string => (
  normalizeRoleValue(value)?.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').replace(/^(?:EMPLOYEE )?ROLE /, '').trim() ?? ''
);

export const isManagerRoleValue = (value: string | null | undefined): boolean => [
  'MANAGER',
  'REGIONAL MANAGER',
  'OFFICE MANAGER',
  'ZONAL SUPERVISOR',
].includes(simpleRole(value));

// EMPLOYEE / ROLE_EMPLOYEE identifies the account type, not the employee's
// job. Only an explicit field role should trigger the mobile-only restriction.
export const isFieldOfficerRoleValue = (value: string | null | undefined): boolean => [
  'FIELD OFFICER',
  'RETAIL FE',
  'EMPANELMENT FE',
  'PROJECT FE',
  'RETAIL EMPANELMENT FE',
  'RETAIL PROJECT FE',
  'INSTITUTION PROJECT FE',
  'DUAL FE',
].includes(simpleRole(value));

export const isAdminSetupRoleValue = (value: string | null | undefined): boolean => [
  'ADMIN',
  'HO ADMIN',
  'OWNER',
  'DEVELOPER',
].includes(simpleRole(value));

export interface LoginCredentials { username: string; password: string }
export interface LoginResponse { token: string; role: string }
export interface UserRoleResponse {
  username: string;
  password: string | null;
  roles: string;
  employeeId: number;
  firstName: string;
  lastName: string;
}
export interface CurrentUserDto {
  password: string;
  username: string;
  authorities: Array<{ authority: string }>;
  accountNonExpired: boolean;
  accountNonLocked: boolean;
  credentialsNonExpired: boolean;
  enabled: boolean;
}
export interface AuthError { message: string; status?: number }

export const hasFieldOfficerPrivileges = (
  userRole: string | null,
  currentUser?: CurrentUserDto | null,
  correctedFlags?: { isManager: boolean; isFieldOfficer: boolean } | null,
): boolean => {
  if (correctedFlags?.isFieldOfficer || isFieldOfficerRoleValue(userRole)) return true;
  return (currentUser?.authorities ?? []).some((authority) => isFieldOfficerRoleValue(authority.authority));
};

export const hasManagerPrivileges = (userRole: string | null, currentUser?: CurrentUserDto | null): boolean => (
  isManagerRoleValue(userRole) || (currentUser?.authorities ?? []).some((authority) => isManagerRoleValue(authority.authority))
);

export const hasAdminSetupPrivileges = (userRole: string | null, currentUser?: CurrentUserDto | null): boolean => (
  isAdminSetupRoleValue(userRole) || (currentUser?.authorities ?? []).some((authority) => isAdminSetupRoleValue(authority.authority))
);

export const getCorrectedRoleFlags = (
  userRole: string | null,
  currentUser: CurrentUserDto | null | undefined,
  correctedFlags: { isManager: boolean; isFieldOfficer: boolean } | null,
  _teamId: number | null,
): { isManager: boolean; isFieldOfficer: boolean; isAdmin: boolean } => {
  void _teamId;
  return {
    isManager: correctedFlags?.isManager ?? hasManagerPrivileges(userRole, currentUser),
    isFieldOfficer: correctedFlags?.isFieldOfficer ?? hasFieldOfficerPrivileges(userRole, currentUser),
    isAdmin: hasAdminSetupPrivileges(userRole, currentUser),
  };
};

export const tokenManager = {
  getToken: (): string | null => typeof window === 'undefined' ? null : localStorage.getItem('authToken'),
  setToken: (token: string): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('authToken', token);
    const secure = window.location.hostname === 'localhost' ? '' : '; secure';
    document.cookie = `authToken=${token}; path=/; max-age=86400; samesite=strict${secure}`;
  },
  removeToken: (): void => {
    if (typeof window === 'undefined') return;
    ['authToken', 'userRole', 'userData', 'currentUser', 'teamId', 'correctedRoleFlags'].forEach((key) => localStorage.removeItem(key));
    document.cookie = 'authToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  },
  getAuthHeader: (): string | null => {
    const token = tokenManager.getToken();
    return token ? `Bearer ${token}` : null;
  },
  setUserRole: (value: UserRoleResponse): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('userRole', value.roles);
    localStorage.setItem('userData', JSON.stringify(value));
  },
  getUserRole: (): string | null => typeof window === 'undefined' ? null : localStorage.getItem('userRole'),
  getUserData: (): UserRoleResponse | null => {
    if (typeof window === 'undefined') return null;
    const value = localStorage.getItem('userData');
    try { return value ? JSON.parse(value) as UserRoleResponse : null } catch { return null }
  },
  setCurrentUser: (value: CurrentUserDto): void => { if (typeof window !== 'undefined') localStorage.setItem('currentUser', JSON.stringify(value)) },
  getCurrentUser: (): CurrentUserDto | null => {
    if (typeof window === 'undefined') return null;
    const value = localStorage.getItem('currentUser');
    try { return value ? JSON.parse(value) as CurrentUserDto : null } catch { return null }
  },
  setTeamId: (value: number | null): void => {
    if (typeof window === 'undefined') return;
    if (value == null) localStorage.removeItem('teamId'); else localStorage.setItem('teamId', String(value));
  },
  getTeamId: (): number | null => {
    if (typeof window === 'undefined') return null;
    const value = Number(localStorage.getItem('teamId'));
    return Number.isFinite(value) && value > 0 ? value : null;
  },
  setCorrectedRoleFlags: (value: { isManager: boolean; isFieldOfficer: boolean } | null): void => {
    if (typeof window === 'undefined') return;
    if (value == null) localStorage.removeItem('correctedRoleFlags'); else localStorage.setItem('correctedRoleFlags', JSON.stringify(value));
  },
  getCorrectedRoleFlags: (): { isManager: boolean; isFieldOfficer: boolean } | null => {
    if (typeof window === 'undefined') return null;
    const value = localStorage.getItem('correctedRoleFlags');
    try { return value ? JSON.parse(value) as { isManager: boolean; isFieldOfficer: boolean } : null } catch { return null }
  },
};

const objectOf = (value: unknown): Record<string, unknown> | null => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const stringOf = (...values: unknown[]): string => {
  for (const value of values) if (typeof value === 'string' && value.trim()) return value.trim();
  return '';
};
const numberOf = (...values: unknown[]): number | null => {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
};

const parseTokenResponse = (raw: string): LoginResponse => {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error('Empty response received from login endpoint');
  try {
    const outer = objectOf(JSON.parse(trimmed));
    const data = objectOf(outer?.data);
    const source = data ?? outer;
    const token = stringOf(source?.token, source?.accessToken, source?.jwt);
    if (token) return { token: token.replace(/^Bearer\s+/i, ''), role: stringOf(source?.role, source?.userRole, outer?.role) || 'USER' };
  } catch {
    // Plain-text login responses are supported below.
  }
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1 && parts[0].includes('.')) return { token: parts[0].replace(/^"(.*)"$/, '$1'), role: 'USER' };
  const token = parts.at(-1)?.replace(/^"(.*)"$/, '$1') ?? '';
  const roleParts = parts.slice(0, -1);
  if (roleParts.at(-1)?.toLowerCase() === 'bearer') roleParts.pop();
  if (!token.includes('.')) throw new Error('The login server returned an unexpected response.');
  return { token, role: roleParts.join(' ') || 'USER' };
};

const roleListFrom = (profile: Record<string, unknown>, fallbackRole: string): string[] => {
  const roles: string[] = [];
  const collect = (value: unknown) => {
    if (typeof value === 'string') roles.push(...value.split(',').map((role) => role.trim()).filter(Boolean));
    if (Array.isArray(value)) value.forEach((item) => {
      if (typeof item === 'string') roles.push(item);
      else { const authority = stringOf(objectOf(item)?.authority, objectOf(item)?.role, objectOf(item)?.name); if (authority) roles.push(authority) }
    });
  };
  collect(profile.roles); collect(profile.role); collect(profile.userRole); collect(profile.employeeRole); collect(profile.authorities);
  if (roles.length === 0 && fallbackRole) roles.push(fallbackRole);
  return [...new Set(roles)];
};

const normalizeProfile = (raw: unknown, username: string, fallbackRole: string) => {
  const outer = objectOf(raw) ?? {};
  const profile = objectOf(outer.data) ?? outer;
  const employee = objectOf(profile.employee) ?? {};
  const employeeDesignation = objectOf(employee.designation) ?? {};
  const roles = [
    ...roleListFrom(profile, fallbackRole),
    ...roleListFrom(
      {
        roles: [
          employee.role,
          employee.employeeRole,
          employee.roleName,
          employee.designationName,
          employeeDesignation.name,
          objectOf(employee.userDto)?.roles,
          objectOf(employee.userDto)?.role,
          objectOf(employee.user)?.roles,
          objectOf(employee.user)?.role,
        ].filter(Boolean),
      },
      '',
    ),
  ];
  const dedupedRoles = [...new Set(roles.filter(Boolean))];
  const rolesForUse = dedupedRoles.length > 0 ? dedupedRoles : [fallbackRole].filter(Boolean);
  const rolesFinal = rolesForUse.length > 0 ? rolesForUse : ['USER'];
  // Prefer a job role over generic account roles or permission scopes so the
  // stored session and dashboard use the same role as the login access check.
  const primaryRole = rolesFinal.find((role) => (
    isManagerRoleValue(role) || isAdminSetupRoleValue(role) || isFieldOfficerRoleValue(role)
  )) ?? rolesFinal[0] ?? 'USER';
  const employeeId = numberOf(profile.employeeId, employee.id) ?? 0;
  const firstName = stringOf(profile.firstName, employee.firstName);
  const lastName = stringOf(profile.lastName, employee.lastName);
  const userRoleData: UserRoleResponse = {
    username: stringOf(profile.username, profile.userName) || username,
    password: null,
    roles: primaryRole,
    employeeId,
    firstName,
    lastName,
  };
  const currentUser: CurrentUserDto = {
    password: '',
    username: userRoleData.username,
    authorities: rolesFinal.map((authority) => ({ authority })),
    accountNonExpired: profile.accountNonExpired !== false,
    accountNonLocked: profile.accountNonLocked !== false,
    credentialsNonExpired: profile.credentialsNonExpired !== false,
    enabled: profile.enabled !== false && profile.active !== false,
  };
  const teamId = numberOf(profile.teamId, employee.teamId);
  return { userRoleData, currentUser, teamId, primaryRole };
};

export const LOGIN_NETWORK_ERROR_MESSAGE =
  'Unable to reach the server. Please check your internet connection and try again.';
export const LOGIN_SERVER_ERROR_MESSAGE =
  'The server is temporarily unavailable. Please try again in a few minutes.';
export const LOGIN_PROFILE_ERROR_MESSAGE =
  'We could not load your account details. Please try signing in again.';

// fetch() rejects with a TypeError ("Failed to fetch", "Load failed",
// "NetworkError when attempting to fetch resource") when the request never
// reaches the server, e.g. offline, CORS, or blocked mixed content.
const fetchOrNetworkError = async (input: string, init: RequestInit): Promise<Response> => {
  try {
    return await fetch(input, init);
  } catch {
    throw new Error(LOGIN_NETWORK_ERROR_MESSAGE);
  }
};

export const authService = {
  login: async (credentials: LoginCredentials): Promise<LoginResponse> => {
    const response = await fetchOrNetworkError(LOGIN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    if (!response.ok) {
      if ([401, 403].includes(response.status)) throw new Error('Invalid credentials');
      if (response.status >= 500) throw new Error(LOGIN_SERVER_ERROR_MESSAGE);
      throw new Error(await getApiErrorMessage(response, 'Login failed. Please try again.'));
    }

    const login = parseTokenResponse(await response.text());
    tokenManager.removeToken();
    tokenManager.setToken(login.token);

    try {
      const profileResponse = await fetchOrNetworkError(CURRENT_USER_ENDPOINT, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${login.token}` },
      });
      if (!profileResponse.ok) throw new Error(`Profile request failed (${profileResponse.status})`);
      const profile = normalizeProfile(await profileResponse.json(), credentials.username, login.role);
      if (hasFieldOfficerPrivileges(profile.primaryRole, profile.currentUser)) {
        tokenManager.removeToken();
        throw new Error(FIELD_OFFICER_WEB_ACCESS_MESSAGE);
      }
      tokenManager.setUserRole(profile.userRoleData);
      tokenManager.setCurrentUser(profile.currentUser);
      tokenManager.setTeamId(profile.teamId);
      tokenManager.setCorrectedRoleFlags({
        isManager: hasManagerPrivileges(profile.primaryRole, profile.currentUser),
        isFieldOfficer: false,
      });
      return { token: login.token, role: profile.primaryRole };
    } catch (error) {
      tokenManager.removeToken();
      console.error('Profile request failed after login:', error);
      if (error instanceof Error && [FIELD_OFFICER_WEB_ACCESS_MESSAGE, LOGIN_NETWORK_ERROR_MESSAGE].includes(error.message)) throw error;
      throw new Error(LOGIN_PROFILE_ERROR_MESSAGE);
    }
  },
  logout: async (): Promise<void> => { tokenManager.removeToken() },
  isAuthenticated: (): boolean => Boolean(tokenManager.getToken()),
  getStoredToken: (): string | null => tokenManager.getToken(),
  getUserRole: (): string | null => tokenManager.getUserRole(),
  getUserData: (): UserRoleResponse | null => tokenManager.getUserData(),
  getCurrentUser: (): CurrentUserDto | null => tokenManager.getCurrentUser(),
  getTeamId: (): number | null => tokenManager.getTeamId(),
  getCorrectedRoleFlags: (): { isManager: boolean; isFieldOfficer: boolean } | null => tokenManager.getCorrectedRoleFlags(),
};
