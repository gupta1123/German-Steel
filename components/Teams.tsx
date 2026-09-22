"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/components/auth-provider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUnsavedChanges } from '@/components/unsaved-changes-provider';
import AddTeam from '@/components/AddTeam';
import { getEmployeeRoleCategory, getEmployeeRoleLabel } from '@/lib/employee-role';
import { CrmTeam, TeamEmployee, TeamRegion, teamsApi } from '@/lib/teams-api';
import { ChevronLeft, ChevronRight, Loader2, MapPin, Pencil, Search, ShieldCheck, Trash2, UserPlus, Users, X } from 'lucide-react';
import { toast } from 'sonner';

interface TeamFormState {
    teamName: string;
    teamCode: string;
    officeManagerId: string;
}

const emptyTeamForm: TeamFormState = {
    teamName: '',
    teamCode: '',
    officeManagerId: '',
};

const toTitleCase = (value: string) =>
    value.trim().toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

const toSentenceCase = (value: string) => {
    const t = value.trim().toLowerCase();
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
};

const employeeName = (employee: Pick<TeamEmployee, 'id' | 'firstName' | 'lastName'>) =>
    toTitleCase(`${employee.firstName} ${employee.lastName}`.trim()) || `Employee ${employee.id}`;

const displayRoleSentence = (role: string) => toSentenceCase(getEmployeeRoleLabel(role));

const Teams: React.FC = () => {
    const { token } = useAuth();
    const [teams, setTeams] = useState<CrmTeam[]>([]);
    const [activeTeamIds, setActiveTeamIds] = useState<Set<number>>(new Set());
    const [assignedSupervisorIds, setAssignedSupervisorIds] = useState<Set<number>>(new Set());
    const [employees, setEmployees] = useState<TeamEmployee[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [teamPage, setTeamPage] = useState(0);
    const [teamPageSize, setTeamPageSize] = useState(12);
    const [teamTotalPages, setTeamTotalPages] = useState(1);
    const [teamTotalElements, setTeamTotalElements] = useState(0);
    const [isTeamDialogOpen, setIsTeamDialogOpen] = useState(false);
    const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false);
    const [createTab, setCreateTab] = useState('details');
    const [createRegionIds, setCreateRegionIds] = useState<number[]>([]);
    const [createMemberIds, setCreateMemberIds] = useState<number[]>([]);
    const [createSearch, setCreateSearch] = useState('');
    const [editingTeamId, setEditingTeamId] = useState<number | null>(null);
    const [teamForm, setTeamForm] = useState<TeamFormState>(emptyTeamForm);
    const [isSavingTeam, setIsSavingTeam] = useState(false);
    const [managedTeamId, setManagedTeamId] = useState<number | null>(null);
    const [memberSearch, setMemberSearch] = useState('');
    const [membershipSavingId, setMembershipSavingId] = useState<number | null>(null);
    const [memberToRemove, setMemberToRemove] = useState<TeamEmployee | null>(null);
    const [manageTab, setManageTab] = useState('overview');
    const [regions, setRegions] = useState<TeamRegion[]>([]);
    const [teamRegionIds, setTeamRegionIds] = useState<Record<number, number[]>>({});
    const [regionSearch, setRegionSearch] = useState('');
    const [isSavingRegions, setIsSavingRegions] = useState(false);
    const [isSavingSupervisor, setIsSavingSupervisor] = useState(false);
    const [isDeletingTeam, setIsDeletingTeam] = useState(false);
    const [deleteTeamOpen, setDeleteTeamOpen] = useState(false);

    const editingTeam = useMemo(
        () => teams.find((team) => team.id === editingTeamId) ?? null,
        [editingTeamId, teams],
    );
    const managedTeam = useMemo(
        () => teams.find((team) => team.id === managedTeamId) ?? null,
        [managedTeamId, teams],
    );
    const teamFormIsValid = Boolean(
        teamForm.teamName.trim() &&
        Number.isInteger(Number(teamForm.officeManagerId)) &&
        Number(teamForm.officeManagerId) > 0,
    );
    const createSteps = ['details', 'regions', 'members'] as const;
    const createStepIndex = Math.max(0, createSteps.indexOf(createTab as (typeof createSteps)[number]));
    const teamFormIsDirty = isTeamDialogOpen && (
        editingTeam
            ? teamForm.teamName !== editingTeam.teamName ||
                teamForm.teamCode !== editingTeam.teamCode ||
                Number(teamForm.officeManagerId) !== editingTeam.officeManagerId
            : Boolean(teamForm.teamName || teamForm.teamCode || teamForm.officeManagerId)
    );
    const { requestDiscard } = useUnsavedChanges(teamFormIsDirty);

    const managers = useMemo(
        () => employees
            .filter((employee) => employee.active && getEmployeeRoleCategory(employee.role) === 'regional-manager')
            .sort((a, b) => employeeName(a).localeCompare(employeeName(b))),
        [employees],
    );
    const availableCreateSupervisors = useMemo(
        () => managers.filter((manager) => !assignedSupervisorIds.has(manager.id)),
        [assignedSupervisorIds, managers],
    );
    const availableManagedSupervisors = useMemo(
        () => managers.filter((manager) => manager.id === managedTeam?.officeManagerId || !assignedSupervisorIds.has(manager.id)),
        [assignedSupervisorIds, managedTeam?.officeManagerId, managers],
    );
    const availableEditSupervisors = useMemo(
        () => managers.filter((manager) => manager.id === editingTeam?.officeManagerId || !assignedSupervisorIds.has(manager.id)),
        [assignedSupervisorIds, editingTeam?.officeManagerId, managers],
    );

    const loadTeams = useCallback(async (showLoading = true) => {
        if (!token) {
            setError('Authentication token not found. Please log in.');
            setIsLoading(false);
            return;
        }

        if (showLoading) setIsLoading(true);
        setError(null);
        try {
            // Use paginated endpoints per guide: GET /api/common/teams?q=&officeManagerId=&page=0&size=50 and GET /api/common/employees?active=true&page=0&size=50
            const q = searchQuery.trim() || undefined;
            const [employeePage, teamPageData, regionData, allTeamsPage] = await Promise.all([
                teamsApi.getEmployeesPage(token, { active: true, page: 0, size: 50 }),
                teamsApi.getTeamsPage(token, { q, active: true, page: teamPage, size: teamPageSize }),
                teamsApi.getRegions(token),
                teamsApi.getTeamsPage(token, { active: true, page: 0, size: 500 }),
            ]);
            const employeeDirectory = employeePage.content;
            // Hydrate members via GET /api/common/teams/{teamId}/employees?page=0&size=50 (paginated, not full snapshot)
            const hydratedTeams = await Promise.all(
                teamPageData.content.map(async (team) => {
                    try {
                        const membersPage = await teamsApi.getTeamEmployeesPage(token, team.id, { page: 0, size: 50 });
                        return { ...team, employees: membersPage.content };
                    } catch {
                        return team;
                    }
                })
            );
            setEmployees(employeeDirectory);
            setActiveTeamIds(new Set(allTeamsPage.content.map((team) => team.id)));
            setAssignedSupervisorIds(new Set(allTeamsPage.content.flatMap((team) => team.officeManagerId == null ? [] : [team.officeManagerId])));
            setRegions(regionData.filter((region) => region.active).sort((a, b) => a.name.localeCompare(b.name)));
            setTeams(hydratedTeams.sort((a, b) => a.teamName.localeCompare(b.teamName)));
            setTeamRegionIds((current) => {
                const next = { ...current };
                hydratedTeams.forEach((team) => {
                    if (next[team.id]) return;
                    const manager = employeeDirectory.find((employee) => employee.id === team.officeManagerId);
                    next[team.id] = team.regionIds.length > 0
                        ? [...team.regionIds]
                        : Array.from(new Set([...(manager?.regionIds ?? []), ...team.employees.flatMap((employee) => employee.regionIds)])).sort((a, b) => a - b);
                });
                return next;
            });
            setTeamTotalPages(teamPageData.totalPages);
            setTeamTotalElements(teamPageData.totalElements);
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Could not load teams.');
        } finally {
            if (showLoading) setIsLoading(false);
        }
    }, [token, searchQuery, teamPage, teamPageSize]);

    useEffect(() => {
        void loadTeams();
    }, [loadTeams]);

    const getManagerName = useCallback((team: CrmTeam): string => {
        const manager = employees.find((employee) => employee.id === team.officeManagerId);
        return manager ? employeeName(manager) : team.officeManagerName || 'No office manager assigned';
    }, [employees]);

    const getEmployeeRegionLabel = useCallback((employee: TeamEmployee): string => {
        const names = employee.regionIds
            .map((regionId) => regions.find((region) => region.id === regionId)?.name)
            .filter((name): name is string => Boolean(name));
        return names.length > 0 ? names.join(', ') : 'No region assigned';
    }, [regions]);

    const filteredTeams = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return teams;
        return teams.filter((team) => [
            team.teamName,
            team.teamCode,
            getManagerName(team),
            ...team.employees.map(employeeName),
        ].some((value) => value.toLowerCase().includes(query)));
    }, [getManagerName, searchQuery, teams]);

    const openCreateDialog = () => {
        setEditingTeamId(null);
        setTeamForm(emptyTeamForm);
        setCreateRegionIds([]);
        setCreateMemberIds([]);
        setCreateSearch('');
        setCreateTab('details');
        setIsCreateTeamOpen(true);
    };

    const openEditDialog = (team: CrmTeam) => {
        setEditingTeamId(team.id);
        setTeamForm({
            teamName: team.teamName,
            teamCode: team.teamCode,
            officeManagerId: team.officeManagerId ? String(team.officeManagerId) : '',
        });
        setIsTeamDialogOpen(true);
    };

    const closeTeamDialog = () => {
        if (isSavingTeam) return;
        requestDiscard(() => {
            setIsTeamDialogOpen(false);
            setEditingTeamId(null);
            setTeamForm(emptyTeamForm);
        }, teamFormIsDirty);
    };

    const saveTeam = async () => {
        if (!token || !teamFormIsValid || !editingTeamId) return;
        setIsSavingTeam(true);
        setError(null);
        try {
            const selectedSupervisorId = Number(teamForm.officeManagerId);
            const latestTeams = await teamsApi.getTeamsPage(token, { active: true, page: 0, size: 500 });
            if (latestTeams.content.some((team) => team.id !== editingTeamId && team.officeManagerId === selectedSupervisorId)) {
                throw new Error('This supervisor already leads another team.');
            }
            const input = {
                teamName: teamForm.teamName.trim(),
                teamCode: teamForm.teamCode.trim().toUpperCase(),
                officeManagerId: selectedSupervisorId,
            };
            await teamsApi.updateTeam(token, editingTeamId, input);
            setIsTeamDialogOpen(false);
            setEditingTeamId(null);
            setTeamForm(emptyTeamForm);
            await loadTeams(false);
            toast.success('Team updated', { duration: 3000 });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Could not save the team.';
            setError(message);
            toast.error(message, { duration: 3000 });
        } finally {
            setIsSavingTeam(false);
        }
    };

    const createTeam = async () => {
        if (!token || !teamFormIsValid) return;
        setIsSavingTeam(true);
        try {
            const selectedSupervisorId = Number(teamForm.officeManagerId);
            const latestTeams = await teamsApi.getTeamsPage(token, { active: true, page: 0, size: 500 });
            if (latestTeams.content.some((team) => team.officeManagerId === selectedSupervisorId)) {
                throw new Error('This supervisor already leads another team.');
            }
            const generatedCode = teamForm.teamName.trim().toUpperCase()
                .replace(/[^A-Z0-9]+/g, '-')
                .replace(/^-|-$/g, '')
                .slice(0, 48) || `TEAM-${Date.now()}`;
            const created = await teamsApi.createTeam(token, {
                teamName: teamForm.teamName.trim(),
                teamCode: generatedCode,
                officeManagerId: selectedSupervisorId,
                regionIds: createRegionIds,
                active: true,
            });
            const selectedMembers = regionEligibleCreateEmployees.filter((employee) => createMemberIds.includes(employee.id));
            await Promise.all(selectedMembers.map((employee) => teamsApi.addTeamEmployee(token, created.id, employee.id)));
            setIsCreateTeamOpen(false);
            setTeamForm(emptyTeamForm);
            setCreateRegionIds([]);
            setCreateMemberIds([]);
            await loadTeams(false);
            toast.success('Team created');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not create the team.');
        } finally {
            setIsSavingTeam(false);
        }
    };

    const availableEmployees = useMemo(() => {
        if (!managedTeam) return [];
        const query = memberSearch.trim().toLowerCase();
        const coveredRegionIds = new Set(teamRegionIds[managedTeam.id] ?? []);
        return employees
            .filter((employee) => (
                employee.active &&
                getEmployeeRoleCategory(employee.role) === 'field-officer' &&
                (employee.teamId == null || !activeTeamIds.has(employee.teamId)) &&
                employee.regionIds.some((regionId) => coveredRegionIds.has(regionId))
            ))
            .filter((employee) => !query || employeeName(employee).toLowerCase().includes(query))
            .sort((a, b) => employeeName(a).localeCompare(employeeName(b)));
    }, [activeTeamIds, employees, managedTeam, memberSearch, teamRegionIds]);

    const regionEligibleCreateEmployees = useMemo(() => {
        const coveredRegionIds = new Set(createRegionIds);
        return employees
            .filter((employee) => employee.active && getEmployeeRoleCategory(employee.role) === 'field-officer' && (employee.teamId == null || !activeTeamIds.has(employee.teamId)) && employee.regionIds.some((regionId) => coveredRegionIds.has(regionId)))
            .sort((a, b) => employeeName(a).localeCompare(employeeName(b)));
    }, [activeTeamIds, createRegionIds, employees]);

    const availableCreateEmployees = useMemo(() => {
        const query = createSearch.trim().toLowerCase();
        return regionEligibleCreateEmployees
            .filter((employee) => !query || `${employeeName(employee)} ${displayRoleSentence(employee.role)}`.toLowerCase().includes(query))
    }, [createSearch, regionEligibleCreateEmployees]);

    const visibleMembers = useMemo(() => {
        if (!managedTeam) return [];
        const query = memberSearch.trim().toLowerCase();
        return managedTeam.employees
            .filter((employee) => !query || employeeName(employee).toLowerCase().includes(query))
            .sort((a, b) => employeeName(a).localeCompare(employeeName(b)));
    }, [managedTeam, memberSearch]);

    const updateMembership = async (employee: TeamEmployee, teamId: number | null) => {
        if (!token) return;
        setMembershipSavingId(employee.id);
        try {
            if (teamId == null) {
                if (employee.teamId == null) return;
                await teamsApi.removeTeamEmployee(token, employee.teamId, employee.id);
            } else {
                await teamsApi.addTeamEmployee(token, teamId, employee.id);
            }
            await loadTeams(false);
            toast.success(teamId == null ? 'Employee removed from team' : 'Employee added to team', { duration: 3000 });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Could not update team membership.';
            toast.error(message, { duration: 3000 });
        } finally {
            setMembershipSavingId(null);
            setMemberToRemove(null);
        }
    };

    const openManageTeam = (team: CrmTeam, tab = 'overview') => {
        setManagedTeamId(team.id);
        setManageTab(tab);
        setMemberSearch('');
        setRegionSearch('');
    };

    const saveSupervisor = async (officeManagerId: number) => {
        if (!token || !managedTeam || officeManagerId === managedTeam.officeManagerId) return;
        setIsSavingSupervisor(true);
        try {
            const latestTeams = await teamsApi.getTeamsPage(token, { active: true, page: 0, size: 500 });
            if (latestTeams.content.some((team) => team.id !== managedTeam.id && team.officeManagerId === officeManagerId)) {
                throw new Error('This supervisor already leads another team.');
            }
            await teamsApi.updateTeamSupervisor(token, managedTeam.id, officeManagerId);
            await loadTeams(false);
            toast.success('Supervisor updated', { duration: 3000 });
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not update the supervisor.');
        } finally {
            setIsSavingSupervisor(false);
        }
    };

    const saveRegions = async () => {
        if (!token || !managedTeam) return;
        setIsSavingRegions(true);
        try {
            await teamsApi.updateTeamRegions(token, managedTeam.id, managedRegionIds);
            await loadTeams(false);
            toast.success('Region coverage saved');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not save region coverage.');
        } finally {
            setIsSavingRegions(false);
        }
    };

    const removeMember = async (employee: TeamEmployee) => {
        if (!managedTeam) return;
        setMembershipSavingId(employee.id);
        try {
            if (!token) return;
            await teamsApi.removeTeamEmployee(token, managedTeam.id, employee.id);
            setTeams((current) => current.map((team) => team.id === managedTeam.id
                ? { ...team, employees: team.employees.filter((member) => member.id !== employee.id) }
                : team));
            setEmployees((current) => current.map((member) => member.id === employee.id
                ? { ...member, teamId: null }
                : member));
            setMemberToRemove(null);
            toast.success('Employee removed from team');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not remove the employee.');
        } finally {
            setMembershipSavingId(null);
        }
    };

    const deleteManagedTeam = async () => {
        if (!managedTeam) return;
        setIsDeletingTeam(true);
        try {
            if (!token) return;
            await teamsApi.deleteTeam(token, managedTeam.id);
            await loadTeams(false);
            setDeleteTeamOpen(false);
            setManagedTeamId(null);
            toast.success('Team deactivated');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not deactivate the team.');
        } finally {
            setIsDeletingTeam(false);
        }
    };

    const managedManager = managedTeam
        ? employees.find((employee) => employee.id === managedTeam.officeManagerId) ?? null
        : null;
    const managedRegionIds = managedTeam ? (teamRegionIds[managedTeam.id] ?? []) : [];
    const filteredRegions = regions.filter((region) => (
        !regionSearch.trim() || `${region.name} ${region.code}`.toLowerCase().includes(regionSearch.trim().toLowerCase())
    ));
    const memberRoleCounts = managedTeam?.employees.reduce<Record<string, number>>((counts, employee) => {
        const key = displayRoleSentence(employee.role) || 'Field executive';
        counts[key] = (counts[key] ?? 0) + 1;
        return counts;
    }, {}) ?? {};

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/20 p-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1 space-y-1.5">
                    <Label htmlFor="team-search" className="text-xs">Search</Label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            id="team-search"
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder="Search team, code, manager, or employee..."
                            className="h-9 pl-9 pr-9"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                aria-label="Clear team search"
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </div>
                {!isLoading && <span className="text-xs text-muted-foreground">{filteredTeams.length} of {teams.length} teams</span>}
                <AddTeam onClick={openCreateDialog} disabled={isLoading || availableCreateSupervisors.length === 0} />
            </div>

            {isLoading && (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-56 rounded-xl" />)}
                </div>
            )}

            {error && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <p>{error}</p>
                        <Button variant="outline" size="sm" onClick={() => void loadTeams()}>Try Again</Button>
                    </div>
                </div>
            )}

            {!isLoading && !error && teams.length === 0 && (
                <div className="rounded-xl border border-dashed p-10 text-center">
                    <Users className="mx-auto h-8 w-8 text-muted-foreground" />
                    <p className="mt-3 text-sm font-medium">No teams have been created.</p>
                    <p className="mt-1 text-xs text-muted-foreground">Create a team and then assign available employees.</p>
                </div>
            )}

            {!isLoading && !error && teams.length > 0 && filteredTeams.length === 0 && (
                <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                    No teams match your search.
                </div>
            )}

            {!isLoading && !error && filteredTeams.length > 0 && (
                <div className="space-y-3">
                    {filteredTeams.map((team) => {
                        const manager = employees.find((employee) => employee.id === team.officeManagerId);
                        const officers = team.employees.filter((employee) => getEmployeeRoleCategory(employee.role) === 'field-officer');
                        const coverageRegionIds = teamRegionIds[team.id] ?? team.regionIds ?? [];
                        const coverage = coverageRegionIds.map((regionId) => ({
                            id: regionId,
                            name: regions.find((region) => region.id === regionId)?.name ?? `Region ${regionId}`,
                        }));
                        const initials = manager
                            ? (`${manager.firstName?.[0] ?? ''}${manager.lastName?.[0] ?? ''}`.trim() || String(manager.id).slice(-2)).toUpperCase()
                            : 'TM';

                        return (
                            <Card key={team.id} className="overflow-hidden border-border/70 py-0 shadow-none transition-colors hover:border-border">
                                <CardContent className="grid min-h-44 gap-3 p-4 lg:grid-cols-[minmax(240px,1.05fr)_minmax(190px,.75fr)_minmax(280px,1.45fr)_150px]">
                                    <section className="flex min-w-0 flex-col p-2">
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="min-w-0 truncate text-sm font-semibold text-foreground" title={team.teamName}>
                                                {team.teamName}
                                            </p>
                                            <span className="text-[11px] text-muted-foreground">{team.officeManagerId ? '1 Supervisor' : 'No supervisor'}</span>
                                        </div>
                                        <div className="flex flex-1 items-center gap-3 py-4">
                                            <Avatar className="h-10 w-10 border bg-background">
                                                <AvatarFallback className="text-xs font-semibold">{initials}</AvatarFallback>
                                            </Avatar>
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-semibold">{getManagerName(team)}</p>
                                                <p className="text-xs text-muted-foreground">Supervisor</p>
                                            </div>
                                        </div>
                                    </section>

                                    <section className="rounded-lg bg-muted/35 p-4">
                                        <p className="text-[11px] font-medium text-muted-foreground">Coverage</p>
                                        {coverage.length ? (
                                            <div className="mt-4 flex flex-wrap gap-2">
                                                {coverage.slice(0, 3).map((region) => (
                                                    <Badge key={region.id} variant="secondary" className="gap-1.5 font-normal">
                                                        <MapPin className="h-3 w-3" />{region.name}
                                                    </Badge>
                                                ))}
                                                {coverage.length > 3 && <Badge variant="outline" className="font-normal">+{coverage.length - 3} more</Badge>}
                                            </div>
                                        ) : <p className="mt-4 text-sm text-muted-foreground">No coverage data</p>}
                                    </section>

                                    <section className="rounded-lg bg-muted/35 p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="text-[11px] font-medium text-muted-foreground">Roster</p>
                                            <span className="text-[11px] text-muted-foreground">{officers.length} {officers.length === 1 ? 'officer' : 'officers'}</span>
                                        </div>
                                        {officers.length ? (
                                            <div className="mt-4 flex flex-wrap gap-2">
                                                {officers.slice(0, 5).map((employee) => (
                                                    <Badge key={employee.id} variant="outline" className="max-w-44 truncate bg-background font-normal">
                                                        {employeeName(employee)}
                                                    </Badge>
                                                ))}
                                                {officers.length > 5 && <Badge variant="secondary" className="font-normal">+{officers.length - 5} more</Badge>}
                                            </div>
                                        ) : <p className="mt-4 text-sm text-muted-foreground">No field officers</p>}
                                    </section>

                                    <section className="flex flex-col justify-between gap-3 border-t pt-3 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => openManageTeam(team)}
                                        >
                                            Manage team
                                        </Button>
                                        <Button variant="ghost" size="sm" className="justify-start text-muted-foreground lg:justify-center" onClick={() => openEditDialog(team)}>
                                            <Pencil className="mr-2 h-3.5 w-3.5" />Edit details
                                        </Button>
                                    </section>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {!isLoading && !error && teamTotalPages > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2 text-xs">
                    <div className="flex items-center gap-2">
                        <Label htmlFor="team-page-size" className="text-xs">Rows per page:</Label>
                        <Select value={String(teamPageSize)} onValueChange={(v) => { setTeamPage(0); setTeamPageSize(Number(v)); }}>
                            <SelectTrigger id="team-page-size" className="h-8 w-20 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>{[6, 12, 24, 50].map((n) => <SelectItem key={n} value={String(n)}>{String(n)}</SelectItem>)}</SelectContent>
                        </Select>
                        <span className="text-muted-foreground hidden sm:inline">{teamTotalElements} teams</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="h-8" onClick={() => setTeamPage((p) => Math.max(0, p - 1))} disabled={teamPage <= 0}>
                            <ChevronLeft className="h-4 w-4" />Previous
                        </Button>
                        <span className="text-muted-foreground">Page {teamPage + 1} of {Math.max(1, teamTotalPages)}</span>
                        <Button variant="outline" size="sm" className="h-8" onClick={() => setTeamPage((p) => p + 1)} disabled={teamPage + 1 >= teamTotalPages}>
                            Next<ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}

            <Sheet open={isCreateTeamOpen} onOpenChange={(open) => {
                if (!isSavingTeam) setIsCreateTeamOpen(open);
            }}>
                <SheetContent className="w-full overflow-hidden p-0 sm:max-w-2xl">
                    <SheetHeader className="border-b bg-card px-5 py-4 text-left">
                        <div className="flex items-center gap-3 pr-8">
                            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary"><Users className="h-5 w-5" /></div>
                            <div><SheetTitle>Create team</SheetTitle><SheetDescription>Set the reporting lead, coverage and members.</SheetDescription></div>
                        </div>
                    </SheetHeader>
                    <Tabs value={createTab} onValueChange={setCreateTab} className="flex h-[calc(100vh-78px)] flex-col">
                        <div className="border-b bg-muted/15 px-3 pt-2">
                            <TabsList className="grid h-10 w-full grid-cols-3 bg-transparent p-0">
                                <TabsTrigger value="details" className="h-9 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">Team</TabsTrigger>
                                <TabsTrigger value="regions" disabled={!teamFormIsValid} className="h-9 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">Regions</TabsTrigger>
                                <TabsTrigger value="members" disabled={!teamFormIsValid || createRegionIds.length === 0} className="h-9 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">Members</TabsTrigger>
                            </TabsList>
                        </div>
                        <ScrollArea className="min-h-0 flex-1">
                            <TabsContent value="details" className="m-0 space-y-5 p-5">
                                <div className="space-y-1.5"><Label htmlFor="new-team-name">Team name</Label><Input id="new-team-name" value={teamForm.teamName} onChange={(event) => setTeamForm((current) => ({ ...current, teamName: event.target.value }))} placeholder="Ahmedabad Sales Team" autoFocus /></div>
                                <section className="space-y-2">
                                    <div><h3 className="text-sm font-semibold">Zonal supervisor</h3><p className="mt-1 text-xs text-muted-foreground">Select who this team reports to.</p></div>
                                    {availableCreateSupervisors.map((manager) => {
                                        const selected = teamForm.officeManagerId === String(manager.id);
                                        return <button key={manager.id} type="button" onClick={() => setTeamForm((current) => ({ ...current, officeManagerId: String(manager.id) }))} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${selected ? 'border-primary bg-primary/5' : 'hover:bg-muted/30'}`}><span className={`flex h-4 w-4 items-center justify-center rounded-full border ${selected ? 'border-primary' : 'border-muted-foreground/50'}`}>{selected && <span className="h-2 w-2 rounded-full bg-primary" />}</span><Avatar className="h-9 w-9"><AvatarFallback className="text-xs">{`${manager.firstName?.[0] ?? ''}${manager.lastName?.[0] ?? ''}`.toUpperCase()}</AvatarFallback></Avatar><span><span className="block text-sm font-medium">{employeeName(manager)}</span><span className="block text-xs text-muted-foreground">Supervisor · {getEmployeeRegionLabel(manager)}</span></span></button>;
                                    })}
                                </section>
                            </TabsContent>
                            <TabsContent value="regions" className="m-0 space-y-4 p-5">
                                <div><h3 className="text-sm font-semibold">Region coverage</h3><p className="mt-1 text-xs text-muted-foreground">Choose the sales regions covered by this team.</p></div>
                                <div className="space-y-1 rounded-xl border p-2">{regions.map((region) => <label key={region.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/40"><Checkbox checked={createRegionIds.includes(region.id)} onCheckedChange={(checked) => setCreateRegionIds((current) => checked ? Array.from(new Set([...current, region.id])) : current.filter((id) => id !== region.id))} /><span className="flex-1 text-sm">{region.name}</span>{region.code && <span className="text-xs text-muted-foreground">{region.code}</span>}</label>)}</div>
                            </TabsContent>
                            <TabsContent value="members" className="m-0 space-y-4 p-5">
                                <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={createSearch} onChange={(event) => setCreateSearch(event.target.value)} placeholder="Search field executives..." className="pl-9" /></div>
                                <div className="space-y-1 rounded-xl border p-2">{availableCreateEmployees.length === 0 ? <p className="p-4 text-center text-xs text-muted-foreground">{createRegionIds.length === 0 ? 'Select a region before adding members.' : 'No available field executives cover the selected regions.'}</p> : availableCreateEmployees.map((employee) => <label key={employee.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/40"><Checkbox checked={createMemberIds.includes(employee.id)} onCheckedChange={(checked) => setCreateMemberIds((current) => checked ? Array.from(new Set([...current, employee.id])) : current.filter((id) => id !== employee.id))} /><Avatar className="h-8 w-8"><AvatarFallback className="text-[10px]">{`${employee.firstName?.[0] ?? ''}${employee.lastName?.[0] ?? ''}`.toUpperCase()}</AvatarFallback></Avatar><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{employeeName(employee)}</span><span className="block truncate text-xs text-muted-foreground">{displayRoleSentence(employee.role)}</span></span></label>)}</div>
                            </TabsContent>
                        </ScrollArea>
                        <div className="flex items-center justify-between border-t bg-card p-4">
                            <div className="text-xs text-muted-foreground">Step {createStepIndex + 1} of {createSteps.length}</div>
                            <div className="flex items-center gap-2">
                                {createStepIndex > 0 && (
                                    <Button variant="outline" onClick={() => setCreateTab(createSteps[createStepIndex - 1])} disabled={isSavingTeam}>
                                        <ChevronLeft className="mr-1 h-4 w-4" />Back
                                    </Button>
                                )}
                                {createStepIndex < createSteps.length - 1 ? (
                                    <Button
                                        onClick={() => setCreateTab(createSteps[createStepIndex + 1])}
                                        disabled={isSavingTeam || (createTab === 'details' && !teamFormIsValid) || (createTab === 'regions' && createRegionIds.length === 0)}
                                    >
                                        Next<ChevronRight className="ml-1 h-4 w-4" />
                                    </Button>
                                ) : (
                                    <Button onClick={() => void createTeam()} disabled={!teamFormIsValid || createRegionIds.length === 0 || isSavingTeam}>
                                        {isSavingTeam ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : 'Create team'}
                                    </Button>
                                )}
                            </div>
                        </div>
                    </Tabs>
                </SheetContent>
            </Sheet>

            <Sheet open={Boolean(editingTeam && isTeamDialogOpen)} onOpenChange={(open) => (open ? setIsTeamDialogOpen(true) : closeTeamDialog())}>
                <SheetContent className="flex w-full flex-col overflow-hidden p-0 sm:max-w-2xl">
                    <SheetHeader className="border-b bg-card px-5 py-4 text-left">
                        <div className="flex items-center gap-3 pr-8">
                            <Avatar className="h-11 w-11 border border-primary/15 bg-primary/10">
                                <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">{editingTeam?.teamCode?.slice(0, 2).toUpperCase() || 'TM'}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0"><SheetTitle>Edit team details</SheetTitle><SheetDescription className="truncate">{editingTeam?.teamCode || 'Team'} · Name and supervisor</SheetDescription></div>
                        </div>
                    </SheetHeader>
                    <ScrollArea className="min-h-0 flex-1">
                        <div className="space-y-6 p-5">
                            <div className="space-y-1.5"><Label htmlFor="team-name">Team name</Label><Input id="team-name" value={teamForm.teamName} onChange={(event) => setTeamForm((current) => ({ ...current, teamName: event.target.value }))} placeholder="Ahmedabad Sales Team" /></div>
                            <section className="space-y-2">
                                <div><h3 className="text-sm font-semibold">Supervisor</h3><p className="mt-1 text-xs text-muted-foreground">One supervisor owns this team’s reporting line.</p></div>
                                {availableEditSupervisors.map((supervisor) => {
                                    const selected = teamForm.officeManagerId === String(supervisor.id);
                                    return <button key={supervisor.id} type="button" onClick={() => setTeamForm((current) => ({ ...current, officeManagerId: String(supervisor.id) }))} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${selected ? 'border-primary bg-primary/5' : 'hover:bg-muted/30'}`}><span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${selected ? 'border-primary' : 'border-muted-foreground/50'}`}>{selected && <span className="h-2 w-2 rounded-full bg-primary" />}</span><Avatar className="h-9 w-9"><AvatarFallback className="text-xs">{`${supervisor.firstName?.[0] ?? ''}${supervisor.lastName?.[0] ?? ''}`.toUpperCase()}</AvatarFallback></Avatar><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{employeeName(supervisor)}</span><span className="block text-xs text-muted-foreground">Supervisor · {getEmployeeRegionLabel(supervisor)}</span></span></button>;
                                })}
                            </section>
                        </div>
                    </ScrollArea>
                    <div className="flex items-center justify-end gap-2 border-t bg-card p-4"><Button variant="outline" onClick={closeTeamDialog} disabled={isSavingTeam}>Cancel</Button><Button onClick={() => void saveTeam()} disabled={isSavingTeam || !teamFormIsValid || !teamFormIsDirty}>{isSavingTeam ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Save changes'}</Button></div>
                </SheetContent>
            </Sheet>

            <Sheet open={Boolean(managedTeam)} onOpenChange={(open) => {
                if (!open && membershipSavingId == null && !isSavingSupervisor && !isSavingRegions) {
                    setManagedTeamId(null);
                    setMemberSearch('');
                    setRegionSearch('');
                    setManageTab('overview');
                }
            }}>
                <SheetContent className="w-full overflow-hidden p-0 sm:max-w-2xl">
                    <SheetHeader className="border-b bg-card px-5 py-4 text-left">
                        <div className="flex items-center gap-3 pr-8">
                            <Avatar className="h-11 w-11 border border-primary/15 bg-primary/10">
                                <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                                    {managedTeam?.teamCode?.slice(0, 2).toUpperCase() || 'TM'}
                                </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                                <SheetTitle className="truncate">{managedTeam?.teamName ?? 'Manage team'}</SheetTitle>
                                <SheetDescription className="truncate">
                                    {managedTeam?.teamCode || 'Team'} · Manage reporting, coverage and members
                                </SheetDescription>
                            </div>
                        </div>
                    </SheetHeader>

                    <Tabs value={manageTab} onValueChange={setManageTab} className="flex h-[calc(100vh-78px)] flex-col">
                        <div className="border-b bg-muted/15 px-3 pt-2">
                            <TabsList className="grid h-10 w-full grid-cols-4 bg-transparent p-0">
                                {[
                                    ['overview', 'Overview'],
                                    ['supervisor', 'Supervisor'],
                                    ['regions', 'Regions'],
                                    ['members', 'Members'],
                                ].map(([value, label]) => (
                                    <TabsTrigger key={value} value={value} className="h-9 rounded-md text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
                                        {label}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </div>

                        <ScrollArea className="min-h-0 flex-1">
                            <TabsContent value="overview" className="m-0 space-y-5 p-5">
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="rounded-xl border bg-card p-4"><p className="text-[11px] font-medium capitalize tracking-wide text-muted-foreground">Supervisor</p><p className="mt-2 text-2xl font-semibold">{managedManager ? 1 : 0}</p></div>
                                    <div className="rounded-xl border bg-card p-4"><p className="text-[11px] font-medium capitalize tracking-wide text-muted-foreground">Regions</p><p className="mt-2 text-2xl font-semibold">{managedRegionIds.length}</p></div>
                                    <div className="rounded-xl border bg-card p-4"><p className="text-[11px] font-medium capitalize tracking-wide text-muted-foreground">Members</p><p className="mt-2 text-2xl font-semibold">{managedTeam?.employees.length ?? 0}</p></div>
                                </div>

                                <section className="space-y-2">
                                    <p className="text-xs font-semibold capitalize tracking-wider text-muted-foreground">Team operations</p>
                                    <button type="button" onClick={() => setManageTab('supervisor')} className="flex w-full items-center justify-between rounded-xl border bg-card p-4 text-left transition-colors hover:bg-muted/30">
                                        <span><span className="block text-sm font-semibold">Manage supervisor</span><span className="mt-0.5 block text-xs text-muted-foreground">Set the team’s reporting lead</span></span><ShieldCheck className="h-5 w-5 text-primary" />
                                    </button>
                                    <button type="button" onClick={() => setManageTab('regions')} className="flex w-full items-center justify-between rounded-xl border bg-card p-4 text-left transition-colors hover:bg-muted/30">
                                        <span><span className="block text-sm font-semibold">Manage region coverage</span><span className="mt-0.5 block text-xs text-muted-foreground">Define the team’s sales regions</span></span><MapPin className="h-5 w-5 text-primary" />
                                    </button>
                                    <button type="button" onClick={() => setManageTab('members')} className="flex w-full items-center justify-between rounded-xl border bg-card p-4 text-left transition-colors hover:bg-muted/30">
                                        <span><span className="block text-sm font-semibold">Manage field executives</span><span className="mt-0.5 block text-xs text-muted-foreground">Add, move or remove team members</span></span><UserPlus className="h-5 w-5 text-primary" />
                                    </button>
                                </section>

                                {Object.keys(memberRoleCounts).length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {Object.entries(memberRoleCounts).map(([role, count]) => <Badge key={role} variant="secondary">{role}: {count}</Badge>)}
                                    </div>
                                )}

                                <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                                    <p className="text-sm font-semibold text-destructive">Delete team</p>
                                    <p className="mt-1 text-xs text-muted-foreground">Employees remain in the directory and become unassigned.</p>
                                    <Button variant="destructive" size="sm" className="mt-4" onClick={() => setDeleteTeamOpen(true)}><Trash2 className="mr-2 h-4 w-4" />Delete team</Button>
                                </section>
                            </TabsContent>

                            <TabsContent value="supervisor" className="m-0 space-y-4 p-5">
                                <div>
                                    <h3 className="text-sm font-semibold">Supervisor assignment</h3>
                                    <p className="mt-1 text-xs text-muted-foreground">One zonal supervisor owns the team’s reporting line.</p>
                                </div>
                                <div className="space-y-2">
                                    {availableManagedSupervisors.map((manager) => {
                                        const selected = manager.id === managedTeam?.officeManagerId;
                                        return (
                                            <button key={manager.id} type="button" disabled={isSavingSupervisor} onClick={() => void saveSupervisor(manager.id)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${selected ? 'border-primary bg-primary/5' : 'hover:bg-muted/30'}`}>
                                                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${selected ? 'border-primary' : 'border-muted-foreground/50'}`}>{selected && <span className="h-2 w-2 rounded-full bg-primary" />}</span>
                                                <Avatar className="h-9 w-9"><AvatarFallback className="text-xs">{`${manager.firstName?.[0] ?? ''}${manager.lastName?.[0] ?? ''}`.toUpperCase()}</AvatarFallback></Avatar>
                                                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{employeeName(manager)}</span><span className="block text-xs text-muted-foreground">Supervisor · {getEmployeeRegionLabel(manager)}</span></span>
                                                {isSavingSupervisor && !selected && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </TabsContent>

                            <TabsContent value="regions" className="m-0 space-y-5 p-5">
                                <div>
                                    <h3 className="text-sm font-semibold">Region coverage</h3>
                                    <p className="mt-1 text-xs text-muted-foreground">Select the sales regions this team is responsible for.</p>
                                </div>
                                {managedRegionIds.length > 0 && <div className="flex flex-wrap gap-2">{managedRegionIds.map((id) => { const region = regions.find((item) => item.id === id); return <Badge key={id} variant="secondary" className="gap-1.5 py-1.5">{region?.name ?? `Region ${id}`}<button type="button" aria-label={`Remove ${region?.name ?? 'region'}`} onClick={() => managedTeam && setTeamRegionIds((current) => ({ ...current, [managedTeam.id]: current[managedTeam.id].filter((regionId) => regionId !== id) }))}><X className="h-3 w-3" /></button></Badge>; })}</div>}
                                <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={regionSearch} onChange={(event) => setRegionSearch(event.target.value)} placeholder="Search regions..." className="pl-9" /></div>
                                <div className="max-h-80 space-y-1 overflow-y-auto rounded-xl border p-2">
                                    {filteredRegions.map((region) => {
                                        const selected = managedRegionIds.includes(region.id);
                                        return <label key={region.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/40"><Checkbox checked={selected} onCheckedChange={(checked) => managedTeam && setTeamRegionIds((current) => ({ ...current, [managedTeam.id]: checked ? Array.from(new Set([...(current[managedTeam.id] ?? []), region.id])) : (current[managedTeam.id] ?? []).filter((id) => id !== region.id) }))} /><span className="flex-1 text-sm">{region.name}</span>{region.code && <span className="text-xs text-muted-foreground">{region.code}</span>}</label>;
                                    })}
                                </div>
                                <Button className="w-full" onClick={() => void saveRegions()} disabled={isSavingRegions}>{isSavingRegions && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save region coverage</Button>
                            </TabsContent>

                            <TabsContent value="members" className="m-0 space-y-5 p-5">
                                <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder="Search field executives..." className="pl-9" /></div>
                                <section>
                                    <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Team members</h3><Badge variant="secondary">{visibleMembers.length}</Badge></div>
                                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                        {visibleMembers.length === 0 ? <p className="col-span-full rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">No members found.</p> : visibleMembers.map((employee) => (
                                            <div key={employee.id} className="flex items-center gap-3 rounded-xl border bg-card p-3"><Avatar className="h-8 w-8"><AvatarFallback className="text-[10px]">{`${employee.firstName?.[0] ?? ''}${employee.lastName?.[0] ?? ''}`.toUpperCase()}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{employeeName(employee)}</p><p className="truncate text-xs text-muted-foreground">{displayRoleSentence(employee.role)}</p></div><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" aria-label={`Remove ${employeeName(employee)}`} onClick={() => setMemberToRemove(employee)}><X className="h-4 w-4" /></Button></div>
                                        ))}
                                    </div>
                                </section>
                                <section>
                                    <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Available field executives</h3><Badge variant="secondary">{availableEmployees.length}</Badge></div>
                                    <div className="mt-2 space-y-2">
                                        {availableEmployees.length === 0 ? <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">{managedRegionIds.length === 0 ? 'Assign a region before adding members.' : 'No available field executives cover this team’s regions.'}</p> : availableEmployees.map((employee) => (
                                            <div key={employee.id} className="flex items-center justify-between gap-3 rounded-xl border p-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{employeeName(employee)}</p><p className="text-xs text-muted-foreground">{displayRoleSentence(employee.role)}</p></div><Button size="sm" className="h-8" onClick={() => managedTeam && void updateMembership(employee, managedTeam.id)} disabled={membershipSavingId != null}>{membershipSavingId === employee.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><UserPlus className="mr-2 h-4 w-4" />Add</>}</Button></div>
                                        ))}
                                    </div>
                                </section>
                            </TabsContent>
                        </ScrollArea>
                    </Tabs>
                </SheetContent>
            </Sheet>

            <Dialog open={Boolean(memberToRemove)} onOpenChange={(open) => {
                if (!open && membershipSavingId == null) setMemberToRemove(null);
            }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Remove employee from team?</DialogTitle>
                        <DialogDescription>
                            {memberToRemove ? `${employeeName(memberToRemove)} will become unassigned.` : 'This employee will become unassigned.'}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setMemberToRemove(null)} disabled={membershipSavingId != null}>Cancel</Button>
                        <Button
                            variant="destructive"
                            onClick={() => memberToRemove && void removeMember(memberToRemove)}
                            disabled={!memberToRemove || membershipSavingId != null}
                        >
                            {membershipSavingId != null ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Removing...</> : 'Remove employee'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={deleteTeamOpen} onOpenChange={(open) => !isDeletingTeam && setDeleteTeamOpen(open)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Delete {managedTeam?.teamName ?? 'team'}?</DialogTitle>
                        <DialogDescription>Team members will remain in the employee directory and become unassigned.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteTeamOpen(false)} disabled={isDeletingTeam}>Cancel</Button>
                        <Button variant="destructive" onClick={() => void deleteManagedTeam()} disabled={isDeletingTeam}>{isDeletingTeam ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Deleting...</> : 'Delete team'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Teams;
