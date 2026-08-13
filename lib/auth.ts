// Authentication service for WebSalesV3
import { teamHasManager } from './team-access';

const API_BASE_URL = 'http://ec2-18-211-58-135.compute-1.amazonaws.com:8081';
const SECONDARY_API_BASE_URL = 'http://ec2-18-211-58-135.compute-1.amazonaws.com:8081';
const LOGIN_ENDPOINT = `${API_BASE_URL}/user/token`;
const LOGOUT_ENDPOINT = `${API_BASE_URL}/user/logout`;
const USER_ROLE_ENDPOINT = `${API_BASE_URL}/user/manage/get`;
const CURRENT_USER_ENDPOINT = `${SECONDARY_API_BASE_URL}/user/manage/current-user`;

export const normalizeRoleValue = (value: string | null | undefined): string | null => {
  if (!value) return null;
  return value.trim().replace(/\s+/g, ' ').toUpperCase();
};

export const isManagerRoleValue = (value: string | null | undefined): boolean => {
  const normalized = normalizeRoleValue(value);
  return normalized === 'MANAGER' ||
    normalized === 'ROLE MANAGER' ||
    normalized === 'ROLE_MANAGER' ||
    normalized === 'REGIONAL MANAGER' ||
    normalized === 'REGIONAL_MANAGER' ||
    normalized === 'ROLE REGIONAL MANAGER' ||
    normalized === 'ROLE_REGIONAL MANAGER' ||
    normalized === 'ROLE_REGIONAL_MANAGER' ||
    normalized === 'OFFICE MANAGER' ||
    normalized === 'OFFICE_MANAGER' ||
    normalized === 'ROLE OFFICE MANAGER' ||
    normalized === 'ROLE_OFFICE MANAGER' ||
    normalized === 'ROLE_OFFICE_MANAGER';
};

export const hasManagerPrivileges = (userRole: string | null, currentUser?: CurrentUserDto | null): boolean => {
  if (isManagerRoleValue(userRole)) {
    return true;
  }

  const authorities = currentUser?.authorities ?? [];
  return authorities.some((auth) => isManagerRoleValue(auth.authority));
};

export const isAdminSetupRoleValue = (value: string | null | undefined): boolean => {
  const normalized = normalizeRoleValue(value);
  return normalized === 'ADMIN' ||
    normalized === 'ROLE ADMIN' ||
    normalized === 'ROLE_ADMIN' ||
    normalized === 'OWNER' ||
    normalized === 'ROLE OWNER' ||
    normalized === 'ROLE_OWNER' ||
    normalized === 'DEVELOPER' ||
    normalized === 'ROLE DEVELOPER' ||
    normalized === 'ROLE_DEVELOPER';
};

export const hasAdminSetupPrivileges = (userRole: string | null, currentUser?: CurrentUserDto | null): boolean => {
  if (isAdminSetupRoleValue(userRole)) {
    return true;
  }

  const authorities = currentUser?.authorities ?? [];
  return authorities.some((auth) => isAdminSetupRoleValue(auth.authority));
};

/**
 * Get corrected role flags based on teamId fetch.
 * This is the primary method to determine if a user is a manager or field officer.
 * If teamId was successfully fetched, use the corrected flags.
 * Otherwise, fall back to authority-based detection.
 */
export const getCorrectedRoleFlags = (
  userRole: string | null,
  currentUser: CurrentUserDto | null | undefined,
  correctedFlags: { isManager: boolean; isFieldOfficer: boolean } | null,
  teamId: number | null
): { isManager: boolean; isFieldOfficer: boolean; isAdmin: boolean } => {
  // If we have corrected flags from teamId fetch, use them (most reliable)
  if (correctedFlags) {
    const normalizedRole = normalizeRoleValue(userRole);
    const isAdmin = normalizedRole === 'ROLE_ADMIN' || normalizedRole === 'ADMIN';
    return {
      isManager: correctedFlags.isManager,
      isFieldOfficer: correctedFlags.isFieldOfficer,
      isAdmin
    };
  }

  // Fallback to authority-based detection if no teamId was fetched
  const normalizedRole = normalizeRoleValue(userRole);
  const authorities = currentUser?.authorities ?? [];
  const authorityRole = authorities.length > 0 ? normalizeRoleValue(authorities[0].authority) : null;

  const isManager = isManagerRoleValue(userRole) || isManagerRoleValue(authorityRole);
  const isFieldOfficer = normalizedRole === 'ROLE_FIELD OFFICER' || 
                         normalizedRole === 'FIELD OFFICER' ||
                         authorityRole === 'ROLE_FIELD OFFICER' || 
                         authorityRole === 'FIELD OFFICER';
  const isAdmin = normalizedRole === 'ROLE_ADMIN' || 
                  normalizedRole === 'ADMIN' ||
                  authorityRole === 'ROLE_ADMIN' || 
                  authorityRole === 'ADMIN';

  return { isManager, isFieldOfficer, isAdmin };
};

const parseTokenResponse = (raw: string): { token: string; role: string } => {
  const trimmed = raw.trim();

  if (!trimmed) {
    throw new Error('Empty response received from login endpoint');
  }

  // Attempt to handle JSON payloads first
  try {
    const parsed = JSON.parse(trimmed) as { token?: string; role?: string };
    if (typeof parsed.token === 'string') {
      return {
        token: parsed.token.trim(),
        role: parsed.role ?? 'USER',
      };
    }
  } catch {
    // Non-JSON payloads fall through to string parsing
  }

  const parts = trimmed.split(/\s+/);

  if (parts.length < 2) {
    throw new Error(`Unexpected login response: "${trimmed}"`);
  }

  const role = parts[0];
  let tokenCandidate = parts[parts.length - 1];

  // Handle "ROLE_ADMIN Bearer <token>" formats
  if (tokenCandidate.toLowerCase() === 'bearer' && parts.length >= 3) {
    tokenCandidate = parts[parts.length - 1];
  }

  // Strip any surrounding quotes
  tokenCandidate = tokenCandidate.replace(/^"(.*)"$/, '$1');

  if (!tokenCandidate.includes('.')) {
    throw new Error(`Parsed token looks invalid: "${tokenCandidate}"`);
  }

  return {
    token: tokenCandidate,
    role: role || 'USER',
  };
};

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  role: string;
}

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
  authorities: Array<{
    authority: string;
  }>;
  accountNonExpired: boolean;
  accountNonLocked: boolean;
  credentialsNonExpired: boolean;
  enabled: boolean;
}

export interface AuthError {
  message: string;
  status?: number;
}

// Token management
export const tokenManager = {
  getToken: (): string | null => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('authToken');
    }
    return null;
  },

  setToken: (token: string): void => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('authToken', token);
      // Also set cookie for middleware access
      const isDevelopment = window.location.hostname === 'localhost';
      const cookieOptions = isDevelopment 
        ? `authToken=${token}; path=/; max-age=86400; samesite=strict`
        : `authToken=${token}; path=/; max-age=86400; secure; samesite=strict`;
      document.cookie = cookieOptions;
    }
  },

  removeToken: (): void => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('authToken');
      localStorage.removeItem('userRole');
      localStorage.removeItem('userData');
      localStorage.removeItem('currentUser');
      localStorage.removeItem('teamId');
      localStorage.removeItem('correctedRoleFlags');
      // Also remove cookie
      document.cookie = 'authToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    }
  },

  getAuthHeader: (): string | null => {
    const token = tokenManager.getToken();
    return token ? `Bearer ${token}` : null;
  },

  // Role management
  setUserRole: (roleData: UserRoleResponse): void => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('userRole', roleData.roles);
      localStorage.setItem('userData', JSON.stringify(roleData));
    }
  },

  getUserRole: (): string | null => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('userRole');
    }
    return null;
  },

  getUserData: (): UserRoleResponse | null => {
    if (typeof window !== 'undefined') {
      const userData = localStorage.getItem('userData');
      return userData ? JSON.parse(userData) : null;
    }
    return null;
  },

  // Current user management
  setCurrentUser: (currentUser: CurrentUserDto): void => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
    }
  },

  getCurrentUser: (): CurrentUserDto | null => {
    if (typeof window !== 'undefined') {
      const currentUser = localStorage.getItem('currentUser');
      return currentUser ? JSON.parse(currentUser) : null;
    }
    return null;
  },

  // Team ID management (for role correction)
  setTeamId: (teamId: number | null): void => {
    if (typeof window !== 'undefined') {
      if (teamId !== null) {
        localStorage.setItem('teamId', teamId.toString());
      } else {
        localStorage.removeItem('teamId');
      }
    }
  },

  getTeamId: (): number | null => {
    if (typeof window !== 'undefined') {
      const teamId = localStorage.getItem('teamId');
      return teamId ? parseInt(teamId, 10) : null;
    }
    return null;
  },

  // Corrected role flags (based on teamId fetch)
  setCorrectedRoleFlags: (flags: { isManager: boolean; isFieldOfficer: boolean } | null): void => {
    if (typeof window !== 'undefined') {
      if (flags) {
        localStorage.setItem('correctedRoleFlags', JSON.stringify(flags));
      } else {
        localStorage.removeItem('correctedRoleFlags');
      }
    }
  },

  getCorrectedRoleFlags: (): { isManager: boolean; isFieldOfficer: boolean } | null => {
    if (typeof window !== 'undefined') {
      const flags = localStorage.getItem('correctedRoleFlags');
      return flags ? JSON.parse(flags) : null;
    }
    return null;
  }
};

// Authentication API calls
export const authService = {
  login: async (credentials: LoginCredentials): Promise<LoginResponse> => {
    try {
      const response = await fetch(LOGIN_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        const errorText = (await response.text()).trim();

        if (response.status === 401 || response.status === 403) {
          throw new Error('Invalid credentials');
        }

        const fallbackMessage = errorText
          ? `Login failed: ${response.status} ${errorText}`
          : `Login failed: ${response.status}`;

        throw new Error(fallbackMessage.trim());
      }

      const tokenData = await response.text();
      let role: string;
      let token: string;

      try {
        ({ role, token } = parseTokenResponse(tokenData));
      } catch (parseError) {
        const normalizedBody = tokenData.trim().toLowerCase();
        const parseMessage = parseError instanceof Error ? parseError.message.toLowerCase() : '';

        const invalidCredentialHints = ['invalid credential', 'wrong credential', 'bad credential', 'unauthorized', 'forbidden', 'credentials'];

        const isInvalidCredentials =
          invalidCredentialHints.some((hint) => normalizedBody.includes(hint)) ||
          invalidCredentialHints.some((hint) => parseMessage.includes(hint));

        if (isInvalidCredentials) {
          throw new Error('Invalid credentials');
        }

        throw parseError;
      }

      // Store token in localStorage
      tokenManager.setToken(token);

      // Fetch detailed user role information
      try {
        console.log('Fetching role for username:', credentials.username);
        console.log('Raw token response:', tokenData);
        console.log('Token being used:', token);
        
        const roleResponse = await fetch(`${USER_ROLE_ENDPOINT}?username=${credentials.username}`, {
          credentials: 'include', // Ensure cookies are sent
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`, // Manually add token
            'Content-Type': 'application/json',
          },
        });

        if (roleResponse.ok) {
          const userRoleData: UserRoleResponse = await roleResponse.json();
          tokenManager.setUserRole(userRoleData);
          console.log('User role data stored:', userRoleData);
        } else {
          console.warn('Failed to fetch user role data:', roleResponse.status, roleResponse.statusText);
          const errorText = await roleResponse.text();
          console.warn('Error response:', errorText);
        }
      } catch (roleError) {
        console.warn('Error fetching user role data:', roleError);
      }

      // Fetch current user details
      try {
        const currentUserResponse = await fetch(CURRENT_USER_ENDPOINT, {
          credentials: 'include',
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (currentUserResponse.ok) {
          const currentUserData: CurrentUserDto = await currentUserResponse.json();
          tokenManager.setCurrentUser(currentUserData);
          console.log('Current user data stored:', currentUserData);
        } else {
          console.warn('Failed to fetch current user data:', currentUserResponse.status);
        }
      } catch (currentUserError) {
        console.warn('Error fetching current user data:', currentUserError);
      }

      // Fetch teamId to correct role detection (for managers/field officers)
      // This is the key fix: if we can fetch teamId, user is definitely a manager or field officer
      try {
        const userRoleData = tokenManager.getUserData();
        if (userRoleData?.employeeId) {
          console.log('Attempting to fetch teamId for employeeId:', userRoleData.employeeId);
          
          // Import API dynamically to avoid circular dependencies
          const { API } = await import('./api');
          const teamData = await API.getTeamByEmployee(userRoleData.employeeId);
          
          if (teamData && teamData.length > 0) {
            const teamId = teamData[0].id;
            tokenManager.setTeamId(teamId);
            console.log('✅ TeamId fetched successfully:', teamId);
            
            // Determine if user is manager or field officer based on team data.
            // Manager: employeeId is present in the multi-manager officeManagers list
            // or one of the legacy compatibility manager fields.
            // Field Officer: employeeId is in the fieldOfficers array
            let isManager = false;
            let isFieldOfficer = false;
            
            for (const team of teamData) {
              if (teamHasManager(team, userRoleData.employeeId)) {
                isManager = true;
                break;
              }
              if (team.fieldOfficers && team.fieldOfficers.some(fo => fo.id === userRoleData.employeeId)) {
                isFieldOfficer = true;
                break;
              }
            }
            
            // If we found team data but couldn't determine role, default to manager
            // (since getTeamByEmployee typically returns teams where user is the manager)
            if (!isManager && !isFieldOfficer) {
              isManager = true;
              console.log('⚠️ Could not determine role from team structure, defaulting to manager');
            }
            
            tokenManager.setCorrectedRoleFlags({ isManager, isFieldOfficer });
            console.log('✅ Role corrected based on teamId:', { isManager, isFieldOfficer, teamId });
          } else {
            console.log('No team data found - user is not a manager or field officer');
            tokenManager.setTeamId(null);
            tokenManager.setCorrectedRoleFlags(null);
          }
        } else {
          console.log('No employeeId found - skipping teamId fetch');
        }
      } catch (teamError) {
        console.warn('Error fetching teamId (user may not be manager/field officer):', teamError);
        // Don't throw - this is expected for admins and regular users
        tokenManager.setTeamId(null);
        tokenManager.setCorrectedRoleFlags(null);
      }

      return {
        token,
        role: role || 'USER'
      };
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  },

  logout: async (): Promise<void> => {
    try {
      const token = tokenManager.getToken();
      
      if (!token) {
        // No token to logout, just clear local storage
        tokenManager.removeToken();
        return;
      }

      const response = await fetch(LOGOUT_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      // Clear token regardless of response status
      tokenManager.removeToken();

      if (!response.ok) {
        console.warn('Logout request failed, but token was cleared locally');
      }
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear the token even if the request fails
      tokenManager.removeToken();
    }
  },

  isAuthenticated: (): boolean => {
    return !!tokenManager.getToken();
  },

  getStoredToken: (): string | null => {
    return tokenManager.getToken();
  },

  getUserRole: (): string | null => {
    return tokenManager.getUserRole();
  },

  getUserData: (): UserRoleResponse | null => {
    return tokenManager.getUserData();
  },

  getCurrentUser: (): CurrentUserDto | null => {
    return tokenManager.getCurrentUser();
  },

  getTeamId: (): number | null => {
    return tokenManager.getTeamId();
  },

  getCorrectedRoleFlags: (): { isManager: boolean; isFieldOfficer: boolean } | null => {
    return tokenManager.getCorrectedRoleFlags();
  }
};
