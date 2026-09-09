"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { useUnsavedChanges } from '@/components/unsaved-changes-provider';
import AddTeam from '@/components/AddTeam';
import { getEmployeeRoleCategory, getEmployeeRoleLabel } from '@/lib/employee-role';
import { CrmTeam, TeamEmployee, teamsApi } from '@/lib/teams-api';
import { Loader2, MapPin, Pencil, Search, UserMinus, UserPlus, Users, X } from 'lucide-react';
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

const employeeName = (employee: Pick<TeamEmployee, 'id' | 'firstName' | 'lastName'>) =>
    `${employee.firstName} ${employee.lastName}`.trim() || `Employee ${employee.id}`;

const Teams: React.FC = () => {
    const { token } = useAuth();
    const [teams, setTeams] = useState<CrmTeam[]>([]);
    const [employees, setEmployees] = useState<TeamEmployee[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isTeamDialogOpen, setIsTeamDialogOpen] = useState(false);
    const [editingTeamId, setEditingTeamId] = useState<number | null>(null);
    const [teamForm, setTeamForm] = useState<TeamFormState>(emptyTeamForm);
    const [isSavingTeam, setIsSavingTeam] = useState(false);
    const [managedTeamId, setManagedTeamId] = useState<number | null>(null);
    const [memberSearch, setMemberSearch] = useState('');
    const [membershipSavingId, setMembershipSavingId] = useState<number | null>(null);
    const [memberToRemove, setMemberToRemove] = useState<TeamEmployee | null>(null);

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
        teamForm.teamCode.trim() &&
        Number.isInteger(Number(teamForm.officeManagerId)) &&
        Number(teamForm.officeManagerId) > 0,
    );
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

    const loadTeams = useCallback(async (showLoading = true) => {
        if (!token) {
            setError('Authentication token not found. Please log in.');
            setIsLoading(false);
            return;
        }

        if (showLoading) setIsLoading(true);
        setError(null);
        try {
            const [employeeDirectory, teamRows] = await Promise.all([
                teamsApi.getEmployees(token),
                teamsApi.getTeams(token),
            ]);
            setEmployees(employeeDirectory);
            setTeams(teamRows.sort((a, b) => a.teamName.localeCompare(b.teamName)));
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Could not load teams.');
        } finally {
            if (showLoading) setIsLoading(false);
        }
    }, [token]);

    useEffect(() => {
        void loadTeams();
    }, [loadTeams]);

    const getManagerName = useCallback((team: CrmTeam): string => {
        const manager = employees.find((employee) => employee.id === team.officeManagerId);
        return manager ? employeeName(manager) : team.officeManagerName || 'No office manager assigned';
    }, [employees]);

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
        setIsTeamDialogOpen(true);
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
        if (!token || !teamFormIsValid) return;
        setIsSavingTeam(true);
        setError(null);
        try {
            const input = {
                teamName: teamForm.teamName.trim(),
                teamCode: teamForm.teamCode.trim().toUpperCase(),
                officeManagerId: Number(teamForm.officeManagerId),
            };
            if (editingTeamId) {
                await teamsApi.updateTeam(token, editingTeamId, input);
            } else {
                await teamsApi.createTeam(token, input);
            }
            setIsTeamDialogOpen(false);
            setEditingTeamId(null);
            setTeamForm(emptyTeamForm);
            await loadTeams(false);
            toast.success(editingTeamId ? 'Team updated' : 'Team created', { duration: 3000 });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Could not save the team.';
            setError(message);
            toast.error(message, { duration: 3000 });
        } finally {
            setIsSavingTeam(false);
        }
    };

    const availableEmployees = useMemo(() => {
        if (!managedTeam) return [];
        const query = memberSearch.trim().toLowerCase();
        return employees
            .filter((employee) => (
                employee.active &&
                getEmployeeRoleCategory(employee.role) === 'field-officer' &&
                employee.teamId == null
            ))
            .filter((employee) => !query || employeeName(employee).toLowerCase().includes(query))
            .sort((a, b) => employeeName(a).localeCompare(employeeName(b)));
    }, [employees, managedTeam, memberSearch]);

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
            await teamsApi.updateEmployeeTeam(token, employee, teamId);
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
                <AddTeam onClick={openCreateDialog} disabled={isLoading || managers.length === 0} />
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
                        const coverage = Array.from(new Set(
                            [manager?.city, ...officers.map((employee) => employee.city)].filter((city): city is string => Boolean(city)),
                        ));
                        const initials = manager
                            ? (`${manager.firstName?.[0] ?? ''}${manager.lastName?.[0] ?? ''}`.trim() || String(manager.id).slice(-2)).toUpperCase()
                            : 'TM';

                        return (
                            <Card key={team.id} className="overflow-hidden border-border/70 py-0 shadow-none transition-colors hover:border-border">
                                <CardContent className="grid min-h-44 gap-3 p-4 lg:grid-cols-[minmax(240px,1.05fr)_minmax(190px,.75fr)_minmax(280px,1.45fr)_150px]">
                                    <section className="flex min-w-0 flex-col justify-between p-2">
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                                Team #{team.id}
                                            </p>
                                            <span className="text-[11px] text-muted-foreground">{team.officeManagerId ? '1 regional manager' : 'No manager'}</span>
                                        </div>
                                        <div className="mt-6 flex items-center gap-3">
                                            <Avatar className="h-10 w-10 border bg-background">
                                                <AvatarFallback className="text-xs font-semibold">{initials}</AvatarFallback>
                                            </Avatar>
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-semibold">{getManagerName(team)}</p>
                                                <p className="text-xs text-muted-foreground">Regional Manager</p>
                                            </div>
                                        </div>
                                    </section>

                                    <section className="rounded-lg bg-muted/35 p-4">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Coverage</p>
                                        {coverage.length ? (
                                            <div className="mt-4 flex flex-wrap gap-2">
                                                {coverage.slice(0, 3).map((city) => (
                                                    <Badge key={city} variant="secondary" className="gap-1.5 font-normal">
                                                        <MapPin className="h-3 w-3" />{city}
                                                    </Badge>
                                                ))}
                                                {coverage.length > 3 && <Badge variant="outline" className="font-normal">+{coverage.length - 3} more</Badge>}
                                            </div>
                                        ) : <p className="mt-4 text-sm text-muted-foreground">No coverage data</p>}
                                    </section>

                                    <section className="rounded-lg bg-muted/35 p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Roster</p>
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
                                            onClick={() => {
                                                setManagedTeamId(team.id);
                                                setMemberSearch('');
                                            }}
                                        >
                                            Manage Team
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

            <Dialog open={isTeamDialogOpen} onOpenChange={(open) => (open ? setIsTeamDialogOpen(true) : closeTeamDialog())}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editingTeam ? 'Edit team' : 'Create team'}</DialogTitle>
                        <DialogDescription>
                            Set the team identity and its single office manager.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="team-name">Team name</Label>
                            <Input
                                id="team-name"
                                value={teamForm.teamName}
                                onChange={(event) => setTeamForm((current) => ({ ...current, teamName: event.target.value }))}
                                placeholder="Metro North Team"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="team-code">Team code</Label>
                            <Input
                                id="team-code"
                                value={teamForm.teamCode}
                                onChange={(event) => setTeamForm((current) => ({ ...current, teamCode: event.target.value.toUpperCase() }))}
                                placeholder="METRO-NORTH"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="team-manager">Office manager</Label>
                            <Select
                                value={teamForm.officeManagerId}
                                onValueChange={(officeManagerId) => setTeamForm((current) => ({ ...current, officeManagerId }))}
                            >
                                <SelectTrigger id="team-manager"><SelectValue placeholder="Select a manager" /></SelectTrigger>
                                <SelectContent>
                                    {managers.map((manager) => (
                                        <SelectItem key={manager.id} value={String(manager.id)}>{employeeName(manager)}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={closeTeamDialog} disabled={isSavingTeam}>Cancel</Button>
                        <Button onClick={() => void saveTeam()} disabled={isSavingTeam || !teamFormIsValid || !teamFormIsDirty}>
                            {isSavingTeam ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : editingTeam ? 'Save changes' : 'Create team'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Sheet open={Boolean(managedTeam)} onOpenChange={(open) => {
                if (!open && membershipSavingId == null) {
                    setManagedTeamId(null);
                    setMemberSearch('');
                }
            }}>
                <SheetContent className="w-full p-0 sm:max-w-xl">
                    <SheetHeader className="border-b p-5 text-left">
                        <SheetTitle>{managedTeam?.teamName ?? 'Manage employees'}</SheetTitle>
                        <SheetDescription>Add unassigned field employees or remove current members.</SheetDescription>
                    </SheetHeader>
                    <div className="border-b p-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder="Search employees..." className="pl-9" />
                        </div>
                    </div>
                    <ScrollArea className="h-[calc(100vh-170px)]">
                        <div className="space-y-6 p-4">
                            <section>
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-semibold">Current employees</h3>
                                    <Badge variant="secondary">{visibleMembers.length}</Badge>
                                </div>
                                <div className="mt-2 space-y-2">
                                    {visibleMembers.length === 0 ? (
                                        <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">No current employees match.</p>
                                    ) : visibleMembers.map((employee) => (
                                        <div key={employee.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-medium">{employeeName(employee)}</p>
                                                <p className="text-xs text-muted-foreground">{getEmployeeRoleLabel(employee.role)}</p>
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8 shrink-0 text-destructive"
                                                onClick={() => setMemberToRemove(employee)}
                                                disabled={membershipSavingId != null}
                                            >
                                                <UserMinus className="mr-2 h-4 w-4" />Remove
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <section>
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-semibold">Available employees</h3>
                                    <Badge variant="secondary">{availableEmployees.length}</Badge>
                                </div>
                                <div className="mt-2 space-y-2">
                                    {availableEmployees.length === 0 ? (
                                        <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">No unassigned field employees match.</p>
                                    ) : availableEmployees.map((employee) => (
                                        <div key={employee.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-medium">{employeeName(employee)}</p>
                                                <p className="text-xs text-muted-foreground">{getEmployeeRoleLabel(employee.role)}</p>
                                            </div>
                                            <Button
                                                size="sm"
                                                className="h-8 shrink-0"
                                                onClick={() => managedTeam && void updateMembership(employee, managedTeam.id)}
                                                disabled={membershipSavingId != null}
                                            >
                                                {membershipSavingId === employee.id
                                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                                    : <><UserPlus className="mr-2 h-4 w-4" />Add</>}
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </div>
                    </ScrollArea>
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
                            onClick={() => memberToRemove && void updateMembership(memberToRemove, null)}
                            disabled={!memberToRemove || membershipSavingId != null}
                        >
                            {membershipSavingId != null ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Removing...</> : 'Remove employee'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Teams;
