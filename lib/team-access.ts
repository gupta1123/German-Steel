type TeamWithFieldOfficers<T extends { id: number }> = {
  id: number;
  fieldOfficers?: T[] | null;
};

type TeamWithManagers<T extends { id: number }> = {
  id: number;
  office?: T | null;
  officeManager?: T | null;
  officeManagers?: T[] | null;
};

export const getTeamIds = <T extends { id: number }>(teams: TeamWithFieldOfficers<T>[]): number[] => {
  return Array.from(new Set(teams.map((team) => team.id).filter((id) => Number.isFinite(id))));
};

export const getUniqueFieldOfficersFromTeams = <T extends { id: number }>(teams: TeamWithFieldOfficers<T>[]): T[] => {
  const byId = new Map<number, T>();

  teams.forEach((team) => {
    (team.fieldOfficers ?? []).forEach((officer) => {
      byId.set(officer.id, officer);
    });
  });

  return Array.from(byId.values());
};

export const getTeamManagers = <T extends { id: number }>(team: TeamWithManagers<T>): T[] => {
  const byId = new Map<number, T>();

  (team.officeManagers ?? []).forEach((manager) => {
    if (manager?.id != null && Number.isFinite(manager.id)) {
      byId.set(manager.id, manager);
    }
  });

  if (team.officeManager?.id != null && Number.isFinite(team.officeManager.id)) {
    byId.set(team.officeManager.id, team.officeManager);
  }

  if (team.office?.id != null && Number.isFinite(team.office.id)) {
    byId.set(team.office.id, team.office);
  }

  return Array.from(byId.values());
};

export const getPrimaryTeamManager = <T extends { id: number }>(team: TeamWithManagers<T>): T | null => {
  return getTeamManagers(team)[0] ?? null;
};

export const getUniqueManagersFromTeams = <T extends { id: number }>(teams: TeamWithManagers<T>[]): T[] => {
  const byId = new Map<number, T>();

  teams.forEach((team) => {
    getTeamManagers(team).forEach((manager) => {
      byId.set(manager.id, manager);
    });
  });

  return Array.from(byId.values());
};

export const teamHasManager = <T extends { id: number }>(
  team: TeamWithManagers<T>,
  employeeId: number | null | undefined
): boolean => {
  if (employeeId == null || !Number.isFinite(employeeId)) return false;
  return getTeamManagers(team).some((manager) => manager.id === employeeId);
};

export const getTeamAssignedCities = <T extends { id: number; assignedCity?: string[] | null }>(
  team: TeamWithManagers<T>
): string[] => {
  const seen = new Set<string>();
  const cities: string[] = [];

  getTeamManagers(team).forEach((manager) => {
    (manager.assignedCity ?? []).forEach((city) => {
      const value = city?.trim();
      const key = value?.toLowerCase();
      if (!value || !key || seen.has(key)) return;
      seen.add(key);
      cities.push(value);
    });
  });

  return cities;
};
