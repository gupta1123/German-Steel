"use client";

import { useEffect, useState } from 'react';
import { Loader2, MapPin, Users } from 'lucide-react';
import { getEmployeeRoleCategory } from '@/lib/employee-role';
import { teamsApi, type CrmTeam, type TeamEmployee } from '@/lib/teams-api';
import { useAuth } from '@/components/auth-provider';
import Link from 'next/link';
import { EmptyState, Initials, Section } from '@/components/detail-ui';
import { Button } from '@/components/ui/button';

const fullName = (employee: { firstName?: string | null; lastName?: string | null }) =>
  [employee.firstName, employee.lastName].filter(Boolean).join(' ').trim() || 'Name unavailable';

function ManagedTeams({ employeeId }: { employeeId: number }) {
  const { token } = useAuth();
  const [teams, setTeams] = useState<Array<CrmTeam & { members: TeamEmployee[] }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    // Documented: GET /api/common/teams?officeManagerId={id} and GET /api/common/teams/{teamId}/employees
    teamsApi.getTeamsPage(token, { officeManagerId: employeeId, page: 0, size: 50 })
      .then(async (page) => {
        if (cancelled) return;
        const enriched = await Promise.all(
          page.content.map(async (team) => {
            try {
              const membersPage = await teamsApi.getTeamEmployeesPage(token, team.id, { page: 0, size: 50 });
              return { ...team, members: membersPage.content };
            } catch {
              return { ...team, members: [] as TeamEmployee[] };
            }
          })
        );
        if (!cancelled) {
          setTeams(enriched.sort((a, b) => a.id - b.id));
        }
      })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [employeeId, token, attempt]);

  return <ManagedTeamsPanel teams={teams} loading={loading} error={error} onRetry={() => setAttempt((value) => value + 1)} />;
}

/** Presentational list of a regional manager's teams (field officers + cities per team). */
export function ManagedTeamsPanel({ teams, loading, error, onRetry }: { teams: Array<CrmTeam & { members: TeamEmployee[] }>; loading: boolean; error: boolean; onRetry: () => void }) {
  const officerCount = new Set(teams.flatMap((team) => team.members.map((member) => member.id))).size;

  return (
    <Section
      icon={Users}
      title={loading || error ? 'Managed teams' : `Managed teams · ${teams.length}`}
      description={!loading && !error && teams.length > 0 ? `${officerCount} field ${officerCount === 1 ? 'officer' : 'officers'} across ${teams.length} ${teams.length === 1 ? 'team' : 'teams'}` : undefined}
      bodyClassName="p-0"
      action={error ? <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs" onClick={onRetry}>Retry</Button> : undefined}
    >
      {loading ? (
        <p role="status" className="flex items-center justify-center gap-2 px-4 py-4 text-xs text-muted-foreground">
          <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" /> Loading teams…
        </p>
      ) : error ? (
        <p role="alert" className="px-4 py-4 text-center text-xs text-destructive">Couldn’t load managed teams.</p>
      ) : teams.length === 0 ? (
        <EmptyState compact title="No teams assigned to this regional manager yet." />
      ) : (
        <ul className="divide-y">
          {teams.map((team) => {
            const officers = [...team.members].sort((a, b) => fullName(a).localeCompare(fullName(b)));
            const citySet = new Map<string, string>();
            officers.forEach((m) => {
              const raw = (m.city || '').trim();
              if (!raw) return;
              const key = raw.toLowerCase();
              if (!citySet.has(key)) citySet.set(key, raw);
            });
            const cities = Array.from(citySet.values()).sort((a, b) => a.localeCompare(b));
            const displayName = team.teamName && team.teamName !== `Team ${team.id}` ? team.teamName : `Team #${team.id}`;
            return (
              <li key={team.id} aria-label={displayName} className="space-y-2.5 px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <h4 className="text-sm font-semibold">
                    {displayName}
                    {team.teamCode && <span className="ml-1.5 font-mono text-[11px] font-normal text-muted-foreground" data-preserve-case="true">{team.teamCode}</span>}
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    {officers.length} {officers.length === 1 ? 'officer' : 'officers'} · {cities.length} {cities.length === 1 ? 'city' : 'cities'}{team.officeManagerName ? ` · supervisor ${team.officeManagerName}` : ''}
                  </p>
                </div>
                {officers.length ? (
                  <ul className="flex flex-wrap gap-1.5">
                    {officers.map((officer) => (
                      <li key={officer.id}>
                        <Link href={`/dashboard/employees/${officer.id}`} className="inline-flex items-center gap-1.5 rounded-full border bg-background py-0.5 pl-0.5 pr-2.5 text-xs transition-colors hover:bg-muted" title={[fullName(officer), officer.city].filter(Boolean).join(' · ')}>
                          <Initials name={fullName(officer)} className="h-5 w-5 text-[9px]" />
                          <span className="max-w-[160px] truncate">{fullName(officer)}</span>
                          {officer.active === false && <span className="text-[10px] text-muted-foreground">(inactive)</span>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-xs text-muted-foreground">No field officers assigned.</p>}
                {cities.length > 0 && (
                  <p className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
                    <MapPin aria-hidden="true" className="h-3 w-3" />
                    {cities.join(' · ')}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

export function EmployeeManagedTeams({ employeeId, role }: { employeeId: number; role: unknown }) {
  if (getEmployeeRoleCategory(role) !== 'regional-manager' || !Number.isFinite(employeeId)) return null;
  return <ManagedTeams key={employeeId} employeeId={employeeId} />;
}
