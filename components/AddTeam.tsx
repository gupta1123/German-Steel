"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Loader2, Search, UsersRound, X } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { SearchableSelectOption } from "@/components/ui/searchable-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/components/auth-provider";
import { hasAdminSetupPrivileges } from "@/lib/auth";
import { buildCityOptions, mergeCityOptions, normalizeCityKey } from "@/lib/city-options";
import { getTeamManagers } from "@/lib/team-access";
import { API } from "@/lib/api";
import { useUnsavedChanges } from "@/components/unsaved-changes-provider";
import { toast } from "sonner";

interface Employee {
    id: number;
    firstName: string;
    lastName: string;
    city: string;
    role: string;
    teamId: number | null;
    status?: string;
    assignedCity?: string[] | null;
    eligibleCities?: string[];
}

interface OfficeManager {
    id: number;
    firstName: string;
    lastName: string;
    city: string;
    email: string;
    deleted?: boolean;
    role?: string;
    isOfficeManager?: boolean;
}

interface CityOption extends SearchableSelectOption {
    assignedTo: string[];
}

interface TeamSummary {
    id: number;
    office?: {
        id: number;
        firstName?: string;
        lastName?: string;
        assignedCity?: string[];
    } | null;
    officeManager?: {
        id: number;
        firstName?: string;
        lastName?: string;
        assignedCity?: string[];
    } | null;
    officeManagers?: Array<{
        id: number;
        firstName?: string;
        lastName?: string;
        assignedCity?: string[];
    }> | null;
}

// Using SearchableSelectOption from the imported component
const createCityOption = (city: string): CityOption => ({ value: city, label: city, assignedTo: [] });

type TeamSummaryManager = NonNullable<TeamSummary["officeManager"]>;

const getTeamManagersFromSummaries = (teams: TeamSummary[]) => {
    const byId = new Map<number, TeamSummaryManager>();

    teams.forEach((team) => {
        getTeamManagers(team).forEach((manager) => {
            byId.set(manager.id, manager);
        });
    });

    return Array.from(byId.values());
};

interface AddTeamProps {
    onCreated?: () => void | Promise<void>;
}

const AddTeam = ({ onCreated }: AddTeamProps) => {
    const { token: authToken, userRole, currentUser } = useAuth();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedOfficeManager, setSelectedOfficeManager] = useState<string[]>([]);
    const [selectedCities, setSelectedCities] = useState<string[]>([]);
    const [selectedEmployees, setSelectedEmployees] = useState<number[]>([]);
    const [officeManagers, setOfficeManagers] = useState<SearchableSelectOption[]>([]);
    const [cities, setCities] = useState<CityOption[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [isCreatingTeam, setIsCreatingTeam] = useState(false);
    const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
    const [isCityPopoverOpen, setIsCityPopoverOpen] = useState(false);
    const [citySearchTerm, setCitySearchTerm] = useState("");
    const [cityAssignments, setCityAssignments] = useState<Record<string, string[]>>({});
    const [assigningEmployeeCities, setAssigningEmployeeCities] = useState<string[]>([]);
    const [modalError, setModalError] = useState<string | null>(null);

    const teamDraftIsDirty = isModalOpen && (
        selectedOfficeManager.length > 0 ||
        selectedCities.length > 0 ||
        selectedEmployees.length > 0
    );
    const { requestDiscard } = useUnsavedChanges(teamDraftIsDirty);

    const canManageTeamSetup = hasAdminSetupPrivileges(userRole, currentUser);
    const token = authToken ?? (typeof window !== 'undefined' ? localStorage.getItem('authToken') : null);


    const toSentenceCase = (value: string | null | undefined) => {
        if (!value) return '';
        return value
            .toLowerCase()
            .split(' ')
            .filter(Boolean)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    useEffect(() => {
        if (!isModalOpen) {
            resetForm();
        }
    }, [isModalOpen]);

    const resetForm = () => {
        setSelectedOfficeManager([]);
        setSelectedCities([]);
        setSelectedEmployees([]);
        setEmployees([]);
        setCitySearchTerm("");
        setAssigningEmployeeCities([]);
        setModalError(null);
    };

    const requestCloseModal = () => {
        requestDiscard(() => setIsModalOpen(false), teamDraftIsDirty);
    };

    const fetchOfficeManagers = useCallback(async () => {
        try {
            const [allEmployeesData, teamsResponse] = await Promise.all([
                API.getAllEmployees<OfficeManager>(),
                fetch(
                    "http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/employee/team/getAll",
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }
                ),
            ]);

            if (!teamsResponse.ok) {
                throw new Error('Failed to fetch team assignments');
            }
            const teamsData = await teamsResponse.json();

            const teams = teamsData as TeamSummary[];
            const assignedManagerIds = getTeamManagersFromSummaries(teams).map((manager) => manager.id);

            const assignments: Record<string, string[]> = {};
            teams.forEach((team) => {
                getTeamManagers(team).forEach((manager) => {
                    if (!manager?.assignedCity) return;
                    const managerName = [manager.firstName, manager.lastName].filter(Boolean).join(' ').trim() || `Team ${team.id}`;
                    manager.assignedCity.forEach((city) => {
                        const key = normalizeCityKey(city);
                        if (!key) return;
                        assignments[key] = Array.from(new Set([...(assignments[key] ?? []), managerName]));
                    });
                });
            });
            setCityAssignments(assignments);

            const employeeCityOptions = buildCityOptions<CityOption>(
                allEmployeesData.map((employee: OfficeManager) => employee.city),
                createCityOption
            );
            const assignedCityOptions = buildCityOptions<CityOption>(
                teams.flatMap((team) => getTeamManagers(team).flatMap((manager) => manager.assignedCity ?? [])),
                createCityOption
            );
            setCities((prev) => mergeCityOptions(prev, employeeCityOptions, assignedCityOptions));
            
            const deletedManagerIds = allEmployeesData
                .filter((employee: OfficeManager) => employee.isOfficeManager === true && employee.deleted)
                .map((employee: OfficeManager) => employee.id);
            
            const availableManagers = allEmployeesData
                .filter((employee: OfficeManager) =>
                    employee.isOfficeManager === true &&
                    !assignedManagerIds.includes(employee.id) &&
                    !deletedManagerIds.includes(employee.id)
                )
                .sort((a: OfficeManager, b: OfficeManager) => 
                    `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
                )
                .map((manager: OfficeManager) => ({
                    value: manager.id.toString(),
                    label: `${manager.firstName} ${manager.lastName}`
                }));

            setOfficeManagers(availableManagers);
        } catch (error) {
            console.error("Error fetching managers:", error);
        }
    }, [token]);
   
    // Office manager selection is now handled by SearchableSelect component

    const fetchCities = useCallback(async () => {
        try {
            console.log('=== FETCHING CITIES ===');
            const response = await fetch(
                "http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/employee/getCities",
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );
            const data = await response.json();
            console.log('Cities data:', data);

            const sortedCities = buildCityOptions<CityOption>(data, createCityOption);

            console.log('Sorted cities:', sortedCities);
            setCities((prev) => mergeCityOptions(prev, sortedCities));
        } catch (error) {
            console.error("Error fetching cities:", error);
        }
    }, [token]);

    const filteredCities = useMemo(() => {
        const query = citySearchTerm.trim().toLowerCase();
        let filtered = cities;
        
        // Filter by search query
        if (query) {
            filtered = filtered.filter((city) => city.label.toLowerCase().includes(query));
        }

        return filtered;
    }, [cities, citySearchTerm]);

    const cityTriggerLabel = useMemo(() => {
        if (selectedCities.length === 0) return "Select cities";
        if (selectedCities.length === 1) return toSentenceCase(selectedCities[0]);
        return `${selectedCities.length} cities selected`;
    }, [selectedCities]);

    useEffect(() => {
        if (isModalOpen && token) {
            console.log('=== MODAL OPENED ===');
            console.log('Modal open:', isModalOpen);
            console.log('Token present:', !!token);
            fetchOfficeManagers();
            fetchCities();
        }
    }, [isModalOpen, token, fetchOfficeManagers, fetchCities]);

    // Debug effect to track SearchableSelect data
    useEffect(() => {
        if (isModalOpen) {
            console.log('=== SEARCHABLE SELECT DATA DEBUG ===');
            console.log('Office managers for select:', {
                count: officeManagers.length,
                data: officeManagers,
                selected: selectedOfficeManager
            });
            console.log('Cities for select:', {
                count: cities.length,
                data: cities,
                selected: selectedCities
            });
        }
    }, [isModalOpen, officeManagers, cities, selectedOfficeManager, selectedCities]);

    const fetchEmployeesByCities = useCallback(async (cities: string[]) => {
        if (cities.length === 0) {
            setEmployees([]);
            return;
        }

        try {
            setIsLoadingEmployees(true);
            const promises = cities.map(city =>
                fetch(
                    `http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/employee/getFieldOfficerByCity?city=${encodeURIComponent(city)}`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }
                )
            );

            const responses = await Promise.all(promises);
            const failedResponse = responses.find((response) => !response.ok);
            if (failedResponse) {
                throw new Error(await failedResponse.text() || 'Failed to load field officers');
            }
            const allEmployeesData = await Promise.all(responses.map(r => r.json()));
            // Flatten and de-duplicate employees by id across cities
            const merged: Record<number, Employee> = {};
            allEmployeesData.forEach((cityEmployees: Employee[], index: number) => {
                const sourceCity = cities[index];
                cityEmployees.forEach((employee: Employee) => {
                    if (!merged[employee.id]) {
                        merged[employee.id] = { ...employee, eligibleCities: [sourceCity] };
                    } else {
                        merged[employee.id].eligibleCities = Array.from(
                            new Set([...(merged[employee.id].eligibleCities ?? []), sourceCity])
                        );
                    }
                });
            });

            const allEmployees = Object.values(merged)
                .filter((employee: Employee) => employee.role === "Field Officer");

            setEmployees(allEmployees);
        } catch (error) {
            console.error(`Error fetching employees for cities ${cities.join(", ")}:`, error);
        }
        finally {
            setIsLoadingEmployees(false);
        }
    }, [token]);

    useEffect(() => {
        if (!isModalOpen || !token) return;
        fetchEmployeesByCities(selectedCities);
    }, [fetchEmployeesByCities, isModalOpen, selectedCities, token]);

    const assignCitiesToManagers = async (managerIds: number[]) => {
        await Promise.all(managerIds.flatMap((managerId) => selectedCities.map(async (city) => {
            const response = await fetch(
                `http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/employee/assignCity?id=${managerId}&city=${encodeURIComponent(city)}`,
                {
                    method: 'PUT',
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            if (!response.ok) {
                throw new Error(`Failed to assign city ${city}`);
            }
        })));
    };

    const isEmployeeAssignedToAnEligibleCity = (employee: Employee) => {
        const assignedKeys = new Set((employee.assignedCity ?? []).map(normalizeCityKey));
        return (employee.eligibleCities ?? []).some((city) => assignedKeys.has(normalizeCityKey(city)));
    };

    const assignCityToEmployee = async (employeeId: number, city: string) => {
        if (!token) return;
        const assignmentKey = `${employeeId}:${normalizeCityKey(city)}`;
        setAssigningEmployeeCities((current) => [...current, assignmentKey]);
        setModalError(null);

        try {
            await API.assignEmployeeCity(employeeId, city);
            setEmployees((current) => current.map((employee) => {
                if (employee.id !== employeeId) return employee;
                const assignedCity = Array.from(new Set([...(employee.assignedCity ?? []), city]));
                return { ...employee, assignedCity };
            }));
        } catch (error) {
            setModalError(error instanceof Error ? error.message : `Failed to assign ${city}`);
        } finally {
            setAssigningEmployeeCities((current) => current.filter((key) => key !== assignmentKey));
        }
    };

    const handleCreateTeam = async () => {
        console.log('=== CREATING TEAM ===');
        console.log('Selected office manager:', selectedOfficeManager);
        console.log('Selected employees:', selectedEmployees);

        if (selectedOfficeManager.length === 0) {
            console.log('No office manager selected');
            return;
        }

        if (selectedCities.length === 0) {
            console.log('No cities selected');
            return;
        }

        if (!token) {
            console.log('No auth token found');
            return;
        }

        if (selectedEmployees.length === 0) {
            console.log('No employees selected');
            return;
        }

        try {
            setIsCreatingTeam(true);
            const activeSelected = selectedEmployees.filter(id =>
                employees.some(e =>
                    e.id === id &&
                    String(e.status || '').toLowerCase() === 'active' &&
                    e.teamId === null &&
                    isEmployeeAssignedToAnEligibleCity(e)
                )
            );
            if (activeSelected.length === 0) {
                console.log('No unassigned active employees selected');
                return;
            }

            const managerIds = selectedOfficeManager
                .map((id) => parseInt(id, 10))
                .filter((id) => Number.isFinite(id));

            if (managerIds.length === 0) {
                console.log('No valid office managers selected');
                return;
            }

            await assignCitiesToManagers(managerIds);

            const requestBody = {
                officeManager: managerIds[0],
                officeManagers: managerIds,
                fieldOfficers: activeSelected,
            };

            console.log('Team creation request body:', requestBody);

            const response = await fetch(
                "http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/employee/team/create",
                {
                    method: 'POST',
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify(requestBody),
                }
            );

            console.log('Team creation response status:', response.status);

            if (response.ok) {
                await onCreated?.();
                setIsModalOpen(false);
                resetForm();
                toast.success('Team created', { duration: 3000 });
            } else {
                const errorText = await response.text();
                throw new Error(errorText || `Team creation failed (${response.status})`);
            }
        } catch (error) {
            console.error("Error creating team:", error);
            const message = error instanceof Error ? error.message : 'Failed to create team';
            setModalError(message);
            toast.error(message, { duration: 3000 });
        } finally {
            setIsCreatingTeam(false);
        }
    };

    // City selection is now handled by SearchableSelect component

    const handleToggleCity = (cityValue: string) => {
        setSelectedCities((prev) =>
            prev.includes(cityValue)
                ? prev.filter((value) => value !== cityValue)
                : [...prev, cityValue]
        );
    };

    const handleEmployeeToggle = (employeeId: number) => {
        const employee = employees.find(e => e.id === employeeId);
        const isActive = String(employee?.status || '').toLowerCase() === 'active';
        const isUnassigned = employee?.teamId === null;
        const hasCityAssignment = employee ? isEmployeeAssignedToAnEligibleCity(employee) : false;
        if (!isActive) return; // guard
        if (!isUnassigned) return;
        if (!hasCityAssignment) return;
        setSelectedEmployees(prev => 
            prev.includes(employeeId) 
                ? prev.filter(id => id !== employeeId)
                : [...prev, employeeId]
        );
    };

    if (!canManageTeamSetup) {
        return null;
    }

    return (
        <>
            <Button size="sm" className="gap-2" onClick={() => {
                console.log('=== ADD TEAM BUTTON CLICKED ===');
                console.log('Current state:', {
                    selectedOfficeManager,
                    selectedCities,
                    officeManagersCount: officeManagers.length,
                    citiesCount: cities.length
                });
                setIsModalOpen(true);
            }}><UsersRound className="h-4 w-4" />Add team</Button>
            <Sheet open={isModalOpen} onOpenChange={(open) => {
                if (open) setIsModalOpen(true);
                else requestCloseModal();
            }}>
                <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-xl">
                    <SheetHeader className="sticky top-0 z-10 border-b bg-background px-5 py-4 pr-12">
                        <SheetTitle className="text-lg">Create team</SheetTitle>
                        <SheetDescription className="text-xs">Build the team by assigning ownership, coverage, and members.</SheetDescription>
                    </SheetHeader>
                    <div className="space-y-4 p-5 pb-0">
                    <div className="space-y-4">
                        {/* Left Pane: Manager and Cities */}
                        <div className="space-y-4">
                            <section className="rounded-xl border bg-card p-4">
                                <div className="flex items-start gap-3">
                                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">1</span>
                                    <div>
                                        <h3 className="text-sm font-semibold text-foreground">Regional managers</h3>
                                        <p className="mt-0.5 text-xs text-muted-foreground">Choose the regional managers who will own and coordinate this team.</p>
                                    </div>
                                </div>
                                <div className="mt-3 rounded-lg border">
                                    <ScrollArea className="h-36">
                                        {officeManagers.length === 0 ? (
                                            <div className="flex h-36 flex-col items-center justify-center px-5 text-center">
                                                <UsersRound className="mb-2 h-5 w-5 text-muted-foreground" />
                                                <p className="text-sm font-medium text-foreground">No regional managers available</p>
                                                <p className="mt-1 text-xs text-muted-foreground">Every eligible regional manager is already assigned to a team.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-1 p-2">
                                                {officeManagers.map((manager) => {
                                                    const checked = selectedOfficeManager.includes(manager.value);
                                                    return (
                                                        <label
                                                            key={manager.value}
                                                            htmlFor={`office-manager-${manager.value}`}
                                                            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 hover:bg-muted/50"
                                                        >
                                                            <Checkbox
                                                                id={`office-manager-${manager.value}`}
                                                                checked={checked}
                                                                onCheckedChange={(isChecked) => {
                                                                    setSelectedOfficeManager((prev) =>
                                                                        isChecked
                                                                            ? Array.from(new Set([...prev, manager.value]))
                                                                            : prev.filter((id) => id !== manager.value)
                                                                    );
                                                                }}
                                                            />
                                                            <span className="text-sm">{manager.label}</span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </ScrollArea>
                                </div>
                                {selectedOfficeManager.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {selectedOfficeManager.map((managerId) => {
                                            const manager = officeManagers.find((item) => item.value === managerId);
                                            return (
                                                <Badge key={managerId} variant="secondary" className="text-xs">
                                                    {manager?.label ?? `Regional Manager ${managerId}`}
                                                </Badge>
                                            );
                                        })}
                                    </div>
                                )}
                            </section>

                            <section className="rounded-xl border bg-card p-4">
                                <div className="flex items-start gap-3">
                                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">2</span>
                                    <div>
                                        <h3 className="text-sm font-semibold text-foreground">City coverage</h3>
                                        <p className="mt-0.5 text-xs text-muted-foreground">Select the cities this team will be responsible for.</p>
                                    </div>
                                </div>
                                {selectedCities.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-2">
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
                                            className="mt-3 w-full justify-between text-left font-normal"
                                        >
                                            <span className={selectedCities.length === 0 ? "text-muted-foreground" : ""}>
                                                {cityTriggerLabel}
                                            </span>
                                            <Search className="h-4 w-4 text-muted-foreground" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[calc(100vw-3rem)] p-0 sm:w-[520px]" align="start">
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
                                        <ScrollArea className="h-64 pr-2">
                                            {cities.length === 0 ? (
                                                <div className="p-4 text-sm text-muted-foreground">
                                                    No cities available
                                                </div>
                                            ) : filteredCities.length === 0 ? (
                                                <div className="p-4 text-sm text-muted-foreground">
                                                    No matches found
                                                </div>
                                            ) : (
                                                <div className="p-1 space-y-1">
                                                    {filteredCities.map((city) => {
                                                        const assignedNames = cityAssignments[normalizeCityKey(city.value)] ?? [];

                                                        return (
                                                            <div
                                                                key={city.value}
                                                                className="grid grid-cols-[auto_minmax(120px,1fr)] items-center gap-x-3 gap-y-2 rounded-md px-3 py-2 hover:bg-muted/40 sm:grid-cols-[auto_minmax(160px,1fr)_minmax(260px,auto)]"
                                                            >
                                                                <Checkbox
                                                                    id={`city-${city.value}`}
                                                                    checked={selectedCities.includes(city.value)}
                                                                    onCheckedChange={() => handleToggleCity(city.value)}
                                                                />
                                                                <label
                                                                    htmlFor={`city-${city.value}`}
                                                                    className="min-w-0 cursor-pointer text-sm"
                                                                >
                                                                    {toSentenceCase(city.label)}
                                                                </label>
                                                                {assignedNames.length > 0 && (
                                                                    <Badge variant="outline" className="col-start-2 h-auto min-h-6 w-fit max-w-full whitespace-normal break-words px-2 py-1 text-left text-[10px] font-normal leading-snug sm:col-start-auto sm:max-w-[360px]">
                                                                        Assigned to {assignedNames.join(', ')}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </ScrollArea>
                                    </PopoverContent>
                                </Popover>
                                <p className="mt-2 text-xs text-muted-foreground">
                                    Coverage is saved when the team is created.
                                </p>
                            </section>
                        </div>

                        {/* Right Pane: Employees (Shown after selecting cities) */}
                        <section className="space-y-3 rounded-xl border bg-card p-4">
                            <div className="flex items-start gap-3">
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">3</span>
                                <div>
                                    <h3 className="text-sm font-semibold text-foreground">Field officers</h3>
                                    <p className="mt-0.5 text-xs text-muted-foreground">Choose active, unassigned officers from the selected cities.</p>
                                </div>
                            </div>
                            {selectedCities.length === 0 ? (
                                <div className="flex h-28 items-center justify-center rounded-lg border border-dashed bg-muted/15 px-6 text-center text-sm text-muted-foreground">
                                    Select city coverage first to see eligible field officers.
                                </div>
                            ) : isLoadingEmployees ? (
                                <div className="max-h-72 space-y-3 overflow-y-auto">
                                    {Array.from({ length: 6 }).map((_, i) => (
                                        <div key={i} className="flex items-center justify-between p-2 rounded-md">
                                            <div className="flex items-center gap-2">
                                                <Skeleton className="h-4 w-4 rounded" />
                                                <Skeleton className="h-4 w-48" />
                                            </div>
                                            <Skeleton className="h-5 w-16" />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="max-h-72 space-y-4 overflow-y-auto pr-1">
                                    {(() => {
                                        const fullName = (e: Employee) => `${e.firstName} ${e.lastName}`.trim().toLowerCase();
                                        const activeAvailable = employees
                                            .filter(e => String(e.status || '').toLowerCase() === 'active' && e.teamId === null)
                                            .sort((a, b) => fullName(a).localeCompare(fullName(b)));
                                        const activeAssigned = employees
                                            .filter(e => String(e.status || '').toLowerCase() === 'active' && e.teamId !== null)
                                            .sort((a, b) => fullName(a).localeCompare(fullName(b)));
                                        const inactive = employees
                                            .filter(e => String(e.status || '').toLowerCase() !== 'active')
                                            .sort((a, b) => fullName(a).localeCompare(fullName(b)));
                                        return (
                                            <>
                                                <div>
                                                    <div className="text-xs font-medium text-muted-foreground mb-2">Available Active Officers</div>
                                                    {activeAvailable.length === 0 ? (
                                                        <div className="text-xs text-muted-foreground">No unassigned active officers found</div>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            {activeAvailable.map((employee) => {
                                                                const assignedKeys = new Set((employee.assignedCity ?? []).map(normalizeCityKey));
                                                                const eligibleCities = employee.eligibleCities ?? [];
                                                                const missingCities = eligibleCities.filter(
                                                                    (city) => !assignedKeys.has(normalizeCityKey(city))
                                                                );
                                                                const canSelect = isEmployeeAssignedToAnEligibleCity(employee);

                                                                return (
                                                                    <div key={employee.id} className="space-y-2 rounded-md p-2 hover:bg-muted/50">
                                                                        <div className="flex items-center justify-between gap-2">
                                                                            <div className="flex min-w-0 items-center">
                                                                                <Checkbox
                                                                                    id={`employee-${employee.id}`}
                                                                                    checked={selectedEmployees.includes(employee.id)}
                                                                                    disabled={!canSelect}
                                                                                    onCheckedChange={() => handleEmployeeToggle(employee.id)}
                                                                                />
                                                                                <label htmlFor={`employee-${employee.id}`} className="ml-2 text-sm truncate">
                                                                                    {toSentenceCase(`${employee.firstName} ${employee.lastName}`)}
                                                                                </label>
                                                                            </div>
                                                                            {!canSelect && (
                                                                                <Badge variant="outline" className="shrink-0 border-amber-500/60 text-amber-600">
                                                                                    City not assigned
                                                                                </Badge>
                                                                            )}
                                                                        </div>

                                                                        {missingCities.length > 0 && (
                                                                            <div className="flex flex-wrap gap-2 pl-6">
                                                                                {missingCities.map((city) => {
                                                                                    const assignmentKey = `${employee.id}:${normalizeCityKey(city)}`;
                                                                                    const isAssigning = assigningEmployeeCities.includes(assignmentKey);
                                                                                    return (
                                                                                        <Button
                                                                                            key={city}
                                                                                            type="button"
                                                                                            variant="outline"
                                                                                            size="sm"
                                                                                            className="h-7 border-amber-500/40 text-xs"
                                                                                            disabled={isAssigning}
                                                                                            onClick={() => assignCityToEmployee(employee.id, city)}
                                                                                        >
                                                                                            {isAssigning && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                                                                                            Assign {toSentenceCase(city)}
                                                                                        </Button>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="pt-2 border-t">
                                                    <div className="text-xs font-medium text-muted-foreground mb-2">Already Assigned</div>
                                                    {activeAssigned.length === 0 ? (
                                                        <div className="text-xs text-muted-foreground">No assigned active officers in selected cities</div>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            {activeAssigned.map((employee) => (
                                                                <div key={employee.id} className="flex items-center justify-between gap-2 p-2 rounded-md opacity-80">
                                                                    <div className="flex min-w-0 items-center">
                                                                        <Checkbox
                                                                            id={`employee-assigned-${employee.id}`}
                                                                            checked={false}
                                                                            disabled
                                                                        />
                                                                        <label htmlFor={`employee-assigned-${employee.id}`} className="ml-2 text-sm truncate">
                                                                            {toSentenceCase(`${employee.firstName} ${employee.lastName}`)}
                                                                        </label>
                                                                    </div>
                                                                    <Badge variant="outline" className="shrink-0 text-xs">
                                                                        Team {employee.teamId}
                                                                    </Badge>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="pt-2 border-t">
                                                    <div className="text-xs font-medium text-muted-foreground mb-2">Inactive</div>
                                                    {inactive.length === 0 ? (
                                                        <div className="text-xs text-muted-foreground">No inactive officers</div>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            {inactive.map((employee) => (
                                                                <div key={employee.id} className="flex items-center justify-between p-2 rounded-md">
                                                                    <div className="flex items-center min-w-0">
                                                                        <div className="w-4 h-4 mr-2" />
                                                                        <span className="ml-2 text-sm truncate">
                                                                            {toSentenceCase(`${employee.firstName} ${employee.lastName}`)}
                                                                        </span>
                                                                    </div>
                                                                    <Badge variant="destructive" className="text-xs">Inactive</Badge>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>
                            )}
                        </section>
                    </div>
                    {modalError && (
                        <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                            {modalError}
                        </div>
                    )}
                    <div className="sticky bottom-0 -mx-5 mt-5 flex items-center justify-between gap-3 border-t bg-background/95 px-5 py-4 backdrop-blur">
                        <p className="text-xs text-muted-foreground">
                            {selectedOfficeManager.length} regional manager{selectedOfficeManager.length === 1 ? '' : 's'} · {selectedCities.length} cit{selectedCities.length === 1 ? 'y' : 'ies'} · {selectedEmployees.length} officer{selectedEmployees.length === 1 ? '' : 's'}
                        </p>
                        <div className="flex shrink-0 gap-2">
                        <Button variant="outline" onClick={requestCloseModal}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCreateTeam}
                            disabled={
                                isCreatingTeam ||
                                selectedOfficeManager.length === 0 ||
                                selectedCities.length === 0 ||
                                selectedEmployees.filter(id =>
                                    employees.some(e =>
                                        e.id === id &&
                                        String(e.status || '').toLowerCase() === 'active' &&
                                        e.teamId === null &&
                                        isEmployeeAssignedToAnEligibleCity(e)
                                    )
                                ).length === 0
                            }
                        >
                            {isCreatingTeam ? (
                                <span className="inline-flex items-center">
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creating...
                                </span>
                            ) : (
                                "Create team"
                            )}
                        </Button>
                        </div>
                    </div>
                    </div>
                </SheetContent>
            </Sheet>
        </>
    );
};

export default AddTeam;
