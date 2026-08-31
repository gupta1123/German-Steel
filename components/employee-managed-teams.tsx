"use client";

import { useEffect, useState } from 'react';
import { Loader2, MapPin, Users } from 'lucide-react';
import { API, type TeamDataDto } from '@/lib/api';
import { getEmployeeRoleCategory, isAdminEmployee } from '@/lib/employee-role';
import { getTeamAssignedCities, getTeamManagers, getUniqueFieldOfficersFromTeams, teamHasManager } from '@/lib/team-access';
import { formatCityLabel } from '@/lib/city-options';
import { useAuth } from '@/components/auth-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const fullName = (employee: { firstName?: string | null; lastName?: string | null }) =>
  [employee.firstName, employee.lastName].filter(Boolean).join(' ').trim() || 'Name unavailable';

function ManagedTeams({ employeeId }: { employeeId: number }) {
  const { token } = useAuth();
  const [teams, setTeams] = useState<TeamDataDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    API.getTeamByEmployee(employeeId)
      .then((data) => {
        if (!Array.isArray(data)) throw new Error('Invalid team response');
        if (!cancelled) {
          const managed = data.filter((team) => teamHasManager(team, employeeId));
          setTeams(Array.from(new Map(managed.map((team) => [team.id, team])).values())
            .sort((left, right) => left.id - right.id));
        }
      })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [employeeId, token, attempt]);

  return (
    <Card className="min-w-0 gap-0 overflow-hidden py-0 shadow-none">
      <CardHeader className="border-b px-4 py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Users aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
          Managed teams
          {!loading && !error && <Badge variant="secondary" className="ml-auto text-xs">{teams.length}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <p role="status" className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> Loading teams…
          </p>
        ) : error ? (
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p role="alert" className="text-sm text-destructive">Couldn’t load managed teams.</p>
            <Button variant="outline" size="sm" onClick={() => setAttempt((value) => value + 1)}>Retry</Button>
          </div>
        ) : teams.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No teams assigned to this regional manager yet.</p>
        ) : (
          <div className="divide-y">
            {teams.map((team) => {
              const managers = getTeamManagers(team).filter((manager) => !isAdminEmployee(manager));
              const officers = getUniqueFieldOfficersFromTeams([team])
                .filter((officer) => !isAdminEmployee(officer))
                .sort((left, right) => fullName(left).localeCompare(fullName(right)));
              const cities = getTeamAssignedCities(team).map(formatCityLabel)
                .sort((left, right) => left.localeCompare(right));
              return (
                <section key={team.id} aria-label={`Team #${team.id}`} className="space-y-4 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">Team #{team.id}</h3>
                    <span className="text-xs text-muted-foreground">
                      {officers.length} field {officers.length === 1 ? 'officer' : 'officers'} · {cities.length} {cities.length === 1 ? 'city' : 'cities'}
                    </span>
                  </div>
                  <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                    <div className="min-w-0 space-y-3">
                      <div>
                        <h4 className="mb-1.5 text-xs font-medium text-muted-foreground">Regional managers</h4>
                        <ul className="m-0 grid list-none gap-1 p-0 text-sm [&>li]:mt-0">
                          {managers.map((manager) => <li key={manager.id} className="break-words">{fullName(manager)}</li>)}
                        </ul>
                      </div>
                      <div>
                        <h4 className="mb-1.5 text-xs font-medium text-muted-foreground">Field officers</h4>
                        {officers.length ? (
                          <ul className="m-0 grid list-none gap-1 p-0 text-sm [&>li]:mt-0">
                            {officers.map((officer) => <li key={officer.id} className="break-words">{fullName(officer)}</li>)}
                          </ul>
                        ) : <p className="text-xs text-muted-foreground">No field officers assigned.</p>}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <h4 className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <MapPin aria-hidden="true" className="h-3.5 w-3.5" /> Team cities
                      </h4>
                      {cities.length ? (
                        <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0 [&>li]:mt-0">
                          {cities.map((city) => <li key={city} className="max-w-full break-words rounded-md bg-muted/60 px-2 py-1 text-xs">{city}</li>)}
                        </ul>
                      ) : <p className="text-xs text-muted-foreground">No cities assigned.</p>}
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function EmployeeManagedTeams({ employeeId, role }: { employeeId: number; role: unknown }) {
  if (getEmployeeRoleCategory(role) !== 'regional-manager' || !Number.isFinite(employeeId)) return null;
  return <ManagedTeams key={employeeId} employeeId={employeeId} />;
}
