"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
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
    UserPlus, 
    MapPin, 
    X, 
    Trash2, 
    Users, 
    User, 
    Building2,
    Loader2,
    Search,
    ChevronDown,
    MoreHorizontal,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { buildCityOptions, mergeCityOptions, normalizeCityKey } from '@/lib/city-options';
import { getPrimaryTeamManager, getTeamAssignedCities, getTeamManagers } from '@/lib/team-access';
import { API } from '@/lib/api';
import { useUnsavedChanges } from '@/components/unsaved-changes-provider';
import { SearchableSelect } from '@/components/ui/searchable-select2';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { toast } from 'sonner';
import AddTeam from '@/components/AddTeam';

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

type TeamPanelSection = 'overview' | 'managers' | 'cities' | 'officers';

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
    const [managerFilterId, setManagerFilterId] = useState("");
    const [cityFilter, setCityFilter] = useState("");
    const [fieldOfficerFilterId, setFieldOfficerFilterId] = useState("");
    const [teamSearchQuery, setTeamSearchQuery] = useState("");
    const [isTeamPanelOpen, setIsTeamPanelOpen] = useState(false);
    const [teamPanelSection, setTeamPanelSection] = useState<TeamPanelSection>('overview');
    const [panelTeamId, setPanelTeamId] = useState<number | null>(null);
    const [isDeleteConfirming, setIsDeleteConfirming] = useState(false);

    const managerBaselineIds = useMemo(() => {
        const team = teams.find((item) => item.id === selectedTeamId);
        return team ? getTeamManagers(team).map((manager) => manager.id).sort((a, b) => a - b) : [];
    }, [selectedTeamId, teams]);
    const managerDraftIds = useMemo(
        () => [...selectedManagerIds].sort((a, b) => a - b),
        [selectedManagerIds]
    );
    const managerChangesAreDirty = isTeamPanelOpen && teamPanelSection === 'managers' && JSON.stringify(managerDraftIds) !== JSON.stringify(managerBaselineIds);
    const cityChangesAreDirty = isTeamPanelOpen && teamPanelSection === 'cities' && selectedCities.length > 0;
    const fieldOfficerChangesAreDirty = isTeamPanelOpen && teamPanelSection === 'officers' && selectedFieldOfficers.length > 0;
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
        return [manager.firstName, manager.lastName].filter(Boolean).join(' ').trim() || `Regional Manager ${manager.id}`;
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

    const openTeamPanel = async (team: Team, section: TeamPanelSection = 'overview') => {
        const primaryManager = getPrimaryTeamManager(team);
        const teamCities = getTeamAssignedCities(team);

        setError(null);
        setModalError(null);
        setPanelTeamId(team.id);
        setSelectedTeamId(team.id);
        setCurrentTeamId(team.id);
        setViewAllTeamId(team.id);
        setDeleteTeamId(team.id);
        setSelectedOfficeManagerId(primaryManager?.id ?? null);
        setSelectedManagerIds(getTeamManagers(team).map((manager) => manager.id));
        setAssignedCities(primaryManager?.assignedCity ?? teamCities);
        setSelectedCities([]);
        setSelectedFieldOfficers([]);
        setManagerSearchTerm('');
        setCitySearchTerm('');
        setOfficersSearch('');
        setIsCityPopoverOpen(false);
        setIsDeleteConfirming(false);
        setTeamPanelSection(section);
        setIsTeamPanelOpen(true);

        await Promise.all([
            fetchCities(),
            fetchOfficeManagers(team.id),
            fetchFieldOfficersByCities(teamCities, team.id),
        ]);
    };

    const showDeleteModal = (teamId: number) => {
        const team = teams.find((item) => item.id === teamId);
        if (team) void openTeamPanel(team, 'overview');
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
            setIsTeamPanelOpen(false);
            setPanelTeamId(null);
            toast.success('Team deleted', { duration: 3000 });
        } catch (error) {
            console.error('Error deleting team:', error);
            const message = error instanceof Error ? error.message : 'Error deleting team';
            setError(message);
            toast.error(message, { duration: 3000 });
        } finally {
            setIsSaving(false);
        }
    };

    const showEditModal = (team: Team) => {
        void openTeamPanel(team, 'officers');
    };

    const showManageCitiesModal = (team: Team) => {
        void openTeamPanel(team, 'cities');
    };

    const showManagersModal = (team: Team) => {
        void openTeamPanel(team, 'managers');
    };

    const handleRemoveCity = (city: string) => {
        setError(null); // Clear any background errors when opening modal
        setModalError(null); // Clear any previous modal errors
        setCityToRemove(city);
        setIsCityRemoveModalVisible(true);
    };

    const confirmRemoveCity = async (cityOverride?: string) => {
        const targetCity = cityOverride ?? cityToRemove;
        if (!targetCity || !selectedOfficeManagerId || !token) return;

        setIsSaving(true);
        setModalError(null); // Clear previous errors
        try {
            const response = await fetch(
                `http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/employee/removeAssignedCity?employeeId=${selectedOfficeManagerId}&city=${encodeURIComponent(targetCity.toLowerCase())}`,
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
            setAssignedCities(prev => prev.filter(c => normalizeCityKey(c) !== normalizeCityKey(targetCity)));
            
            // Reload teams data to reflect the change
            await fetchTeams();
            
            setIsCityRemoveModalVisible(false);
            setCityToRemove(null);
            setModalError(null);
            toast.success('City removed from team', { duration: 3000 });
        } catch (error) {
            console.error('Error removing city:', error);
            const message = error instanceof Error ? error.message : 'Error removing city';
            setModalError(message);
            toast.error(message, { duration: 3000 });
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
            setFieldOfficers((current) => current.filter((officer) => !unassignedSelectedFieldOfficers.includes(officer.id)));
            setSelectedFieldOfficers([]);
            setModalError(null);
            toast.success('Field officers added', { duration: 3000 });
        } catch (error) {
            console.error('Error adding field officer:', error);
            const message = error instanceof Error ? error.message : 'Error adding field officers';
            setModalError(message);
            toast.error(message, { duration: 3000 });
        } finally {
            setIsSaving(false);
        }
    };

    const handleRemoveFieldOfficer = async (teamId: number, fieldOfficerId: number) => {
        if (!token) return false;

        const removedOfficer = teams
            .find((team) => team.id === teamId)
            ?.fieldOfficers.find((officer) => officer.id === fieldOfficerId);

        setIsSaving(true);
        setModalError(null);
        try {
            const response = await fetch(`http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/employee/team/deleteFieldOfficer?id=${teamId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    fieldOfficers: [fieldOfficerId],
                }),
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Failed to remove field officer');
                throw new Error(errorText || 'Failed to remove field officer');
            }

            setTeams((current) => current.map((team) => (
                team.id === teamId
                    ? { ...team, fieldOfficers: team.fieldOfficers.filter((officer) => officer.id !== fieldOfficerId) }
                    : team
            )));
            if (removedOfficer) {
                setFieldOfficers((current) => {
                    const eligibleOfficer = { ...removedOfficer, teamId: null };
                    const byId = new Map(current.map((officer) => [officer.id, officer]));
                    byId.set(eligibleOfficer.id, eligibleOfficer);
                    return Array.from(byId.values()).sort(sortByNameAsc);
                });
            }
            void fetchTeams();
            toast.success('Field officer removed', { duration: 3000 });
            return true;
        } catch (error) {
            console.error('Error removing field officer:', error);
            const message = error instanceof Error ? error.message : 'Error removing field officer';
            setModalError(message);
            toast.error(message, { duration: 3000 });
            return false;
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
        const removed = await handleRemoveFieldOfficer(officerToRemove.teamId, officerToRemove.officerId);
        if (removed) {
            setIsRemoveOfficerModalVisible(false);
            setOfficerToRemove(null);
        }
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
            
            setIsManageCitiesModalVisible(false);
            toast.success('Cities assigned to team', { duration: 3000 });
        } catch (error) {
            console.error('Error assigning city:', error);
            const message = error instanceof Error ? error.message : 'Error assigning city';
            setModalError(message);
            toast.error(message, { duration: 3000 });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveManagers = async () => {
        if (!selectedTeamId || !token) return;

        const managerIdsForPayload = Array.from(new Set(selectedManagerIds));

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
                const errorText = await response.text().catch(() => 'Failed to update regional managers');
                throw new Error(errorText || 'Failed to update regional managers');
            }

            await fetchTeams();
            setIsManagersModalVisible(false);
            setManagerSearchTerm('');
            setModalError(null);
            toast.success('Regional managers updated', { duration: 3000 });
        } catch (error) {
            console.error('Error updating managers:', error);
            const message = error instanceof Error ? error.message : 'Error updating regional managers';
            setModalError(message);
            toast.error(message, { duration: 3000 });
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

    const closeTeamPanel = () => {
        requestDiscard(() => {
            setIsTeamPanelOpen(false);
            setPanelTeamId(null);
            setSelectedCities([]);
            setSelectedFieldOfficers([]);
            setManagerSearchTerm('');
            setCitySearchTerm('');
            setOfficersSearch('');
            setModalError(null);
            setIsDeleteConfirming(false);
        }, teamChangesAreDirty);
    };

    const selectTeamPanelSection = (section: TeamPanelSection) => {
        if (section === teamPanelSection) return;
        requestDiscard(() => {
            const team = teams.find((item) => item.id === panelTeamId);
            setSelectedManagerIds(team ? getTeamManagers(team).map((manager) => manager.id) : []);
            setSelectedCities([]);
            setSelectedFieldOfficers([]);
            setManagerSearchTerm('');
            setCitySearchTerm('');
            setModalError(null);
            setIsDeleteConfirming(false);
            setTeamPanelSection(section);
        }, teamChangesAreDirty);
    };

    const currentTeamManagers = useMemo(() => {
        const team = teams.find((item) => item.id === currentTeamId);
        return team ? getTeamManagers(team).sort(sortByNameAsc) : [];
    }, [teams, currentTeamId]);

    const panelTeam = useMemo(
        () => teams.find((team) => team.id === panelTeamId) ?? null,
        [teams, panelTeamId]
    );

    const filteredOfficeManagers = useMemo(() => {
        const query = managerSearchTerm.trim().toLowerCase();
        if (!query) return allOfficeManagers;
        return allOfficeManagers.filter((manager) =>
            getManagerName(manager).toLowerCase().includes(query)
        );
    }, [allOfficeManagers, managerSearchTerm]);

    const managerFilterOptions = useMemo(() => {
        const managersById = new Map<number, TeamManager>();
        teams.forEach((team) => {
            getTeamManagers(team).forEach((manager) => managersById.set(manager.id, manager));
        });
        const managers = Array.from(managersById.values());
        const nameCounts = managers.reduce((counts, manager) => {
            const name = getManagerName(manager);
            counts.set(name, (counts.get(name) ?? 0) + 1);
            return counts;
        }, new Map<string, number>());

        return managers
            .map((manager) => {
                const name = getManagerName(manager);
                return {
                    value: String(manager.id),
                    label: (nameCounts.get(name) ?? 0) > 1 ? `${name} · #${manager.id}` : name,
                };
            })
            .sort((left, right) => left.label.localeCompare(right.label));
    }, [teams]);

    const cityFilterOptions = useMemo(
        () => buildCityOptions(teams.flatMap((team) => getTeamAssignedCities(team)))
            .map((option) => ({ ...option, label: toSentenceCase(option.label) }))
            .sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: 'base' })),
        [teams]
    );

    const fieldOfficerFilterOptions = useMemo(() => {
        const officersById = new Map<number, FieldOfficer>();
        teams.forEach((team) => {
            team.fieldOfficers.forEach((officer) => officersById.set(officer.id, officer));
        });
        return Array.from(officersById.values())
            .map((officer) => ({
                value: String(officer.id),
                label: `${officer.firstName} ${officer.lastName}`.trim() || `Field Officer ${officer.id}`,
            }))
            .sort((left, right) => left.label.localeCompare(right.label));
    }, [teams]);

    const filteredTeams = useMemo(() => {
        const normalizedCityFilter = normalizeCityKey(cityFilter);
        const normalizedSearchQuery = teamSearchQuery.trim().toLowerCase();
        return teams.filter((team) => {
            const matchesManager = !managerFilterId || getTeamManagers(team).some(
                (manager) => String(manager.id) === managerFilterId
            );
            const matchesCity = !normalizedCityFilter || getTeamAssignedCities(team).some(
                (city) => normalizeCityKey(city) === normalizedCityFilter
            );
            const matchesFieldOfficer = !fieldOfficerFilterId || team.fieldOfficers.some(
                (officer) => String(officer.id) === fieldOfficerFilterId
            );
            const searchableTeamText = [
                String(team.id),
                ...getTeamManagers(team).map((manager) => getManagerName(manager)),
                ...getTeamAssignedCities(team),
                ...team.fieldOfficers.map((officer) => `${officer.firstName} ${officer.lastName}`),
            ].join(" ").toLowerCase();
            const matchesSearch = !normalizedSearchQuery || searchableTeamText.includes(normalizedSearchQuery);
            return matchesManager && matchesCity && matchesFieldOfficer && matchesSearch;
        });
    }, [cityFilter, fieldOfficerFilterId, managerFilterId, teamSearchQuery, teams]);

    const activeTeamFilterCount = [managerFilterId, cityFilter, fieldOfficerFilterId].filter(Boolean).length;

    const clearTeamFilters = () => {
        setManagerFilterId("");
        setCityFilter("");
        setFieldOfficerFilterId("");
    };

    const handlePageChange = (teamId: number, newPage: number) => {
        setCurrentPage(prev => ({ ...prev, [teamId]: newPage }));
    };

    const getInitials = (firstName: string | null, lastName: string | null) => {
        return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
    };

    return (
        <div>
            <Card className="gap-0 border-border/70 py-0 shadow-sm">
                <CardContent className="space-y-4 p-4">
                    <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(190px,1.25fr)_repeat(3,minmax(150px,1fr))_auto] lg:items-end">
                            <div className="space-y-1.5">
                                <Label htmlFor="team-search" className="text-xs">Search</Label>
                                <div className="relative min-w-0">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        id="team-search"
                                        type="text"
                                        value={teamSearchQuery}
                                        onChange={(event) => setTeamSearchQuery(event.target.value)}
                                        placeholder="Search teams..."
                                        className="h-9 pl-9 pr-9 text-sm shadow-none"
                                        disabled={isLoading || !isDataAvailable}
                                    />
                                    {teamSearchQuery && (
                                        <button
                                            type="button"
                                            onClick={() => setTeamSearchQuery("")}
                                            className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                                            aria-label="Clear team search"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="team-manager-filter" className="text-xs">Regional manager</Label>
                                <SearchableSelect
                                    triggerId="team-manager-filter"
                                    options={managerFilterOptions}
                                    value={managerFilterId || undefined}
                                    onSelect={(option) => setManagerFilterId(option?.value || "")}
                                    placeholder="All regional managers"
                                    searchPlaceholder="Search regional managers..."
                                    emptyMessage="No regional managers available"
                                    allowClear
                                    triggerClassName="w-full"
                                    contentClassName="w-[var(--radix-popover-trigger-width)]"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="team-city-filter" className="text-xs">City</Label>
                                <SearchableSelect
                                    triggerId="team-city-filter"
                                    options={cityFilterOptions}
                                    value={cityFilter || undefined}
                                    onSelect={(option) => setCityFilter(option?.value || "")}
                                    placeholder="All cities"
                                    searchPlaceholder="Search cities..."
                                    emptyMessage="No cities available"
                                    allowClear
                                    triggerClassName="w-full"
                                    contentClassName="w-[var(--radix-popover-trigger-width)]"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="team-field-officer-filter" className="text-xs">Field officer</Label>
                                <SearchableSelect
                                    triggerId="team-field-officer-filter"
                                    options={fieldOfficerFilterOptions}
                                    value={fieldOfficerFilterId || undefined}
                                    onSelect={(option) => setFieldOfficerFilterId(option?.value || "")}
                                    placeholder="All field officers"
                                    searchPlaceholder="Search field officers..."
                                    emptyMessage="No field officers available"
                                    allowClear
                                    triggerClassName="w-full"
                                    contentClassName="w-[var(--radix-popover-trigger-width)]"
                                />
                            </div>
                            {!isLoading && (
                                <div className="flex h-9 items-center justify-between gap-2 sm:col-span-2 lg:col-span-1 lg:justify-end">
                                    <AddTeam onCreated={fetchTeams} />
                                    {isDataAvailable && activeTeamFilterCount > 0 && (
                                        <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={clearTeamFilters}>
                                            Clear ({activeTeamFilterCount})
                                        </Button>
                                    )}
                                    {isDataAvailable && (
                                        <span className="whitespace-nowrap text-xs text-muted-foreground">
                                            {filteredTeams.length} of {teams.length}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {isLoading && (
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {Array.from({ length: 6 }, (_, index) => (
                                <Skeleton key={index} className="h-60 rounded-xl" />
                            ))}
                        </div>
                    )}

                    {error && (
                        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <p>{error}</p>
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
                                <>
                                    {filteredTeams.length > 0 ? (
                                    <div className="space-y-3">
                                    {filteredTeams.map((team) => {
                                        const managers = getTeamManagers(team).sort(sortByNameAsc);
                                        const assignedTeamCities = getTeamAssignedCities(team);
                                        const visibleCities = assignedTeamCities.slice(0, 2);
                                        const remainingCityCount = assignedTeamCities.length - visibleCities.length;
                                        const visibleOfficerRoster = team.fieldOfficers.slice(0, 6);
                                        const remainingOfficerCount = team.fieldOfficers.length - visibleOfficerRoster.length;

                                        return (
                                            <Card key={team.id} className="gap-0 overflow-hidden border-border/70 py-0 shadow-sm transition-all hover:border-border hover:shadow-md">
                                                <CardContent className="p-3">
                                                    <div className="grid min-h-[132px] gap-3 lg:grid-cols-[minmax(260px,1.1fr)_minmax(145px,0.7fr)_minmax(330px,1.5fr)_140px]">
                                                        <div className="min-w-0 px-2 py-2">
                                                            <div className="mb-2 flex items-center justify-between gap-2">
                                                                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Team #{team.id}</p>
                                                                <span className="text-[10px] text-muted-foreground">
                                                                    {managers.length} regional manager{managers.length === 1 ? '' : 's'}
                                                                </span>
                                                            </div>
                                                            {managers.length > 0 ? (
                                                                <div className="space-y-1.5">
                                                                    {managers.slice(0, 2).map((manager) => (
                                                                        <button
                                                                            key={manager.id}
                                                                            type="button"
                                                                            className="flex w-full min-w-0 items-center rounded-lg border border-transparent px-1.5 py-1 text-left transition-colors hover:border-border/70 hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                                            onClick={() => void openTeamPanel(team, 'managers')}
                                                                            title={`${getManagerName(manager)} · Regional Manager`}
                                                                        >
                                                                            <span className="mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                                                                                {getInitials(manager.firstName ?? null, manager.lastName ?? null) || '?'}
                                                                            </span>
                                                                            <span className="min-w-0">
                                                                                <span className="block truncate text-xs font-semibold text-foreground">{getManagerName(manager)}</span>
                                                                                <span className="block text-[10px] text-muted-foreground">Regional Manager</span>
                                                                            </span>
                                                                        </button>
                                                                    ))}
                                                                    {managers.length > 2 && (
                                                                        <button type="button" className="pl-1.5 text-[10px] font-medium text-primary hover:underline" onClick={() => void openTeamPanel(team, 'managers')}>
                                                                            +{managers.length - 2} more regional managers
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <button type="button" className="flex w-full items-center rounded-lg border border-dashed px-3 py-3 text-xs text-muted-foreground hover:bg-muted/35" onClick={() => void openTeamPanel(team, 'managers')}>
                                                                    No regional manager assigned
                                                                </button>
                                                            )}
                                                        </div>

                                                        <div className="rounded-lg bg-muted/25 p-3">
                                                            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Coverage</p>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {visibleCities.map((city) => (
                                                                    <Badge key={city} variant="secondary" className="flex items-center text-[11px] font-normal">
                                                                        <Building2 size={12} className="mr-1 text-foreground" />
                                                                        {toSentenceCase(city)}
                                                                    </Badge>
                                                                ))}
                                                                {remainingCityCount > 0 && (
                                                                    <Button
                                                                        type="button"
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="h-6 rounded-full px-2 text-[11px] font-normal"
                                                                        onClick={() => void openTeamPanel(team, 'cities')}
                                                                        aria-label={`View all ${assignedTeamCities.length} cities for Team ${team.id}`}
                                                                    >
                                                                        +{remainingCityCount} more
                                                                    </Button>
                                                                )}
                                                                {assignedTeamCities.length === 0 && (
                                                                    <span className="text-xs text-muted-foreground">No cities assigned</span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div className="rounded-lg bg-muted/25 p-3">
                                                            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                                                Field officers · {team.fieldOfficers.length}
                                                            </p>
                                                            {visibleOfficerRoster.length > 0 ? (
                                                                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                                                                    {visibleOfficerRoster.map((officer) => (
                                                                        <button
                                                                            key={officer.id}
                                                                            type="button"
                                                                            className="flex h-7 min-w-0 items-center rounded-md bg-background/70 px-2 text-left transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                                            onClick={() => void openTeamPanel(team, 'officers')}
                                                                            title={`${officer.firstName} ${officer.lastName} · ${toSentenceCase(officer.role)}`}
                                                                        >
                                                                            <User size={14} className="mr-2 shrink-0 text-muted-foreground" />
                                                                            <span className="truncate text-[11px] font-medium text-foreground">{officer.firstName} {officer.lastName}</span>
                                                                            {officer.status === 'inactive' && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" aria-label="Inactive" />}
                                                                        </button>
                                                                    ))}
                                                                    {remainingOfficerCount > 0 && (
                                                                        <Button
                                                                            type="button"
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-7 justify-start px-2 text-[11px] text-primary"
                                                                            onClick={() => void openTeamPanel(team, 'officers')}
                                                                        >
                                                                            +{remainingOfficerCount} more officers
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <p className="text-xs text-muted-foreground">No field officers assigned</p>
                                                            )}
                                                        </div>

                                                        <div className="flex items-center justify-between gap-2 px-1 py-2 lg:flex-col lg:items-stretch lg:justify-center">
                                                            <Button size="sm" className="h-9 flex-1 text-xs" onClick={() => showEditModal(team)}>
                                                                <UserPlus className="mr-1.5 h-3.5 w-3.5" />Add officer
                                                            </Button>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="h-9 px-2 text-xs lg:w-full"
                                                                aria-label={`Manage Team ${team.id}`}
                                                                onClick={() => void openTeamPanel(team, 'overview')}
                                                            >
                                                                <MoreHorizontal className="mr-1.5 h-4 w-4" />Manage
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
                                    </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-10 text-center">
                                            <Users size={32} className="mb-3 text-muted-foreground" />
                                            <p className="text-sm font-semibold text-foreground">No teams match your search or filters</p>
                                            <p className="mt-1 text-xs text-muted-foreground">Try another search, regional manager, city, or field officer.</p>
                                            <Button type="button" variant="outline" size="sm" className="mt-4 h-8" onClick={() => {
                                                setTeamSearchQuery("");
                                                clearTeamFilters();
                                            }}>
                                                Clear search and filters
                                            </Button>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="py-10 text-center">
                                    <Users size={36} className="mx-auto mb-3 text-muted-foreground" />
                                    <p className="text-sm font-semibold text-foreground">No teams available</p>
                                    <p className="mt-1 text-xs text-muted-foreground">Try refreshing the page or check back later.</p>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            <Sheet open={isTeamPanelOpen} onOpenChange={(open) => {
                if (open) setIsTeamPanelOpen(true);
                else closeTeamPanel();
            }}>
                <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
                    <SheetHeader className="border-b px-5 py-4 pr-12">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                                {panelTeam && getPrimaryTeamManager(panelTeam)
                                    ? getInitials(getPrimaryTeamManager(panelTeam)?.firstName ?? null, getPrimaryTeamManager(panelTeam)?.lastName ?? null) || '?'
                                    : '?'}
                            </div>
                            <div className="min-w-0">
                                <SheetTitle className="truncate text-base">
                                    {panelTeam && getPrimaryTeamManager(panelTeam)
                                        ? getManagerName(getPrimaryTeamManager(panelTeam)!)
                                        : 'Team management'}
                                </SheetTitle>
                                <SheetDescription>
                                    Team #{panelTeamId ?? '—'} · Manage assignments and coverage
                                </SheetDescription>
                            </div>
                        </div>
                    </SheetHeader>

                    <div className="grid grid-cols-4 border-b bg-muted/20 px-3 py-2">
                        {([
                            ['overview', 'Overview'],
                            ['managers', 'Regional managers'],
                            ['cities', 'Cities'],
                            ['officers', 'Officers'],
                        ] as const).map(([value, label]) => (
                            <Button
                                key={value}
                                type="button"
                                variant={teamPanelSection === value ? 'secondary' : 'ghost'}
                                size="sm"
                                className="h-8 px-2 text-xs"
                                onClick={() => selectTeamPanelSection(value)}
                            >
                                {label}
                            </Button>
                        ))}
                    </div>

                    <ScrollArea className="min-h-0 flex-1">
                        <div className="space-y-5 p-5">
                            {teamPanelSection === 'overview' && panelTeam && (
                                <>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="rounded-lg border bg-card p-3">
                                            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Regional managers</p>
                                            <p className="mt-1 text-xl font-semibold">{getTeamManagers(panelTeam).length}</p>
                                        </div>
                                        <div className="rounded-lg border bg-card p-3">
                                            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Cities</p>
                                            <p className="mt-1 text-xl font-semibold">{getTeamAssignedCities(panelTeam).length}</p>
                                        </div>
                                        <div className="rounded-lg border bg-card p-3">
                                            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Officers</p>
                                            <p className="mt-1 text-xl font-semibold">{panelTeam.fieldOfficers.length}</p>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Team operations</p>
                                        <button type="button" onClick={() => selectTeamPanelSection('managers')} className="flex w-full items-center justify-between rounded-lg border p-4 text-left transition-colors hover:bg-muted/35">
                                            <span><span className="block text-sm font-semibold">Manage regional managers</span><span className="text-xs text-muted-foreground">Change who owns this team.</span></span>
                                            <Users className="h-4 w-4 text-muted-foreground" />
                                        </button>
                                        <button type="button" onClick={() => selectTeamPanelSection('cities')} className="flex w-full items-center justify-between rounded-lg border p-4 text-left transition-colors hover:bg-muted/35">
                                            <span><span className="block text-sm font-semibold">Manage city coverage</span><span className="text-xs text-muted-foreground">Assign or remove covered cities.</span></span>
                                            <MapPin className="h-4 w-4 text-muted-foreground" />
                                        </button>
                                        <button type="button" onClick={() => selectTeamPanelSection('officers')} className="flex w-full items-center justify-between rounded-lg border p-4 text-left transition-colors hover:bg-muted/35">
                                            <span><span className="block text-sm font-semibold">Manage field officers</span><span className="text-xs text-muted-foreground">Add or remove team members.</span></span>
                                            <UserPlus className="h-4 w-4 text-muted-foreground" />
                                        </button>
                                    </div>

                                    <div className="rounded-lg border border-destructive/25 bg-destructive/5 p-4">
                                        <p className="text-sm font-semibold text-destructive">Delete team</p>
                                        <p className="mt-1 text-xs leading-5 text-muted-foreground">Permanently delete this team. Employees are not deleted.</p>
                                        {!isDeleteConfirming ? (
                                            <Button type="button" variant="destructive" size="sm" className="mt-3" onClick={() => setIsDeleteConfirming(true)}>
                                                <Trash2 className="mr-2 h-4 w-4" />Delete team
                                            </Button>
                                        ) : (
                                            <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-destructive/25 bg-background p-3">
                                                <p className="text-xs font-medium">Are you sure?</p>
                                                <div className="flex gap-2">
                                                    <Button type="button" variant="outline" size="sm" onClick={() => setIsDeleteConfirming(false)} disabled={isSaving}>Cancel</Button>
                                                    <Button type="button" variant="destructive" size="sm" onClick={handleDeleteTeam} disabled={isSaving}>
                                                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm delete'}
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}

                            {teamPanelSection === 'managers' && (
                                <>
                                    <div>
                                        <h3 className="text-sm font-semibold">Regional managers</h3>
                                        <p className="mt-1 text-xs text-muted-foreground">Select the regional managers responsible for this team.</p>
                                    </div>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                        <Input value={managerSearchTerm} onChange={(event) => setManagerSearchTerm(event.target.value)} placeholder="Search regional managers..." className="pl-9" />
                                    </div>
                                    <div className="space-y-1 rounded-lg border p-2">
                                        {isLoadingManagers ? (
                                            <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading regional managers...</div>
                                        ) : filteredOfficeManagers.length === 0 ? (
                                            <p className="p-8 text-center text-sm text-muted-foreground">No regional managers available</p>
                                        ) : filteredOfficeManagers.map((manager) => {
                                            const checked = selectedManagerIds.includes(manager.id);
                                            return (
                                                <label key={manager.id} htmlFor={`panel-manager-${manager.id}`} className="flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2.5 hover:bg-muted/40">
                                                    <div className="flex min-w-0 items-center gap-3">
                                                        <Checkbox id={`panel-manager-${manager.id}`} checked={checked} onCheckedChange={(value) => setSelectedManagerIds((current) => value ? Array.from(new Set([...current, manager.id])) : current.filter((id) => id !== manager.id))} />
                                                        <div className="min-w-0"><p className="truncate text-sm font-medium">{getManagerName(manager)}</p><p className="text-xs text-muted-foreground">Regional Manager</p></div>
                                                    </div>
                                                    <Badge variant="outline" className="shrink-0 text-[10px]">{(manager.assignedCity ?? []).length} cities</Badge>
                                                </label>
                                            );
                                        })}
                                    </div>
                                    <div className="sticky bottom-0 flex items-center justify-between border-t bg-background py-3">
                                        <span className="text-xs text-muted-foreground">{selectedManagerIds.length} selected</span>
                                        <Button onClick={handleSaveManagers} disabled={!managerChangesAreDirty || selectedManagerIds.length === 0 || isSaving || isLoadingManagers}>
                                            {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Save regional managers'}
                                        </Button>
                                    </div>
                                </>
                            )}

                            {teamPanelSection === 'cities' && (
                                <>
                                    <div>
                                        <h3 className="text-sm font-semibold">City coverage</h3>
                                        <p className="mt-1 text-xs text-muted-foreground">Cities are assigned to the selected regional manager.</p>
                                    </div>
                                    {currentTeamManagers.length > 1 && (
                                        <div className="space-y-2">
                                            <Label className="text-xs">Regional manager</Label>
                                            <div className="flex flex-wrap gap-2">
                                                {currentTeamManagers.map((manager) => (
                                                    <Button key={manager.id} type="button" variant={selectedOfficeManagerId === manager.id ? 'default' : 'outline'} size="sm" onClick={() => { setSelectedOfficeManagerId(manager.id); setAssignedCities(manager.assignedCity ?? []); setSelectedCities([]); }}>
                                                        {getManagerName(manager)}
                                                    </Button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    <div className="space-y-2">
                                        <Label className="text-xs">Assigned cities</Label>
                                        {assignedCities.length > 0 ? (
                                            <div className="flex flex-wrap gap-2">
                                                {assignedCities.map((city) => (
                                                    <Badge key={city} variant="secondary" className="gap-1.5 py-1.5 pl-2 pr-1">
                                                        <Building2 className="h-3.5 w-3.5" />{toSentenceCase(city)}
                                                        <Button type="button" variant="ghost" size="icon" className="h-5 w-5 rounded-full text-muted-foreground hover:text-destructive" onClick={() => void confirmRemoveCity(city)} disabled={isSaving} aria-label={`Remove ${toSentenceCase(city)}`}><X className="h-3 w-3" /></Button>
                                                    </Badge>
                                                ))}
                                            </div>
                                        ) : <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No cities assigned</p>}
                                    </div>
                                    <div className="space-y-2 border-t pt-4">
                                        <Label>Add cities</Label>
                                        <Popover open={isCityPopoverOpen} onOpenChange={setIsCityPopoverOpen}>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className="w-full justify-between font-normal"><span className={selectedCities.length === 0 ? 'text-muted-foreground' : ''}>{cityTriggerLabel}</span><ChevronDown className="h-4 w-4" /></Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                                                <div className="border-b p-3"><Input placeholder="Search city..." value={citySearchTerm} onChange={(event) => setCitySearchTerm(event.target.value)} /></div>
                                                <ScrollArea className="h-64">
                                                    <div className="space-y-1 p-2">
                                                        {filteredCities.map((city) => (
                                                            <label key={city.value} htmlFor={`panel-city-${city.value}`} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 hover:bg-muted/40">
                                                                <Checkbox id={`panel-city-${city.value}`} checked={selectedCities.includes(city.value)} onCheckedChange={() => handleToggleCity(city.value)} />
                                                                <span className="truncate text-sm">{toSentenceCase(city.label)}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </ScrollArea>
                                            </PopoverContent>
                                        </Popover>
                                        <Button className="w-full" onClick={handleAssignCity} disabled={selectedCities.length === 0 || isSaving}>{isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Assigning...</> : 'Assign selected cities'}</Button>
                                    </div>
                                </>
                            )}

                            {teamPanelSection === 'officers' && panelTeam && (
                                <>
                                    <div>
                                        <h3 className="text-sm font-semibold">Field officers</h3>
                                        <p className="mt-1 text-xs text-muted-foreground">Review current members or add eligible officers.</p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs">Assigned · {panelTeam.fieldOfficers.length}</Label>
                                        {panelTeam.fieldOfficers.length > 0 ? panelTeam.fieldOfficers.map((officer) => (
                                            <div key={officer.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
                                                <div className="min-w-0"><p className="truncate text-sm font-medium">{officer.firstName} {officer.lastName}</p><p className="text-xs text-muted-foreground">{toSentenceCase(officer.role)}</p></div>
                                                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => void handleRemoveFieldOfficer(panelTeam.id, officer.id)} disabled={isSaving} aria-label={`Remove ${officer.firstName} ${officer.lastName}`}><X className="h-4 w-4" /></Button>
                                            </div>
                                        )) : <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No field officers assigned</p>}
                                    </div>
                                    <div className="space-y-2 border-t pt-4">
                                        <Label className="text-xs">Eligible officers</Label>
                                        <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border p-2">
                                            {fieldOfficers.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">No eligible officers available</p> : fieldOfficers.map((officer) => {
                                                const unavailable = officer.teamId != null;
                                                return (
                                                    <label key={officer.id} htmlFor={`panel-officer-${officer.id}`} className={`flex items-center justify-between gap-3 rounded-md px-2 py-2 ${unavailable ? 'opacity-55' : 'cursor-pointer hover:bg-muted/40'}`}>
                                                        <div className="flex min-w-0 items-center gap-3"><Checkbox id={`panel-officer-${officer.id}`} checked={selectedFieldOfficers.includes(officer.id)} disabled={unavailable} onCheckedChange={(value) => setSelectedFieldOfficers((current) => value ? [...current, officer.id] : current.filter((id) => id !== officer.id))} /><div className="min-w-0"><p className="truncate text-sm font-medium">{officer.firstName} {officer.lastName}</p><p className="text-xs text-muted-foreground">{toSentenceCase(officer.role)}</p></div></div>
                                                        {unavailable && <Badge variant="outline" className="text-[10px]">Team {officer.teamId}</Badge>}
                                                    </label>
                                                );
                                            })}
                                        </div>
                                        <Button className="w-full" onClick={handleAddFieldOfficer} disabled={selectedFieldOfficers.length === 0 || isSaving}>{isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Adding...</> : `Add selected officers${selectedFieldOfficers.length ? ` (${selectedFieldOfficers.length})` : ''}`}</Button>
                                    </div>
                                </>
                            )}

                            {modalError && <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">{modalError}</div>}
                        </div>
                    </ScrollArea>
                </SheetContent>
            </Sheet>

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
                        <DialogDescription>
                            This permanently deletes the selected team and cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
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
                <DialogContent className="sm:max-w-[520px]">
                    <DialogHeader>
                        <DialogTitle>Manage regional managers</DialogTitle>
                        <DialogDescription>Choose the regional managers assigned to Team #{selectedTeamId}.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Search regional managers..."
                                value={managerSearchTerm}
                                onChange={(event) => setManagerSearchTerm(event.target.value)}
                                className="pl-9"
                            />
                        </div>

                        <div className="rounded-md border">
                            <ScrollArea className="h-60">
                                {isLoadingManagers ? (
                                    <div className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Loading regional managers...
                                    </div>
                                ) : filteredOfficeManagers.length === 0 ? (
                                    <div className="p-6 text-center text-sm text-muted-foreground">
                                        No available regional managers found
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
                                                            <p className="truncate text-xs text-muted-foreground">Regional Manager</p>
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

                        {modalError && (
                            <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
                                <p><strong>Error:</strong> {modalError}</p>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <span className="mr-auto self-center text-xs text-muted-foreground">
                            {selectedManagerIds.length} selected
                        </span>
                        <Button variant="outline" onClick={closeManagersModal} disabled={isSaving}>
                            Cancel
                        </Button>
                        <Button onClick={handleSaveManagers} disabled={selectedManagerIds.length === 0 || isSaving || isLoadingManagers || !managerChangesAreDirty}>
                            {isSaving ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                'Save changes'
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
                        <DialogTitle>Manage team cities</DialogTitle>
                        <DialogDescription>Add or remove cities assigned to Team #{currentTeamId}.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        {currentTeamManagers.length > 1 && (
                            <div>
                                <Label className="text-sm font-medium text-foreground mb-2 block">Regional manager</Label>
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
                            <Label className="mb-2 block text-sm font-medium text-foreground">Assigned cities</Label>
                            {assignedCities.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {assignedCities.map((city, index) => (
                                        <Badge key={index} variant="secondary" className="flex items-center gap-1.5 pr-1 pl-2 py-1.5">
                                            <Building2 size={14} className="text-primary" />
                                            <span className="text-sm font-medium">{toSentenceCase(city)}</span>
                                            <Button 
                                                size="sm" 
                                                variant="ghost" 
                                                onClick={() => handleRemoveCity(city)} 
                                                className="h-5 w-5 p-0 ml-0.5 hover:bg-destructive/20 hover:text-destructive rounded-full transition-colors"
                                                disabled={isSaving}
                                                aria-label={`Remove ${toSentenceCase(city)}`}
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
                            <Label htmlFor="newCityModal">Add cities</Label>
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
                            Cancel
                        </Button>
                        <Button
                            onClick={handleAssignCity}
                            disabled={selectedCities.length === 0 || isSaving}
                        >
                            {isSaving ? (
                                <span className="inline-flex items-center">
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Assigning...
                                </span>
                            ) : (
                                'Assign cities'
                            )}
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
                        <DialogTitle>Add field officers</DialogTitle>
                        <DialogDescription>Choose active, unassigned officers for Team #{selectedTeamId}.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label className="text-sm font-medium text-foreground">Available field officers</Label>
                            <div className="space-y-2 max-h-60 overflow-y-auto mt-2">
                                {fieldOfficers.length === 0 ? (
                                    <div className="rounded-lg border border-dashed px-5 py-8 text-center">
                                        <Users className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
                                        <p className="text-sm font-medium text-foreground">No eligible officers available</p>
                                        <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
                                            Officers must be active, unassigned, and located in one of this team&apos;s cities.
                                        </p>
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
                                                                {`${officer.firstName} ${officer.lastName} (${toSentenceCase(officer.role)})`}
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
                                                                {`${officer.firstName} ${officer.lastName} (${toSentenceCase(officer.role)})`}
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
                                'Add selected officers'
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
                        <DialogDescription>
                            Review and remove field officers assigned to this team.
                        </DialogDescription>
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
                                                            size="icon"
                                                            className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                            onClick={() => showRemoveOfficerModal(team.id, officer)}
                                                            disabled={isSaving}
                                                            aria-label={`Remove ${officer.firstName} ${officer.lastName} from Team ${team.id}`}
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
                        <DialogDescription>
                            The employee will remain available and can be assigned again later.
                        </DialogDescription>
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
                        <DialogDescription>
                            Remove this city from the selected regional manager.
                        </DialogDescription>
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
                            onClick={() => void confirmRemoveCity()}
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
