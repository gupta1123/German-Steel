"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from "@/components/ui/badge";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
    UserPlus, 
    MapPin, 
    X, 
    Trash2, 
    Users, 
    User, 
    Building2,
    Loader2,
    Plus,
    Search,
    ChevronDown
} from 'lucide-react';
import { buildCityOptions, mergeCityOptions, normalizeCityKey } from '@/lib/city-options';
import { getPrimaryTeamManager, getTeamAssignedCities, getTeamManagers } from '@/lib/team-access';
import { API } from '@/lib/api';
import { useUnsavedChanges } from '@/components/unsaved-changes-provider';

interface Team {
    id: number;
    office?: TeamManager | null;
    officeManager?: TeamManager | null;
    officeManagers?: TeamManager[] | null;
    fieldOfficers: FieldOfficer[];
}

interface TeamManager {
    id: number;
    firstName: string | null;
    lastName: string | null;
    assignedCity?: string[] | null;
    role?: string | null;
    city?: string | null;
    email?: string | null;
    deleted?: boolean;
    isOfficeManager?: boolean;
}

interface FieldOfficer {
    id: number;
    firstName: string;
    lastName: string;
    role: string;
    status: string;
    teamId?: number | null;
}

const Teams: React.FC = () => {
    const [teams, setTeams] = useState<Team[]>([]);
    const [isDataAvailable, setIsDataAvailable] = useState<boolean>(true);
    const [isDeleteModalVisible, setIsDeleteModalVisible] = useState<boolean>(false);
    const [deleteTeamId, setDeleteTeamId] = useState<number | null>(null);
    const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
    const [selectedOfficeManagerId, setSelectedOfficeManagerId] = useState<number | null>(null);
    const [isEditModalVisible, setIsEditModalVisible] = useState<boolean>(false);
    const [isCityRemoveModalVisible, setIsCityRemoveModalVisible] = useState<boolean>(false);
    const [fieldOfficers, setFieldOfficers] = useState<FieldOfficer[]>([]);
    const [selectedFieldOfficers, setSelectedFieldOfficers] = useState<number[]>([]);
    const [assignedCities, setAssignedCities] = useState<string[]>([]);
    const [cityToRemove, setCityToRemove] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState<{ [key: number]: number }>({});
    const [availableCities, setAvailableCities] = useState<{ value: string; label: string }[]>([]);
    const [selectedCities, setSelectedCities] = useState<string[]>([]);
    const [isCityPopoverOpen, setIsCityPopoverOpen] = useState(false);
    const [citySearchTerm, setCitySearchTerm] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isViewAllModalVisible, setIsViewAllModalVisible] = useState<boolean>(false);
    const [viewAllTeamId, setViewAllTeamId] = useState<number | null>(null);
    const [officersSearch, setOfficersSearch] = useState<string>('');
    const [isRemoveOfficerModalVisible, setIsRemoveOfficerModalVisible] = useState<boolean>(false);
    const [officerToRemove, setOfficerToRemove] = useState<{ teamId: number; officerId: number; name: string } | null>(null);
    const [modalError, setModalError] = useState<string | null>(null);
    const [isManageCitiesModalVisible, setIsManageCitiesModalVisible] = useState<boolean>(false);
    const [currentTeamId, setCurrentTeamId] = useState<number | null>(null);
    const [isManagersModalVisible, setIsManagersModalVisible] = useState<boolean>(false);
    const [allOfficeManagers, setAllOfficeManagers] = useState<TeamManager[]>([]);
    const [selectedManagerIds, setSelectedManagerIds] = useState<number[]>([]);
    const [managerSearchTerm, setManagerSearchTerm] = useState("");
    const [isLoadingManagers, setIsLoadingManagers] = useState(false);

    const managerBaselineIds = useMemo(() => {
        const team = teams.find((item) => item.id === selectedTeamId);
        return team ? getTeamManagers(team).map((manager) => manager.id).sort((a, b) => a - b) : [];
    }, [selectedTeamId, teams]);
    const managerDraftIds = useMemo(
        () => [...selectedManagerIds].sort((a, b) => a - b),
        [selectedManagerIds]
    );
    const managerChangesAreDirty = isManagersModalVisible && JSON.stringify(managerDraftIds) !== JSON.stringify(managerBaselineIds);
    const cityChangesAreDirty = isManageCitiesModalVisible && selectedCities.length > 0;
    const fieldOfficerChangesAreDirty = isEditModalVisible && selectedFieldOfficers.length > 0;
    const teamChangesAreDirty = managerChangesAreDirty || cityChangesAreDirty || fieldOfficerChangesAreDirty;
    const { requestDiscard } = useUnsavedChanges(teamChangesAreDirty);

    // Get auth data from localStorage instead of props
    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;

    const sortByNameAsc = (a: { firstName?: string | null; lastName?: string | null }, b: { firstName?: string | null; lastName?: string | null }) => {
        const nameA = `${a.firstName ?? ''} ${a.lastName ?? ''}`.trim().toLowerCase();
        const nameB = `${b.firstName ?? ''} ${b.lastName ?? ''}`.trim().toLowerCase();
        return nameA.localeCompare(nameB);
    };

    const getManagerName = (manager: { id: number; firstName?: string | null; lastName?: string | null }) => {
        return [manager.firstName, manager.lastName].filter(Boolean).join(' ').trim() || `Manager ${manager.id}`;
    };

    const fetchTeams = useCallback(async () => {
        if (!token) {
            setError('Authentication token not found. Please log in.');
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch('http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/employee/team/getAll', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch teams: ${response.statusText}`);
            }

            const data = await response.json();

            // Ensure both teams and their officers are sorted by name ASC
            const sortedTeams: Team[] = (data as Team[])
                .map((team) => ({
                    ...team,
                    fieldOfficers: [...(team.fieldOfficers ?? [])].sort((a, b) => sortByNameAsc(a, b)),
                }))
                .sort((a, b) => sortByNameAsc(getPrimaryTeamManager(a) ?? { firstName: '', lastName: '' }, getPrimaryTeamManager(b) ?? { firstName: '', lastName: '' }));

            setTeams(sortedTeams);
            setAvailableCities((prev) =>
                mergeCityOptions(
                    prev,
                    buildCityOptions(sortedTeams.flatMap((team) => getTeamAssignedCities(team)))
                )
            );
            setIsDataAvailable(sortedTeams.length > 0);
        } catch (error) {
            setError(error instanceof Error ? error.message : 'An unknown error occurred');
            setIsDataAvailable(false);
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    const fetchCities = useCallback(async () => {
        if (!token) return;

        try {
            const response = await fetch("http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/employee/getCities", {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                throw new Error('Failed to fetch cities');
            }

            const data = await response.json();
            setAvailableCities((prev) => mergeCityOptions(prev, buildCityOptions(data)));
        } catch (error) {
            console.error('Error fetching cities:', error);
        }
    }, [token]);

    const fetchOfficeManagers = useCallback(async (editingTeamId?: number | null) => {
        if (!token) return;

        setIsLoadingManagers(true);
        try {
            const [employeesData, teamsResponse] = await Promise.all([
                API.getAllEmployees<TeamManager>(),
                fetch('http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/employee/team/getAll', {
                    headers: { Authorization: `Bearer ${token}` },
                }),
            ]);

            if (!teamsResponse.ok) {
                throw new Error('Failed to fetch team assignments');
            }

            const teamsData = (await teamsResponse.json()) as Team[];
            const currentTeam = teamsData.find((team) => team.id === editingTeamId);
            const currentManagerIds = new Set(getTeamManagers(currentTeam ?? { id: 0 }).map((manager) => manager.id));
            const assignedElsewhereIds = new Set(
                teamsData
                    .filter((team) => team.id !== editingTeamId)
                    .flatMap((team) => getTeamManagers(team).map((manager) => manager.id))
            );

            const managers = employeesData
                .filter((employee) => {
                    if (employee.isOfficeManager !== true || employee.deleted) return false;
                    return currentManagerIds.has(employee.id) || !assignedElsewhereIds.has(employee.id);
                })
                .sort(sortByNameAsc);

            setAllOfficeManagers(managers);
        } catch (error) {
            console.error('Error fetching managers:', error);
            setModalError(error instanceof Error ? error.message : 'Error fetching managers');
        } finally {
            setIsLoadingManagers(false);
        }
    }, [token]);

    const fetchFieldOfficersByCities = async (cities: string[], teamId: number) => {
        if (!token) return;

        try {
            const promises = cities.map(city =>
                fetch(`http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/employee/getFieldOfficerByCity?city=${encodeURIComponent(city)}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                })
            );
            const responses = await Promise.all(promises);
            const allData = await Promise.all(responses.map(r => r.json()));
            const allFieldOfficers: FieldOfficer[] = allData.flat().sort((a: FieldOfficer, b: FieldOfficer) => {
                const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
                const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
                return nameA.localeCompare(nameB);
            });
            const currentTeam = teams.find(team => team.id === teamId);
            const currentTeamMemberIds = currentTeam ? currentTeam.fieldOfficers.map(officer => officer.id) : [];
            // Show already-assigned officers, but keep them disabled in the picker.
            const availableFieldOfficers = allFieldOfficers.filter((officer: FieldOfficer) => 
                officer.status !== 'inactive' && !currentTeamMemberIds.includes(officer.id)
            );
            setFieldOfficers(availableFieldOfficers);
        } catch (error) {
            console.error('Error fetching field officers:', error);
        }
    };

    useEffect(() => {
        if (token) {
            fetchTeams();
        }
    }, [fetchTeams]);

    const showDeleteModal = (teamId: number) => {
        setError(null); // Clear any background errors when opening modal
        setDeleteTeamId(teamId);
        setIsDeleteModalVisible(true);
    };

    const handleDeleteTeam = async () => {
        if (!deleteTeamId || !token) return;

        setIsSaving(true);
        try {
            const response = await fetch(`http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/employee/team/delete?id=${deleteTeamId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                throw new Error('Failed to delete team');
            }

            await fetchTeams();
            setIsDeleteModalVisible(false);
        } catch (error) {
            console.error('Error deleting team:', error);
            setError(error instanceof Error ? error.message : 'Error deleting team');
        } finally {
            setIsSaving(false);
        }
    };

    const showEditModal = (team: Team) => {
        setError(null); // Clear any background errors when opening modal
        setModalError(null); // Clear any previous modal errors
        const primaryManager = getPrimaryTeamManager(team);
        const teamCities = getTeamAssignedCities(team);
        setSelectedTeamId(team.id);
        setSelectedOfficeManagerId(primaryManager?.id ?? null);
        setAssignedCities(teamCities);
        fetchCities();
        fetchFieldOfficersByCities(teamCities, team.id);
        setIsEditModalVisible(true);
    };

    const showManageCitiesModal = (team: Team) => {
        setError(null); // Clear any background errors when opening modal
        setModalError(null); // Clear any previous modal errors
        const primaryManager = getPrimaryTeamManager(team);
        setSelectedOfficeManagerId(primaryManager?.id ?? null);
        setAssignedCities(primaryManager?.assignedCity ?? []);
        setCurrentTeamId(team.id); // Track current team ID to exclude its cities from "other teams"
        setSelectedCities([]);
        setCitySearchTerm('');
        setIsCityPopoverOpen(false);
        fetchCities();
        setIsManageCitiesModalVisible(true);
    };

    const showManagersModal = async (team: Team) => {
        setError(null);
        setModalError(null);
        setSelectedTeamId(team.id);
        setCurrentTeamId(team.id);
        setSelectedManagerIds(getTeamManagers(team).map((manager) => manager.id));
        setManagerSearchTerm('');
        setIsManagersModalVisible(true);
        await fetchOfficeManagers(team.id);
    };

    const handleRemoveCity = (city: string) => {
        setError(null); // Clear any background errors when opening modal
        setModalError(null); // Clear any previous modal errors
        setCityToRemove(city);
        setIsCityRemoveModalVisible(true);
    };

    const confirmRemoveCity = async () => {
        if (!cityToRemove || !selectedOfficeManagerId || !token) return;

        setIsSaving(true);
        setModalError(null); // Clear previous errors
        try {
            const response = await fetch(
                `http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/employee/removeAssignedCity?employeeId=${selectedOfficeManagerId}&city=${encodeURIComponent(cityToRemove.toLowerCase())}`,
                {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Failed to remove city');
                throw new Error(errorText || 'Failed to remove city');
            }

            // Update local state optimistically
            setAssignedCities(prev => prev.filter(c => c !== cityToRemove));
            
            // Reload teams data to reflect the change
            await fetchTeams();
            
            setIsCityRemoveModalVisible(false);
            setCityToRemove(null);
            setModalError(null);
        } catch (error) {
            console.error('Error removing city:', error);
            setModalError(error instanceof Error ? error.message : 'Error removing city');
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddFieldOfficer = async () => {
        if (!selectedTeamId || selectedFieldOfficers.length === 0 || !token) return;
        const unassignedSelectedFieldOfficers = selectedFieldOfficers.filter((id) =>
            fieldOfficers.some((officer) => officer.id === id && officer.teamId == null)
        );
        if (unassignedSelectedFieldOfficers.length === 0) return;

        setIsSaving(true);
        setModalError(null); // Clear previous errors
        try {
            const response = await fetch(
                `http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/employee/team/addFieldOfficer?id=${selectedTeamId}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        fieldOfficers: unassignedSelectedFieldOfficers,
                    }),
                }
            );

            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Failed to add field officers');
                throw new Error(errorText || 'Failed to add field officers');
            }

            await fetchTeams();
            setIsEditModalVisible(false);
            setSelectedFieldOfficers([]);
            setModalError(null);
        } catch (error) {
            console.error('Error adding field officer:', error);
            setModalError(error instanceof Error ? error.message : 'Error adding field officers');
        } finally {
            setIsSaving(false);
        }
    };

    const handleRemoveFieldOfficer = async (teamId: number, fieldOfficerId: number) => {
        if (!token) return;

        setIsSaving(true);
        try {
            const response = await fetch(`http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/employee/team/deleteFieldOfficer?id=${teamId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    fieldOfficers: [fieldOfficerId],
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to remove field officer');
            }

            await fetchTeams();
        } catch (error) {
            console.error('Error removing field officer:', error);
            setError(error instanceof Error ? error.message : 'Error removing field officer');
        } finally {
            setIsSaving(false);
        }
    };

    const showRemoveOfficerModal = (teamId: number, officer: FieldOfficer) => {
        const name = `${officer.firstName} ${officer.lastName}`.trim();
        setOfficerToRemove({ teamId, officerId: officer.id, name });
        setIsRemoveOfficerModalVisible(true);
    };

    const confirmRemoveFieldOfficer = async () => {
        if (!officerToRemove) return;
        await handleRemoveFieldOfficer(officerToRemove.teamId, officerToRemove.officerId);
        setIsRemoveOfficerModalVisible(false);
        setOfficerToRemove(null);
    };

    const toSentenceCase = (value: string | null | undefined) => {
        if (!value) return '';
        return value
            .toLowerCase()
            .split(' ')
            .filter(Boolean)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    const filteredCities = useMemo(() => {
        const query = citySearchTerm.trim().toLowerCase();
        let filtered = availableCities;
        
        // Filter by search query
        if (query) {
            filtered = filtered.filter((city) => city.label.toLowerCase().includes(query));
        }
        
        const assignedCityKeys = new Set(assignedCities.map(normalizeCityKey));
        filtered = filtered.filter((city) => !assignedCityKeys.has(normalizeCityKey(city.value)));
        
        return filtered;
    }, [availableCities, citySearchTerm, assignedCities]);

    const cityAssignments = useMemo(() => {
        const assignments = new Map<string, string[]>();

        teams.forEach((team) => {
            getTeamManagers(team).forEach((manager) => {
                const managerName = getManagerName(manager);
                (manager.assignedCity ?? []).forEach((city) => {
                    const key = city.trim().toLowerCase();
                    if (!key) return;
                    assignments.set(key, Array.from(new Set([...(assignments.get(key) ?? []), managerName])));
                });
            });
        });

        return assignments;
    }, [teams]);

    const cityTriggerLabel = useMemo(() => {
        if (selectedCities.length === 0) return "Select cities";
        if (selectedCities.length === 1) return toSentenceCase(selectedCities[0]);
        return `${selectedCities.length} cities selected`;
    }, [selectedCities]);

    const handleToggleCity = (cityValue: string) => {
        setSelectedCities((prev) =>
            prev.includes(cityValue)
                ? prev.filter((value) => value !== cityValue)
                : [...prev, cityValue]
        );
        // Close the popover after selection/deselection for better UX
        setIsCityPopoverOpen(false);
    };

    const handleAssignCity = async () => {
        if (selectedCities.length === 0 || !selectedOfficeManagerId || !token) return;

        setIsSaving(true);
        setModalError(null); // Clear previous errors
        try {
            // Assign all selected cities
            const promises = selectedCities.map(city =>
                fetch(
                    `http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/employee/assignCity?id=${selectedOfficeManagerId}&city=${city}`,
                    {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json',
                        },
                    }
                )
            );

            const responses = await Promise.all(promises);
            const failedResponses = responses.filter(r => !r.ok);
            
            if (failedResponses.length > 0) {
                const errorText = await failedResponses[0].text().catch(() => 'Failed to assign city');
                throw new Error(errorText || 'Failed to assign city');
            }

            // Update local state optimistically
            const updatedCities = [...assignedCities, ...selectedCities];
            setAssignedCities(updatedCities);
            
            // Reload teams data to reflect the change
            await fetchTeams();
            
            setSelectedCities([]);
            setCitySearchTerm('');
            setModalError(null);
            
            // Close the modal after successful assignment
            setIsManageCitiesModalVisible(false);
            setCurrentTeamId(null);
        } catch (error) {
            console.error('Error assigning city:', error);
            setModalError(error instanceof Error ? error.message : 'Error assigning city');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveManagers = async () => {
        if (!selectedTeamId || !token) return;

        const selectedTeam = teams.find((team) => team.id === selectedTeamId);
        const existingManagerIds = selectedTeam ? getTeamManagers(selectedTeam).map((manager) => manager.id) : [];
        // This endpoint replaces the manager list, so adding one manager must keep the existing managers too.
        const managerIdsForPayload = Array.from(new Set([...existingManagerIds, ...selectedManagerIds]));

        if (managerIdsForPayload.length === 0) return;

        setIsSaving(true);
        setModalError(null);
        try {
            const response = await fetch(
                `http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/employee/team/editOfficeManager?id=${selectedTeamId}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        officeManagers: managerIdsForPayload,
                    }),
                }
            );

            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Failed to update managers');
                throw new Error(errorText || 'Failed to update managers');
            }

            await fetchTeams();
            setIsManagersModalVisible(false);
            setSelectedManagerIds([]);
            setManagerSearchTerm('');
            setModalError(null);
        } catch (error) {
            console.error('Error updating managers:', error);
            setModalError(error instanceof Error ? error.message : 'Error updating managers');
        } finally {
            setIsSaving(false);
        }
    };

    const closeManagersModal = () => {
        requestDiscard(() => {
            setIsManagersModalVisible(false);
            setModalError(null);
            setSelectedManagerIds([]);
            setManagerSearchTerm('');
            setCurrentTeamId(null);
        }, managerChangesAreDirty);
    };

    const closeManageCitiesModal = () => {
        requestDiscard(() => {
            setIsManageCitiesModalVisible(false);
            setError(null);
            setModalError(null);
            setSelectedCities([]);
            setCitySearchTerm('');
            setIsCityPopoverOpen(false);
            setCurrentTeamId(null);
        }, cityChangesAreDirty);
    };

    const closeEditModal = () => {
        requestDiscard(() => {
            setIsEditModalVisible(false);
            setError(null);
            setModalError(null);
            setSelectedFieldOfficers([]);
        }, fieldOfficerChangesAreDirty);
    };

    const currentTeamManagers = useMemo(() => {
        const team = teams.find((item) => item.id === currentTeamId);
        return team ? getTeamManagers(team).sort(sortByNameAsc) : [];
    }, [teams, currentTeamId]);

    const filteredOfficeManagers = useMemo(() => {
        const query = managerSearchTerm.trim().toLowerCase();
        if (!query) return allOfficeManagers;
        return allOfficeManagers.filter((manager) =>
            getManagerName(manager).toLowerCase().includes(query)
        );
    }, [allOfficeManagers, managerSearchTerm]);

    const handlePageChange = (teamId: number, newPage: number) => {
        setCurrentPage(prev => ({ ...prev, [teamId]: newPage }));
    };

    const getInitials = (firstName: string | null, lastName: string | null) => {
        return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
    };

    return (
        <div className="space-y-6">
            <Card className="border-0 shadow-sm">
                <CardHeader className="pb-4">
                    <CardTitle className="text-3xl md:text-xl font-semibold text-foreground">Team Management</CardTitle>
                    <p className="text-lg md:text-sm text-muted-foreground">Manage teams, assign cities, and add field officers to teams</p>
                </CardHeader>
                <CardContent className="space-y-6">
                    {isLoading && (
                        <div className="flex justify-center items-center py-12">
                            <div className="flex flex-col items-center gap-3">
                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                <p className="text-sm text-muted-foreground">Loading teams...</p>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="p-4 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
                            <div className="flex items-center justify-between">
                                <p><strong>Error:</strong> {error}</p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setError(null);
                                        fetchTeams();
                                    }}
                                >
                                    Try Again
                                </Button>
                            </div>
                        </div>
                    )}

                    {!isLoading && !error && (
                        <>
                            {isDataAvailable ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {teams.map((team) => {
                                        const visibleOfficers = team.fieldOfficers.slice(0, 3);
                                        const managers = getTeamManagers(team).sort(sortByNameAsc);
                                        const primaryManager = managers[0] ?? null;
                                        const assignedTeamCities = getTeamAssignedCities(team);

                                        return (
                                            <Card key={team.id} className="overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300">
                                                <CardContent className="p-5 md:p-4">
                                                    <div className="flex justify-between items-start mb-4">
                                                        <div className="flex min-w-0 items-center">
                                                            <div
                                                                className="mr-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
                                                                title={primaryManager ? getManagerName(primaryManager) : 'No manager assigned'}
                                                            >
                                                                {primaryManager
                                                                    ? getInitials(primaryManager.firstName ?? null, primaryManager.lastName ?? null) || '?'
                                                                    : '?'}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="flex min-w-0 items-center gap-1.5">
                                                                    <h3 className="truncate text-base font-semibold text-foreground">
                                                                        {primaryManager ? getManagerName(primaryManager) : 'No manager assigned'}
                                                                    </h3>
                                                                    {managers.length > 1 && (
                                                                        <DropdownMenu>
                                                                            <DropdownMenuTrigger asChild>
                                                                                <Button
                                                                                    type="button"
                                                                                    variant="outline"
                                                                                    size="sm"
                                                                                    className="h-6 shrink-0 gap-1 rounded-full px-2 text-xs"
                                                                                >
                                                                                    +{managers.length - 1}
                                                                                    <ChevronDown className="h-3 w-3" />
                                                                                    <span className="sr-only">Show managers</span>
                                                                                </Button>
                                                                            </DropdownMenuTrigger>
                                                                            <DropdownMenuContent align="start" className="w-56">
                                                                                {managers.map((manager) => (
                                                                                    <DropdownMenuItem key={manager.id} className="cursor-default">
                                                                                        {getManagerName(manager)}
                                                                                    </DropdownMenuItem>
                                                                                ))}
                                                                            </DropdownMenuContent>
                                                                        </DropdownMenu>
                                                                    )}
                                                                </div>
                                                                <p className="text-sm text-muted-foreground">
                                                                    {managers.length <= 1 ? 'Manager' : `${managers.length} Managers`}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => showDeleteModal(team.id)}
                                                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                        >
                                                            <Trash2 size={20} />
                                                        </Button>
                                                    </div>
                                                    
                                                    <div className="flex flex-wrap gap-2 mb-4">
                                                        {assignedTeamCities.map((city, index) => (
                                                            <Badge key={index} variant="secondary" className="flex items-center text-xs md:text-[11px]">
                                                                <Building2 size={12} className="mr-1 text-foreground" />
                                                                {city}
                                                            </Badge>
                                                        ))}
                                                        {assignedTeamCities.length === 0 && (
                                                            <Badge variant="outline" className="text-xs">No cities assigned</Badge>
                                                        )}
                                                    </div>
                                                    
                                                    <div className="space-y-3">
                                                        {visibleOfficers.map((officer) => (
                                                            <div key={officer.id} className="bg-muted/30 p-3 rounded-lg flex items-center justify-between group hover:bg-muted/50 transition-all duration-300">
                                                                <div className="flex items-center min-w-0">
                                                                    <User size={20} className="text-foreground mr-2 flex-shrink-0" />
                                                                    <div className="min-w-0 flex-grow">
                                                                        <p className="font-medium text-sm text-foreground truncate">
                                                                            {`${officer.firstName} ${officer.lastName}`}
                                                                        </p>
                                                                        <p className="text-xs text-muted-foreground truncate">
                                                                            {officer.role}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center">
                                                                    {officer.status === 'inactive' && (
                                                                        <Badge variant="destructive" className="mr-2 text-xs">
                                                                            Inactive
                                                                        </Badge>
                                                                    )}
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => showRemoveOfficerModal(team.id, officer)}
                                                                        className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                                        disabled={isSaving}
                                                                    >
                                                                        <X size={16} />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {team.fieldOfficers.length === 0 && (
                                                            <div className="text-xs text-muted-foreground bg-muted/20 border border-border/50 rounded-md p-3 text-center">
                                                                No field officers yet
                                                            </div>
                                                        )}
                                                        {team.fieldOfficers.length > 3 && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="w-full justify-center text-xs"
                                                                onClick={() => { setViewAllTeamId(team.id); setIsViewAllModalVisible(true); setOfficersSearch(''); }}
                                                            >
                                                                View all ({team.fieldOfficers.length})
                                                            </Button>
                                                        )}
                                                    </div>

                                                    <div className={`${team.fieldOfficers.length > 0 ? 'mt-4 pt-4 border-t' : 'mt-2'}`}> 
                                                        <div className="grid grid-cols-3 gap-2">
                                                            <Button
                                                                variant="outline"
                                                                className="h-10 text-sm font-medium"
                                                                onClick={() => showManagersModal(team)}
                                                            >
                                                                <Users size={16} className="mr-2" />
                                                                Managers
                                                            </Button>
                                                            <Button
                                                                variant="outline"
                                                                className="h-10 text-sm font-medium"
                                                                onClick={() => showManageCitiesModal(team)}
                                                            >
                                                                <MapPin size={16} className="mr-2" />
                                                                Cities
                                                            </Button>
                                                            <Button
                                                                className="h-10 text-sm font-medium"
                                                                onClick={() => showEditModal(team)}
                                                            >
                                                                <UserPlus size={18} className="mr-2" />
                                                                Officers
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-10">
                                    <Users size={48} className="mx-auto text-foreground mb-4" />
                                    <p className="text-lg font-semibold text-foreground">No teams available</p>
                                    <p className="text-sm text-muted-foreground mt-2">Try refreshing the page or check back later.</p>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Delete Team Modal */}
            <Dialog open={isDeleteModalVisible} onOpenChange={(open) => {
                setIsDeleteModalVisible(open);
                if (!open) {
                    setError(null); // Clear errors when modal closes
                }
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Team</DialogTitle>
                    </DialogHeader>
                    <p className="text-muted-foreground">Are you sure you want to delete this team? This action cannot be undone.</p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeleteModalVisible(false)}>
                            Cancel
                        </Button>
                        <Button 
                            variant="destructive" 
                            onClick={handleDeleteTeam}
                            disabled={isSaving}
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Deleting...
                                </>
                            ) : (
                                'Delete'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Managers Modal */}
            <Dialog open={isManagersModalVisible} onOpenChange={(open) => {
                if (open) setIsManagersModalVisible(true);
                else closeManagersModal();
            }}>
                <DialogContent className="sm:max-w-[560px]">
                    <DialogHeader>
                        <DialogTitle>Manage Managers</DialogTitle>
                        <p className="text-sm text-muted-foreground mt-1">Select the full manager list for this team</p>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Search managers..."
                                value={managerSearchTerm}
                                onChange={(event) => setManagerSearchTerm(event.target.value)}
                                className="pl-9"
                            />
                        </div>

                        <div className="rounded-md border">
                            <ScrollArea className="h-72">
                                {isLoadingManagers ? (
                                    <div className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Loading managers...
                                    </div>
                                ) : filteredOfficeManagers.length === 0 ? (
                                    <div className="p-6 text-center text-sm text-muted-foreground">
                                        No available managers found
                                    </div>
                                ) : (
                                    <div className="space-y-1 p-2">
                                        {filteredOfficeManagers.map((manager) => {
                                            const checked = selectedManagerIds.includes(manager.id);
                                            return (
                                                <label
                                                    key={manager.id}
                                                    htmlFor={`team-manager-${manager.id}`}
                                                    className="flex cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-muted/50"
                                                >
                                                    <div className="flex min-w-0 items-center gap-2">
                                                        <Checkbox
                                                            id={`team-manager-${manager.id}`}
                                                            checked={checked}
                                                            onCheckedChange={(isChecked) => {
                                                                setSelectedManagerIds((prev) =>
                                                                    isChecked
                                                                        ? Array.from(new Set([...prev, manager.id]))
                                                                        : prev.filter((id) => id !== manager.id)
                                                                );
                                                            }}
                                                        />
                                                        <div className="min-w-0">
                                                            <p className="truncate text-sm font-medium">{getManagerName(manager)}</p>
                                                            <p className="truncate text-xs text-muted-foreground">{manager.role ?? 'Manager'}</p>
                                                        </div>
                                                    </div>
                                                    {(manager.assignedCity ?? []).length > 0 && (
                                                        <Badge variant="outline" className="shrink-0 text-xs">
                                                            {(manager.assignedCity ?? []).length} cities
                                                        </Badge>
                                                    )}
                                                </label>
                                            );
                                        })}
                                    </div>
                                )}
                            </ScrollArea>
                        </div>

                        {selectedManagerIds.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {selectedManagerIds.map((managerId) => {
                                    const manager = allOfficeManagers.find((item) => item.id === managerId);
                                    return (
                                        <Badge key={managerId} variant="secondary" className="text-xs">
                                            {manager ? getManagerName(manager) : `Manager ${managerId}`}
                                        </Badge>
                                    );
                                })}
                            </div>
                        )}

                        {modalError && (
                            <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
                                <p><strong>Error:</strong> {modalError}</p>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={closeManagersModal} disabled={isSaving}>
                            Cancel
                        </Button>
                        <Button onClick={handleSaveManagers} disabled={selectedManagerIds.length === 0 || isSaving || isLoadingManagers}>
                            {isSaving ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                'Save Managers'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Manage Cities Modal */}
            <Dialog open={isManageCitiesModalVisible} onOpenChange={(open) => {
                if (open) setIsManageCitiesModalVisible(true);
                else closeManageCitiesModal();
            }}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Manage Cities</DialogTitle>
                        <p className="text-sm text-muted-foreground mt-1">Add or remove cities assigned to this team</p>
                    </DialogHeader>
                    <div className="space-y-4">
                        {currentTeamManagers.length > 1 && (
                            <div>
                                <Label className="text-sm font-medium text-foreground mb-2 block">Manager</Label>
                                <div className="flex flex-wrap gap-2">
                                    {currentTeamManagers.map((manager) => (
                                        <Button
                                            key={manager.id}
                                            type="button"
                                            variant={selectedOfficeManagerId === manager.id ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => {
                                                setSelectedOfficeManagerId(manager.id);
                                                setAssignedCities(manager.assignedCity ?? []);
                                                setSelectedCities([]);
                                            }}
                                        >
                                            {getManagerName(manager)}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div>
                            <Label className="text-sm font-medium text-foreground mb-2 block">Assigned Cities</Label>
                            {assignedCities.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {assignedCities.map((city, index) => (
                                        <Badge key={index} variant="secondary" className="flex items-center gap-1.5 pr-1 pl-2 py-1.5">
                                            <Building2 size={14} className="text-primary" />
                                            <span className="text-sm font-medium">{city}</span>
                                            <Button 
                                                size="sm" 
                                                variant="ghost" 
                                                onClick={() => handleRemoveCity(city)} 
                                                className="h-5 w-5 p-0 ml-0.5 hover:bg-destructive/20 hover:text-destructive rounded-full transition-colors"
                                                disabled={isSaving}
                                            >
                                                <X size={12} />
                                            </Button>
                                        </Badge>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-6 text-sm text-muted-foreground border border-dashed rounded-md">
                                    <MapPin className="h-5 w-5 mx-auto mb-2 opacity-50" />
                                    <p>No cities assigned yet</p>
                                </div>
                            )}
                        </div>
                        
                        <div className="space-y-2 pt-2 border-t">
                            <Label htmlFor="newCityModal">Add New City</Label>
                            {selectedCities.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {selectedCities.map((city) => (
                                        <Badge key={city} variant="secondary" className="text-xs">
                                            {toSentenceCase(city)}
                                        </Badge>
                                    ))}
                                </div>
                            )}
                            <Popover open={isCityPopoverOpen} onOpenChange={setIsCityPopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className="w-full justify-between text-left font-normal"
                                    >
                                        <span className={selectedCities.length === 0 ? "text-muted-foreground" : ""}>
                                            {cityTriggerLabel}
                                        </span>
                                        <Search className="h-4 w-4 text-muted-foreground" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[320px] p-0" align="start">
                                    <div className="border-b p-3 space-y-2">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                            <Input
                                                placeholder="Search city..."
                                                value={citySearchTerm}
                                                onChange={(event) => setCitySearchTerm(event.target.value)}
                                                className="pl-9"
                                            />
                                        </div>
                                        {selectedCities.length > 0 && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="w-full justify-start text-primary"
                                                onClick={() => setSelectedCities([])}
                                            >
                                                <X className="h-4 w-4 mr-2" />
                                                Clear selection
                                            </Button>
                                        )}
                                    </div>
                                    <ScrollArea className="max-h-64">
                                        {availableCities.length === 0 ? (
                                            <div className="p-4 text-sm text-muted-foreground">
                                                No cities available
                                            </div>
                                        ) : filteredCities.length === 0 ? (
                                            <div className="p-4 text-sm text-muted-foreground">
                                                No matches found
                                            </div>
                                        ) : (
                                            <div className="p-1 space-y-1">
                                                {filteredCities.map((city) => (
                                                        <div
                                                            key={city.value}
                                                            className="flex items-center space-x-2 rounded-md px-3 py-2 hover:bg-muted/40"
                                                        >
                                                            <Checkbox
                                                                id={`city-${city.value}`}
                                                                checked={selectedCities.includes(city.value)}
                                                                onCheckedChange={() => handleToggleCity(city.value)}
                                                            />
                                                            <label
                                                                htmlFor={`city-${city.value}`}
                                                                className="text-sm flex-1 truncate cursor-pointer"
                                                            >
                                                                {toSentenceCase(city.label)}
                                                            </label>
                                                            {(cityAssignments.get(normalizeCityKey(city.value)) ?? []).length > 0 && (
                                                                <Badge variant="outline" className="max-w-[130px] truncate text-[10px] font-normal">
                                                                    Assigned to {(cityAssignments.get(normalizeCityKey(city.value)) ?? []).join(', ')}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    ))}
                                            </div>
                                        )}
                                    </ScrollArea>
                                </PopoverContent>
                            </Popover>
                            <Button 
                                className="mt-2 w-full" 
                                onClick={handleAssignCity} 
                                disabled={selectedCities.length === 0 || isSaving}
                            >
                                {isSaving ? (
                                    <span className="inline-flex items-center">
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Assigning...
                                    </span>
                                ) : (
                                    'Assign Cities'
                                )}
                            </Button>
                        </div>
                        
                        {modalError && (
                            <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
                                <p><strong>Error:</strong> {modalError}</p>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button 
                            variant="outline" 
                            onClick={closeManageCitiesModal}
                            disabled={isSaving}
                        >
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Team Modal - Add Field Officer */}
            <Dialog open={isEditModalVisible} onOpenChange={(open) => {
                if (open) setIsEditModalVisible(true);
                else closeEditModal();
            }}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Add Field Officer</DialogTitle>
                        <p className="text-sm text-muted-foreground mt-1">Select field officers to add to this team</p>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label className="text-sm font-medium text-foreground">Available Field Officers</Label>
                            <div className="space-y-2 max-h-60 overflow-y-auto mt-2">
                                {fieldOfficers.length === 0 ? (
                                    <div className="text-sm text-muted-foreground py-4 text-center">
                                        No available field officers found
                                    </div>
                                ) : (() => {
                                    const unassignedOfficers = fieldOfficers.filter((officer) => officer.teamId == null);
                                    const assignedOfficers = fieldOfficers.filter((officer) => officer.teamId != null);

                                    return (
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <div className="text-xs font-medium text-muted-foreground">Unassigned</div>
                                                {unassignedOfficers.length === 0 ? (
                                                    <div className="text-xs text-muted-foreground">No unassigned officers found</div>
                                                ) : unassignedOfficers.map((officer) => (
                                                    <div key={officer.id} className="flex items-center space-x-2">
                                                        <div className="flex items-center w-full">
                                                            <Checkbox
                                                                id={`officer-${officer.id}`}
                                                                checked={selectedFieldOfficers.includes(officer.id)}
                                                                onCheckedChange={(checked) => {
                                                                    setSelectedFieldOfficers(prev =>
                                                                        checked
                                                                            ? [...prev, officer.id]
                                                                            : prev.filter(id => id !== officer.id)
                                                                    );
                                                                }}
                                                            />
                                                            <Label htmlFor={`officer-${officer.id}`} className="ml-2 text-sm text-foreground">
                                                                {`${officer.firstName} ${officer.lastName} (${officer.role})`}
                                                            </Label>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="space-y-2 border-t pt-3">
                                                <div className="text-xs font-medium text-muted-foreground">Already Assigned</div>
                                                {assignedOfficers.length === 0 ? (
                                                    <div className="text-xs text-muted-foreground">No assigned officers found</div>
                                                ) : assignedOfficers.map((officer) => (
                                                    <div key={officer.id} className="flex items-center justify-between gap-2 opacity-80">
                                                        <div className="flex min-w-0 items-center">
                                                            <Checkbox id={`officer-assigned-${officer.id}`} checked={false} disabled />
                                                            <Label htmlFor={`officer-assigned-${officer.id}`} className="ml-2 truncate text-sm text-muted-foreground">
                                                                {`${officer.firstName} ${officer.lastName} (${officer.role})`}
                                                            </Label>
                                                        </div>
                                                        <Badge variant="outline" className="shrink-0 text-xs">
                                                            Team {officer.teamId}
                                                        </Badge>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                        {modalError && (
                            <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
                                <p><strong>Error:</strong> {modalError}</p>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={closeEditModal}>
                            Cancel
                        </Button>
                        <Button 
                            onClick={handleAddFieldOfficer} 
                            disabled={
                                selectedFieldOfficers.filter((id) =>
                                    fieldOfficers.some((officer) => officer.id === id && officer.teamId == null)
                                ).length === 0 || isSaving
                            }
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Adding...
                                </>
                            ) : (
                                'Add Selected Officers'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* View All Officers Modal */}
            <Dialog open={isViewAllModalVisible} onOpenChange={setIsViewAllModalVisible}>
                <DialogContent className="sm:max-w-[560px]">
                    <DialogHeader>
                        <DialogTitle>Field Officers</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <Input
                            placeholder="Search field officers"
                            value={officersSearch}
                            onChange={(e) => setOfficersSearch(e.target.value)}
                        />
                        <ScrollArea className="h-80 pr-3">
                            <div className="space-y-2">
                                {(() => {
                                    const team = teams.find(t => t.id === viewAllTeamId);
                                    const list = team ? [...team.fieldOfficers].sort((a, b) => `${a.firstName} ${a.lastName}`.toLowerCase().localeCompare(`${b.firstName} ${b.lastName}`.toLowerCase())) : [];
                                    const filtered = list.filter(o =>
                                        `${o.firstName} ${o.lastName}`.toLowerCase().includes(officersSearch.toLowerCase())
                                    );
                                    return filtered.length === 0 ? (
                                        <div className="text-sm text-muted-foreground py-8 text-center">No field officers found</div>
                                    ) : (
                                        filtered.map((officer) => (
                                            <div key={officer.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50">
                                                <div className="flex items-center min-w-0">
                                                    <User size={18} className="text-foreground mr-2 flex-shrink-0" />
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-medium text-foreground truncate">{`${officer.firstName} ${officer.lastName}`}</p>
                                                        <p className="text-xs text-muted-foreground truncate">{officer.role}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center">
                                                    {officer.status === 'inactive' && (
                                                        <Badge variant="destructive" className="mr-2 text-xs">Inactive</Badge>
                                                    )}
                                                    {team && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                            onClick={() => showRemoveOfficerModal(team.id, officer)}
                                                            disabled={isSaving}
                                                        >
                                                            <X size={14} />
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    );
                                })()}
                            </div>
                        </ScrollArea>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsViewAllModalVisible(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Confirm Remove Field Officer Modal */}
            <Dialog open={isRemoveOfficerModalVisible} onOpenChange={setIsRemoveOfficerModalVisible}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Remove Field Officer</DialogTitle>
                    </DialogHeader>
                    <p className="text-muted-foreground">
                        Are you sure you want to remove{' '}
                        <span className="font-medium">{officerToRemove?.name}</span>{' '}
                        from this team? This will not delete the employee.
                    </p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsRemoveOfficerModalVisible(false)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={confirmRemoveFieldOfficer} disabled={isSaving}>
                            {isSaving ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Removing...
                                </>
                            ) : (
                                'Remove'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Remove City Modal */}
            <Dialog open={isCityRemoveModalVisible} onOpenChange={(open) => {
                setIsCityRemoveModalVisible(open);
                if (!open) {
                    setModalError(null); // Clear error when modal closes
                    setCityToRemove(null);
                }
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Remove City</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <p className="text-muted-foreground">Are you sure you want to remove {cityToRemove} from this team?</p>
                        {modalError && (
                            <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
                                <p><strong>Error:</strong> {modalError}</p>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button 
                            variant="outline" 
                            onClick={() => {
                                setIsCityRemoveModalVisible(false);
                                setModalError(null);
                            }}
                            disabled={isSaving}
                        >
                            Cancel
                        </Button>
                        <Button 
                            variant="destructive" 
                            onClick={confirmRemoveCity}
                            disabled={isSaving}
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Removing...
                                </>
                            ) : (
                                'Remove'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Teams;
