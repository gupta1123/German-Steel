"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuCheckboxItem,
    DropdownMenuTrigger,
    DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, ChevronDown, ChevronUp, Phone, User, DollarSign, Target, Filter, X, Download, Columns, MoreHorizontal, ChevronLeft, ChevronRight, Briefcase, Cake } from "lucide-react";
import { format } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";
import { API, type StoreDto, type StoreResponse, type TeamDataDto, type EmployeeUserDto, type ClientTypeDto, type LocationMasterDto } from "@/lib/api";
import { formatCityLabel } from "@/lib/city-options";
import { formatClientTypeLabel } from "@/lib/client-type-label";
import { isAdminEmployee } from "@/lib/employee-role";
import AddCustomerModal from "@/components/AddCustomerModal";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/auth-provider";
import { isManagerRoleValue, normalizeRoleValue, getCorrectedRoleFlags } from "@/lib/auth";
import { getTeamIds, getUniqueFieldOfficersFromTeams, getUniqueManagersFromTeams } from "@/lib/team-access";
import { formatDateToUserFriendly } from "@/lib/utils";
import { useGuardedRouter } from "@/components/unsaved-changes-provider";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select2";

const CUSTOMER_LIST_STORAGE_KEY = "customers.list.state.v1";

export default function CustomerListPage() {
    return <CustomerListContent />;
}

type Customer = StoreDto & {
    storeId: number;
    clientFirstName: string;
    clientLastName: string;
    employeeName: string;
    totalVisitCount: number;
};

type CustomerFilters = {
    storeName: string;
    primaryContact: string;
    ownerName: string;
    city: string;
    state: string;
    clientType: string;
    employeeName: string;
};

function Ellipsis({ value }: { value: React.ReactNode }) {
    const title = typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
    return (
        <span className="block min-w-0 truncate" title={title}>
            {value}
        </span>
    );
}

const TEAM_CUSTOMER_PAGE_SIZE = 1000;
const CUSTOMER_FILTER_DEBOUNCE_MS = 300;

const buildFilterOptions = (
    values: Array<string | null | undefined>,
    allLabel: string,
    formatLabel: (value: string) => string = (value) => value,
): SearchableOption[] => {
    const uniqueValues = new Map<string, string>();

    values.forEach((value) => {
        const trimmedValue = value?.trim();
        if (!trimmedValue) return;

        const normalizedValue = trimmedValue.toLocaleLowerCase();
        if (!uniqueValues.has(normalizedValue)) uniqueValues.set(normalizedValue, trimmedValue);
    });

    const options = Array.from(uniqueValues.values())
        .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }))
        .map((value) => ({ value, label: formatLabel(value) }));

    return [{ value: 'all', label: allLabel }, ...options];
};

const normalizeSearchValue = (value: unknown) => String(value ?? '').trim().toLocaleLowerCase();

const matchesCustomerFilters = (store: StoreDto, filters: CustomerFilters) => {
    const ownerName = [store.clientFirstName, store.clientLastName].filter(Boolean).join(' ');
    const phoneFilter = filters.primaryContact.replace(/\D/g, '');
    const phone = String(store.primaryContact ?? '').replace(/\D/g, '');

    return (
        (!filters.storeName || normalizeSearchValue(store.storeName).includes(normalizeSearchValue(filters.storeName))) &&
        (!filters.ownerName || normalizeSearchValue(ownerName).includes(normalizeSearchValue(filters.ownerName))) &&
        (!filters.city || normalizeSearchValue(store.city).includes(normalizeSearchValue(filters.city))) &&
        (!filters.state || normalizeSearchValue(store.state).includes(normalizeSearchValue(filters.state))) &&
        (!filters.clientType || normalizeSearchValue(store.clientType).includes(normalizeSearchValue(filters.clientType))) &&
        (!filters.employeeName || normalizeSearchValue(store.employeeName).includes(normalizeSearchValue(filters.employeeName))) &&
        (!phoneFilter || phone.includes(phoneFilter))
    );
};

const hasBirthdayOn = (store: StoreDto, date: Date) => {
    const dob = store.dateOfBirth || store.dob;
    if (!dob) return false;

    const datePart = dob.split('T')[0];
    const parts = datePart.split('-').map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return false;

    return parts[1] === date.getMonth() + 1 && parts[2] === date.getDate();
};

const getStoreSortValue = (store: StoreDto, sortColumn: string): string | number => {
    switch (sortColumn) {
        case 'ownerFirstName':
            return [store.clientFirstName, store.clientLastName].filter(Boolean).join(' ');
        case 'visitCount':
            return store.totalVisitCount ?? 0;
        case 'lastVisitDate':
            return store.lastVisitDate ?? '';
        case 'city':
            return store.city ?? '';
        case 'state':
            return store.state ?? '';
        case 'primaryContact':
            return store.primaryContact ?? '';
        case 'monthlySale':
            return store.monthlySale ?? 0;
        case 'intent':
            return store.intent ?? 0;
        case 'employeeName':
            return store.employeeName ?? '';
        case 'clientType':
            return store.clientType ?? '';
        case 'storeName':
        default:
            return store.storeName ?? '';
    }
};

const sortStores = (stores: StoreDto[], sortColumn: string, sortDirection: 'asc' | 'desc') => {
    return [...stores].sort((a, b) => {
        const aValue = getStoreSortValue(a, sortColumn);
        const bValue = getStoreSortValue(b, sortColumn);
        const comparison =
            typeof aValue === 'number' && typeof bValue === 'number'
                ? aValue - bValue
                : String(aValue).localeCompare(String(bValue), undefined, { sensitivity: 'base', numeric: true });

        return sortDirection === 'asc' ? comparison : -comparison;
    });
};

const createStoreResponse = (
    stores: StoreDto[],
    currentPage: number,
    pageSize: number,
): StoreResponse => {
    const totalPages = Math.max(1, Math.ceil(stores.length / pageSize));
    const safePage = Math.min(Math.max(currentPage, 1), totalPages);
    const startIndex = (safePage - 1) * pageSize;
    const content = stores.slice(startIndex, startIndex + pageSize);

    return {
        content,
        pageable: {
            pageNumber: safePage - 1,
            pageSize,
            sort: { empty: false, sorted: true, unsorted: false },
            offset: startIndex,
            paged: true,
            unpaged: false,
        },
        totalPages,
        totalElements: stores.length,
        last: safePage >= totalPages,
        size: pageSize,
        number: safePage - 1,
        sort: { empty: false, sorted: true, unsorted: false },
        numberOfElements: content.length,
        first: safePage === 1,
        empty: content.length === 0,
    };
};

const getAllStoresForTeam = async (teamId: number): Promise<StoreDto[]> => {
    const firstPage = await API.getStoresForTeam(teamId, 0, TEAM_CUSTOMER_PAGE_SIZE);
    if (firstPage.totalPages <= 1) return firstPage.content ?? [];

    const remainingPages = await Promise.all(
        Array.from({ length: firstPage.totalPages - 1 }, (_, index) =>
            API.getStoresForTeam(teamId, index + 1, TEAM_CUSTOMER_PAGE_SIZE),
        ),
    );

    return [firstPage, ...remainingPages].flatMap((response) => response.content ?? []);
};

function CustomerListContent() {
    const router = useGuardedRouter();
    const hasHydratedRef = useRef(false);
    const customerRequestIdRef = useRef(0);
    const [isStateHydrated, setIsStateHydrated] = useState(false);
    const { token, userData, userRole, currentUser, teamId: authTeamId, correctedRoleFlags } = useAuth();
    const [selectedColumns, setSelectedColumns] = useState<string[]>([
        'shopName', 'ownerName', 'city', 'state', 'phone', 'monthlySales', 'intentLevel', 'fieldOfficer',
        'clientType', 'totalVisits', 'lastVisitDate',
    ]);
    const [desktopFilters, setDesktopFilters] = useState<CustomerFilters>({
        storeName: '',
        primaryContact: '',
        ownerName: '',
        city: '',
        state: '',
        clientType: '',
        employeeName: '',
    });
    const [mobileFilters, setMobileFilters] = useState<CustomerFilters>({
        storeName: '',
        primaryContact: '',
        ownerName: '',
        city: '',
        state: '',
        clientType: '',
        employeeName: '',
    });
    const [isDesktopFilterExpanded, setIsDesktopFilterExpanded] = useState(false);
    const [isMobileFilterExpanded, setIsMobileFilterExpanded] = useState(false);
    const [expandedCards, setExpandedCards] = useState<number[]>([]);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [pageSize, setPageSize] = useState<number>(10);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [sortColumn, setSortColumn] = useState<string>('storeName');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [isExporting, setIsExporting] = useState<boolean>(false);
    const [exportMessage, setExportMessage] = useState<string>('Please wait, downloading...');
    const [customers, setCustomers] = useState<Customer[]>([]);
   const [totalPages, setTotalPages] = useState<number>(1);
   const [isLoading, setIsLoading] = useState<boolean>(true);
   const [error, setError] = useState<string | null>(null);
    const [employees, setEmployees] = useState<EmployeeUserDto[]>([]);
    const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
    const [locationStates, setLocationStates] = useState<LocationMasterDto[]>([]);
    const [clientTypes, setClientTypes] = useState<ClientTypeDto[]>([]);
    const [filterSourceCustomers, setFilterSourceCustomers] = useState<StoreDto[]>([]);
    const [isLoadingFilterOptions, setIsLoadingFilterOptions] = useState(false);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("all");
    const [mobileSelectedEmployeeId, setMobileSelectedEmployeeId] = useState<string>("all");
    
    // State for role checking
    const [isManager, setIsManager] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isFieldOfficer, setIsFieldOfficer] = useState(false);
    const [teamId, setTeamId] = useState<number | null>(null);
    const [teamIds, setTeamIds] = useState<number[]>([]);
    const [scopedEmployeeIds, setScopedEmployeeIds] = useState<number[]>([]);
    const [teamLoading, setTeamLoading] = useState(false);
    const [teamError, setTeamError] = useState<string | null>(null);
    const [isRoleDetermined, setIsRoleDetermined] = useState(false);
    const [birthdayToday, setBirthdayToday] = useState<boolean>(false);

    // Mock auth data - replace with actual auth context
    const employeeId = typeof window !== 'undefined' ? localStorage.getItem('employeeId') : null;
    const role = typeof window !== 'undefined' ? localStorage.getItem('role') : null;

    useEffect(() => {
        let isMounted = true;

        const loadEmployees = async () => {
            try {
                setIsLoadingEmployees(true);
                const data = await API.getAllEmployees();
                if (!isMounted) {
                    return;
                }
                setEmployees(data);
            } catch (error) {
                console.error('Failed to load employees:', error);
            } finally {
                if (isMounted) {
                    setIsLoadingEmployees(false);
                }
            }
        };

        loadEmployees();

        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        let isMounted = true;

        const loadCustomerMasters = async () => {
            setIsLoadingFilterOptions(true);
            const [statesResult, clientTypesResult] = await Promise.allSettled([
                API.getLocationStates(),
                API.getClientTypes(),
            ]);

            if (!isMounted) return;

            if (statesResult.status === 'fulfilled') {
                setLocationStates(statesResult.value);
            } else {
                console.error('Failed to load customer state filter options:', statesResult.reason);
            }

            if (clientTypesResult.status === 'fulfilled') {
                setClientTypes(clientTypesResult.value);
            } else {
                console.error('Failed to load customer type filter options:', clientTypesResult.reason);
            }

            setIsLoadingFilterOptions(false);
        };

        loadCustomerMasters();
        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        if (hasHydratedRef.current) {
            setIsStateHydrated(true);
            return;
        }

        hasHydratedRef.current = true;

        try {
            const storedState = sessionStorage.getItem(CUSTOMER_LIST_STORAGE_KEY);
            if (storedState) {
                const parsed = JSON.parse(storedState) as {
                    selectedColumns?: string[];
                    desktopFilters?: typeof desktopFilters;
                    mobileFilters?: typeof mobileFilters;
                    isDesktopFilterExpanded?: boolean;
                    isMobileFilterExpanded?: boolean;
                    expandedCards?: number[];
                    currentPage?: number;
                    pageSize?: number;
                    sortColumn?: string;
                    sortDirection?: 'asc' | 'desc';
                    selectedEmployeeId?: string;
                    mobileSelectedEmployeeId?: string;
                };

                if (Array.isArray(parsed.selectedColumns) && parsed.selectedColumns.length > 0) {
                    setSelectedColumns(parsed.selectedColumns);
                }

                if (parsed.desktopFilters && typeof parsed.desktopFilters === 'object') {
                    setDesktopFilters((prev) => ({ ...prev, ...parsed.desktopFilters }));
                }

                if (parsed.mobileFilters && typeof parsed.mobileFilters === 'object') {
                    setMobileFilters((prev) => ({ ...prev, ...parsed.mobileFilters }));
                }

                if (typeof parsed.isDesktopFilterExpanded === 'boolean') {
                    setIsDesktopFilterExpanded(parsed.isDesktopFilterExpanded);
                }

                if (typeof parsed.isMobileFilterExpanded === 'boolean') {
                    setIsMobileFilterExpanded(parsed.isMobileFilterExpanded);
                }

                if (Array.isArray(parsed.expandedCards)) {
                    setExpandedCards(parsed.expandedCards);
                }

                if (typeof parsed.currentPage === 'number' && parsed.currentPage >= 1) {
                    setCurrentPage(parsed.currentPage);
                }

                if (typeof parsed.pageSize === 'number' && parsed.pageSize > 0) {
                    setPageSize(parsed.pageSize);
                }

                if (typeof parsed.sortColumn === 'string' && parsed.sortColumn.trim() !== '') {
                    setSortColumn(parsed.sortColumn);
                }

                if (parsed.sortDirection === 'asc' || parsed.sortDirection === 'desc') {
                    setSortDirection(parsed.sortDirection);
                }

                if (typeof parsed.selectedEmployeeId === 'string') {
                    setSelectedEmployeeId(parsed.selectedEmployeeId || 'all');
                }

                if (typeof parsed.mobileSelectedEmployeeId === 'string') {
                    setMobileSelectedEmployeeId(parsed.mobileSelectedEmployeeId || 'all');
                }
            }
        } catch (error) {
            console.error('Failed to restore customer list state:', error);
        } finally {
            setIsStateHydrated(true);
        }
    }, []);

    useEffect(() => {
        if (!isStateHydrated || typeof window === 'undefined') {
            return;
        }

        const payload = {
            selectedColumns,
            desktopFilters,
            mobileFilters,
            isDesktopFilterExpanded,
            isMobileFilterExpanded,
            expandedCards,
            currentPage,
            pageSize,
            sortColumn,
            sortDirection,
            selectedEmployeeId,
            mobileSelectedEmployeeId,
        };

        try {
            sessionStorage.setItem(CUSTOMER_LIST_STORAGE_KEY, JSON.stringify(payload));
        } catch (error) {
            console.error('Failed to persist customer list state:', error);
        }
    }, [
        isStateHydrated,
        selectedColumns,
        desktopFilters,
        mobileFilters,
        isDesktopFilterExpanded,
        isMobileFilterExpanded,
        expandedCards,
        currentPage,
        pageSize,
        sortColumn,
        sortDirection,
        selectedEmployeeId,
        mobileSelectedEmployeeId,
    ]);

    const employeesForOptions = useMemo(
        () => employees.filter(employee => !isAdminEmployee(employee) &&
            (!(isManager || isFieldOfficer) || scopedEmployeeIds.includes(employee.id))),
        [employees, isFieldOfficer, isManager, scopedEmployeeIds]
    );

    const employeeOptions = useMemo<SearchableOption<{ fullName: string }>[]>(() => {
        const base = employeesForOptions.map((employee) => {
            const fullName = [employee.firstName, employee.lastName].filter(Boolean).join(" ").trim();
            const identifier = employee.userDto?.employeeId ?? null;
            const fallbackName =
                fullName || employee.userName || employee.email || `Employee ${identifier ?? employee.id}`;
            const label = identifier !== null ? `${fallbackName} (${identifier})` : fallbackName;
            const filterName = fullName || fallbackName;
            return {
                value: String(employee.id),
                label,
                data: { fullName: filterName },
            };
        });

        base.sort((a, b) => a.label.localeCompare(b.label));

        return [{ value: "all", label: "All employees" }, ...base];
    }, [employeesForOptions]);

    const stateOptions = useMemo(
        () => buildFilterOptions(
            [
                ...locationStates.map((state) => state.name),
                ...filterSourceCustomers.map((customer) => customer.state),
                ...customers.map((customer) => customer.state),
                desktopFilters.state,
                mobileFilters.state,
            ],
            'All States',
        ),
        [customers, desktopFilters.state, filterSourceCustomers, locationStates, mobileFilters.state],
    );

    const cityOptions = useMemo(
        () => buildFilterOptions(
            [
                ...filterSourceCustomers.map((customer) => customer.city),
                ...customers.map((customer) => customer.city),
                desktopFilters.city,
                mobileFilters.city,
            ],
            'All cities',
            formatCityLabel,
        ),
        [customers, desktopFilters.city, filterSourceCustomers, mobileFilters.city],
    );

    const clientTypeOptions = useMemo(
        () => buildFilterOptions(
            [
                ...clientTypes.map((clientType) => clientType.type),
                ...filterSourceCustomers.map((customer) => customer.clientType),
                ...customers.map((customer) => customer.clientType),
                desktopFilters.clientType,
                mobileFilters.clientType,
            ],
            'All client types',
            formatClientTypeLabel,
        ),
        [clientTypes, customers, desktopFilters.clientType, filterSourceCustomers, mobileFilters.clientType],
    );

    useEffect(() => {
        if (employees.length === 0) {
            return;
        }

        const filterName = desktopFilters.employeeName;

        if (!filterName) {
            if (selectedEmployeeId !== "all") {
                setSelectedEmployeeId("all");
            }
            return;
        }

        const match = employeeOptions.find(
            (option) => option.value !== "all" && option.data?.fullName === filterName,
        );

        if (match) {
            if (selectedEmployeeId !== match.value) {
                setSelectedEmployeeId(match.value);
            }
        } else if (selectedEmployeeId !== "all") {
            setSelectedEmployeeId("all");
        }
    }, [desktopFilters.employeeName, employeeOptions, employees, selectedEmployeeId]);

    useEffect(() => {
        if (employees.length === 0) {
            return;
        }

        const filterName = mobileFilters.employeeName;

        if (!filterName) {
            if (mobileSelectedEmployeeId !== "all") {
                setMobileSelectedEmployeeId("all");
            }
            return;
        }

        const match = employeeOptions.find(
            (option) => option.value !== "all" && option.data?.fullName === filterName,
        );

        if (match) {
            if (mobileSelectedEmployeeId !== match.value) {
                setMobileSelectedEmployeeId(match.value);
            }
        } else if (mobileSelectedEmployeeId !== "all") {
            setMobileSelectedEmployeeId("all");
        }
    }, [mobileFilters.employeeName, employeeOptions, employees, mobileSelectedEmployeeId]);

    // Determine role using corrected flags from auth context (preferred method)
    useEffect(() => {
        // Use corrected role flags if available (most reliable - based on teamId fetch)
        const roleFlags = getCorrectedRoleFlags(userRole, currentUser, correctedRoleFlags, authTeamId);
        
        console.log('Customers - Role detection - userRole:', userRole);
        console.log('Customers - Role detection - authTeamId:', authTeamId);
        console.log('Customers - Role detection - correctedRoleFlags:', correctedRoleFlags);
        console.log('Customers - Role detection - final isManager:', roleFlags.isManager);
        console.log('Customers - Role detection - final isFieldOfficer:', roleFlags.isFieldOfficer);
        console.log('Customers - Role detection - final isAdmin:', roleFlags.isAdmin);

        setIsManager(roleFlags.isManager);
        setIsFieldOfficer(roleFlags.isFieldOfficer);
        setIsAdmin(roleFlags.isAdmin);
                    setIsRoleDetermined(true);
        
        // If we have teamId from auth context, use it (preferred)
        if (authTeamId && !teamId) {
            setTeamId(authTeamId);
                }
    }, [userRole, currentUser, authTeamId, correctedRoleFlags, teamId]);

    // Fetch team data for managers and field officers
    useEffect(() => {
        const loadTeamData = async () => {
            if ((!isManager && !isFieldOfficer) || !userData?.employeeId) {
                // For admins or users without employeeId, mark role as determined
                setIsRoleDetermined(true);
                return;
            }
            
            setTeamLoading(true);
            setTeamError(null);
            
            try {
                const teamData: TeamDataDto[] = await API.getTeamByEmployee(userData.employeeId);
                
                if (teamData.length > 0) {
                    const accessibleTeamIds = getTeamIds(teamData);
                    setTeamIds(accessibleTeamIds);
                    setTeamId(accessibleTeamIds[0] ?? null);
                    setScopedEmployeeIds([...new Set([
                        ...getUniqueFieldOfficersFromTeams(teamData).map(employee => employee.id),
                        ...getUniqueManagersFromTeams(teamData).map(employee => employee.id),
                    ])]);
                } else {
                    setTeamError('No team data found for this user');
                    setTeamId(null);
                    setTeamIds([]);
                    setScopedEmployeeIds([]);
                }
            } catch (err) {
                console.error('Failed to load team data:', err);
                setTeamError('Failed to load team data');
                setTeamId(null);
                setTeamIds([]);
                setScopedEmployeeIds([]);
            } finally {
                setTeamLoading(false);
                // Mark role as determined after team data is loaded (or failed)
                setIsRoleDetermined(true);
            }
        };

        loadTeamData();
    }, [isManager, isFieldOfficer, userData?.employeeId]);

    useEffect(() => {
        if (!isRoleDetermined || teamLoading) return;

        let isMounted = true;

        const loadFilterSourceCustomers = async () => {
            try {
                let stores: StoreDto[] = [];

                if (isManager || isFieldOfficer) {
                    if (teamIds.length === 0) {
                        setFilterSourceCustomers([]);
                        return;
                    }

                    const responses = await Promise.all(teamIds.map(getAllStoresForTeam));
                    const uniqueStores = new Map<number, StoreDto>();
                    responses.flat().forEach((store) => uniqueStores.set(store.storeId, store));
                    stores = Array.from(uniqueStores.values());
                } else {
                    stores = await API.getStoresFiltered({ page: 0, size: TEAM_CUSTOMER_PAGE_SIZE });
                }

                if (isMounted) setFilterSourceCustomers(stores);
            } catch (error) {
                console.error('Failed to load customer filter values:', error);
                if (isMounted) setFilterSourceCustomers([]);
            }
        };

        loadFilterSourceCustomers();
        return () => {
            isMounted = false;
        };
    }, [isFieldOfficer, isManager, isRoleDetermined, teamIds, teamLoading]);

    const handleSort = (column: string) => {
        let mappedColumn = column;
        if (column === 'ownerName') {
            mappedColumn = 'ownerFirstName';
        } else if (column === 'totalVisits') {
            mappedColumn = 'visitCount';
        }
        
        // If clicking the same column, toggle direction
        if (sortColumn === mappedColumn) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            // If clicking a different column, set to alphabetical (ascending) by default
            setSortColumn(mappedColumn);
            setSortDirection('asc');
        }
    };

    const fetchFilteredCustomers = async () => {
        if (!isStateHydrated || !isRoleDetermined) {
            return;
        }

        const requestId = ++customerRequestIdRef.current;
        const isLatestRequest = () => requestId === customerRequestIdRef.current;

        setIsLoading(true);
        setError(null);

        try {
            let data: StoreResponse;

            if (isManager || isFieldOfficer) {
                if (teamIds.length === 0) {
                    if (isLatestRequest()) {
                        setCustomers([]);
                        setTotalPages(1);
                    }
                    return;
                }

                const responses = await Promise.all(teamIds.map(getAllStoresForTeam));
                if (!isLatestRequest()) return;

                const uniqueStores = new Map<number, StoreDto>();
                responses.flat().forEach((store) => uniqueStores.set(store.storeId, store));

                const today = new Date();
                const filteredStores = Array.from(uniqueStores.values()).filter(
                    (store) =>
                        matchesCustomerFilters(store, desktopFilters) &&
                        (!birthdayToday || hasBirthdayOn(store, today)),
                );

                data = createStoreResponse(
                    sortStores(filteredStores, sortColumn, sortDirection),
                    currentPage,
                    pageSize,
                );
            } else if (birthdayToday) {
                const today = new Date();
                const todayStr = format(today, 'yyyy-MM-dd');
                const birthdayCustomers = await API.getStoresByDobDateRange(todayStr, todayStr);
                if (!isLatestRequest()) return;

                const filteredStores = (birthdayCustomers ?? []).filter((store) =>
                    matchesCustomerFilters(store, desktopFilters),
                );
                data = createStoreResponse(
                    sortStores(filteredStores, sortColumn, sortDirection),
                    currentPage,
                    pageSize,
                );
            } else {
                data = await API.getStoresFilteredPaginated({
                    storeName: desktopFilters.storeName || undefined,
                    ownerName: desktopFilters.ownerName || undefined,
                    city: desktopFilters.city || undefined,
                    state: desktopFilters.state || undefined,
                    clientType: desktopFilters.clientType || undefined,
                    employeeName: desktopFilters.employeeName || undefined,
                    primaryContact: desktopFilters.primaryContact || undefined,
                    page: currentPage - 1,
                    size: pageSize,
                    sortBy: sortColumn,
                    sortOrder: sortDirection,
                });

                if (!isLatestRequest()) return;
            }

            const transformedCustomers: Customer[] = (data.content || []).map((store: StoreDto) => ({
                ...store,
                storeId: store.storeId,
                clientFirstName: store.clientFirstName || '',
                clientLastName: store.clientLastName || '',
                employeeName: store.employeeName || '',
                totalVisitCount: store.totalVisitCount || 0,
            }));

            if (!isLatestRequest()) return;

            setCustomers(transformedCustomers);
            const resolvedTotalPages = data.totalPages && data.totalPages > 0 ? data.totalPages : 1;
            setTotalPages(resolvedTotalPages);
            if (currentPage > resolvedTotalPages) {
                const nextPage = Math.max(resolvedTotalPages, 1);
                if (nextPage !== currentPage) {
                    setCurrentPage(nextPage);
                }
            }
        } catch (err) {
            if (isLatestRequest()) {
                setError((err as Error)?.message || 'Failed to load customers');
                setCustomers([]);
                setTotalPages(1);
            }
        } finally {
            if (isLatestRequest()) {
                setIsLoading(false);
            }
        }
    };

    useEffect(() => {
        if (!isStateHydrated || !isRoleDetermined) {
            return;
        }

        customerRequestIdRef.current += 1;
        const timeoutId = window.setTimeout(fetchFilteredCustomers, CUSTOMER_FILTER_DEBOUNCE_MS);
        return () => window.clearTimeout(timeoutId);
    }, [isStateHydrated, isRoleDetermined, isManager, isFieldOfficer, desktopFilters, currentPage, pageSize, sortColumn, sortDirection, teamIds, birthdayToday]);

    const openDeleteModal = (customerId: string) => {
        setSelectedCustomerId(customerId);
        setIsDeleteModalOpen(true);
    };

    const closeDeleteModal = () => {
        setSelectedCustomerId(null);
        setIsDeleteModalOpen(false);
    };

    const handleDesktopFilterChange = (filterName: keyof typeof desktopFilters, value: string) => {
        if (isModalOpen) return;

        if (filterName === 'ownerName') {
            setDesktopFilters((prevFilters) => ({
                ...prevFilters,
                [filterName]: value.toLowerCase(),
            }));
        } else {
            setDesktopFilters((prevFilters) => ({
                ...prevFilters,
                [filterName]: value,
            }));
        }
        setCurrentPage(1);
    };

    const handleMobileFilterChange = (filterName: keyof typeof mobileFilters, value: string) => {
        if (isModalOpen) return;

        if (filterName === 'ownerName') {
            setMobileFilters((prevFilters) => ({
                ...prevFilters,
                [filterName]: value.toLowerCase(),
            }));
        } else {
            setMobileFilters((prevFilters) => ({
                ...prevFilters,
                [filterName]: value,
            }));
        }
    };

    const handleDesktopEmployeeSelect = (option: SearchableOption<{ fullName: string }> | null) => {
        if (!option || option.value === "all") {
            setSelectedEmployeeId("all");
            handleDesktopFilterChange('employeeName', '');
        } else {
            setSelectedEmployeeId(option.value);
            const nextName = option.data?.fullName ?? '';
            handleDesktopFilterChange('employeeName', nextName);
        }
    };

    const handleMobileEmployeeSelect = (option: SearchableOption<{ fullName: string }> | null) => {
        if (!option || option.value === "all") {
            setMobileSelectedEmployeeId("all");
            handleMobileFilterChange('employeeName', '');
        } else {
            setMobileSelectedEmployeeId(option.value);
            const nextName = option.data?.fullName ?? '';
            handleMobileFilterChange('employeeName', nextName);
        }
    };

    const handleFilterClear = (filterName: keyof typeof desktopFilters) => {
        setDesktopFilters((prevFilters) => ({
            ...prevFilters,
            [filterName]: '',
        }));
        if (filterName === 'employeeName') {
            setSelectedEmployeeId('all');
        }
        setCurrentPage(1);
    };

    const toggleCardExpansion = (storeId: number) => {
        setExpandedCards(prev =>
            prev.includes(storeId)
                ? prev.filter(id => id !== storeId)
                : [...prev, storeId]
        );
    };

    const handleDeleteConfirm = async () => {
        if (selectedCustomerId) {
            try {
                console.log('Attempting to delete customer with ID:', selectedCustomerId);
                console.log('Using token:', token ? 'Token present' : 'No token');
                
                // Try using the API service first
                try {
                    await API.deleteStore(Number(selectedCustomerId));
                    console.log('Customer deleted successfully via API service');
                    fetchFilteredCustomers();
                    closeDeleteModal();
                    return;
                } catch (apiError) {
                    console.log('API service failed, trying direct fetch:', apiError);
                }
                
                // Fallback to direct fetch
                const response = await fetch(`http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/store/deleteById?id=${selectedCustomerId}`, {
                    method: 'DELETE',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                });
                
                console.log('Delete response status:', response.status);
                console.log('Delete response ok:', response.ok);
                
                if (response.ok) {
                    console.log('Customer deleted successfully via direct fetch');
                    fetchFilteredCustomers();
                    closeDeleteModal();
                } else {
                    const errorText = await response.text();
                    console.error('Failed to delete customer. Status:', response.status);
                    console.error('Error response:', errorText);
                }
            } catch (error) {
                console.error('Error deleting customer:', error);
            }
        }
    };


    const handleSelectColumn = (column: string) => {
        setSelectedColumns(prev =>
            prev.includes(column)
                ? prev.filter(col => col !== column)
                : [...prev, column]
        );
    };

    const getInitials = (firstName: string, lastName: string) => {
        const firstInitial = firstName?.charAt(0) || '';
        const lastInitial = lastName?.charAt(0) || '';
        return `${firstInitial}${lastInitial}`.toUpperCase();
    };

    const handleExport = useCallback(async () => {
        setIsExporting(true);
        setExportMessage('Please wait, downloading...');
        try {
            console.log('Starting export process...');
            
            const response = await fetch('http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/store/export', {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
    
            console.log('Export response status:', response.status);
            console.log('Export response ok:', response.ok);
    
            if (!response.ok) {
                console.error('Failed to fetch export data');
                setExportMessage('Failed to download. Please try again.');
                return;
            }
    
            const csvContent = await response.text();
            console.log('CSV content received, length:', csvContent.length);
    
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            if (link.download !== undefined) {
                const url = URL.createObjectURL(blob);
                link.setAttribute('href', url);
                link.setAttribute('download', 'customers_export.csv');
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                setExportMessage('Download complete!');
                console.log('Export completed successfully');
            }
        } catch (error) {
            console.error('Error exporting data:', error);
            setExportMessage('Failed to download. Please try again.');
        } finally {
            setTimeout(() => {
                setIsExporting(false);
                setExportMessage('Please wait, downloading...');
            }, 2000);
        }
    }, [token]);

    const openModal = () => {
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
    };

    const handleCustomerAdded = () => {
        // Refresh the customers list after adding a new customer
        fetchFilteredCustomers();
    };

    const applyMobileFilters = () => {
        setDesktopFilters(mobileFilters);
        setSelectedEmployeeId(mobileSelectedEmployeeId);
        setIsMobileFilterExpanded(false);
        setCurrentPage(1);
    };

    const clearAllFilters = () => {
        const emptyFilters = {
            storeName: '',
            primaryContact: '',
            ownerName: '',
            city: '',
            state: '',
            clientType: '',
            employeeName: '',
        };
        setDesktopFilters(emptyFilters);
        setMobileFilters(emptyFilters);
        setSelectedEmployeeId('all');
        setMobileSelectedEmployeeId('all');
        setBirthdayToday(false);
        setCurrentPage(1);
    };

    const renderPagination = () => {
        return (
            <div className="flex items-center justify-between mt-4">
                <div className="flex items-center space-x-2">
                    <Label htmlFor="pageSize">Rows per page:</Label>
                    <Select value={pageSize.toString()} onValueChange={(value) => setPageSize(parseInt(value))}>
                        <SelectTrigger className="w-20">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="25">25</SelectItem>
                            <SelectItem value="50">50</SelectItem>
                            <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                
                <div className="flex items-center space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                    >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                    </Button>
                    
                    <span className="text-sm text-muted-foreground">
                        Page {currentPage} of {totalPages}
                    </span>
                    
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage >= totalPages}
                    >
                        Next
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        );
    };

    const renderFilterInput = (name: keyof typeof desktopFilters, label: string, icon: React.ReactNode, isMobile: boolean) => {
        const filterScope = isMobile ? 'mobile' : 'desktop';
        const filterInputId = `customer-${filterScope}-filter-${name}`;

        return (
            <div className={isMobile ? "space-y-1" : "min-w-0"}>
                <Label htmlFor={filterInputId} className="sr-only">{label}</Label>
                <div className="relative">
                    <Input
                        id={filterInputId}
                        name={filterInputId}
                        type="search"
                        autoComplete="off"
                        placeholder={label}
                        value={isMobile ? mobileFilters[name] : desktopFilters[name]}
                        disabled={isModalOpen}
                        onChange={(e) => isMobile ? handleMobileFilterChange(name, e.target.value) : handleDesktopFilterChange(name, e.target.value)}
                        className={isMobile
                            ? "h-11 pl-8 pr-8"
                            : "h-8 bg-background pl-8 pr-8 text-xs shadow-none"
                        }
                    />
                    <div className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none text-gray-400">
                        {icon}
                    </div>
                    {!isMobile && desktopFilters[name] && (
                        <button
                            type="button"
                            onClick={() => handleFilterClear(name)}
                            className="absolute inset-y-0 right-0 flex items-center pr-2 text-gray-400 hover:text-gray-600"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>
            </div>
        );
    };

    const renderFilterSelect = (
        name: 'city' | 'state' | 'clientType',
        label: string,
        options: SearchableOption[],
        isMobile: boolean,
    ) => {
        const filters = isMobile ? mobileFilters : desktopFilters;
        const value = filters[name] || 'all';

        return (
            <div className={isMobile ? "space-y-1" : "min-w-0"}>
                <Label className="sr-only">{label}</Label>
                <SearchableSelect
                    options={options}
                    value={value}
                    onSelect={(option) => {
                        const nextValue = !option || option.value === 'all' ? '' : option.value;
                        if (isMobile) {
                            handleMobileFilterChange(name, nextValue);
                        } else {
                            handleDesktopFilterChange(name, nextValue);
                        }
                    }}
                    placeholder={label}
                    loading={isLoadingFilterOptions}
                    triggerClassName={isMobile
                        ? "h-11 w-full justify-between"
                        : "h-8 w-full justify-between bg-background text-xs shadow-none"
                    }
                    contentClassName="w-[var(--radix-popover-trigger-width)]"
                    searchPlaceholder={`Search ${label.toLowerCase()}...`}
                />
            </div>
        );
    };

  return (
        <div className="mx-auto w-full max-w-none py-4">
            <div>
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                    <div className="flex flex-wrap items-center gap-2">
                        <Button variant="outline" size="sm" onClick={openModal}>
                            Add Customer
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsDesktopFilterExpanded(!isDesktopFilterExpanded)}
                            className="hidden md:inline-flex"
                        >
                            <Filter className="mr-2 h-4 w-4" />
                            {isDesktopFilterExpanded ? 'Hide Filters' : 'Show Filters'}
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
                                    <Columns className="mr-2 h-4 w-4" />
                                    Columns
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {[
                                    { value: 'shopName', label: 'Shop Name' },
                                    { value: 'ownerName', label: 'Owner Name' },
                                    { value: 'city', label: 'City' },
                                    { value: 'state', label: 'State' },
                                    { value: 'phone', label: 'Phone' },
                                    { value: 'monthlySales', label: 'Mon Sale' },
                                    { value: 'intentLevel', label: 'Intent' },
                                    { value: 'fieldOfficer', label: 'Field Officer' },
                                    { value: 'clientType', label: 'Client type' },
                                    { value: 'totalVisits', label: '#Vists' },
                                    { value: 'lastVisitDate', label: 'Last Visit Date' }
                                ].map((column) => (
                                    <DropdownMenuCheckboxItem
                                        key={column.value}
                                        checked={selectedColumns.includes(column.value)}
                                        onCheckedChange={() => handleSelectColumn(column.value)}
                                    >
                                        <div className="flex items-center justify-between w-full">
                                            {column.label}
                                            {selectedColumns.includes(column.value) && (
                                                <Check className="h-4 w-4" />
                                            )}
                                        </div>
                                    </DropdownMenuCheckboxItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting}>
                            {isExporting ? (
                                <>
                                    <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                                    </svg>
                                    {exportMessage}
                                </>
                            ) : (
                                <>
                                    <Download className="mr-2 h-4 w-4" />
                                    Export
                                </>
                            )}
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setIsMobileFilterExpanded(true)}
                            className="md:hidden"
                            aria-label="Open customer filters"
                        >
                            <Filter className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {isDesktopFilterExpanded && (
                    <div className="mb-4 hidden rounded-xl border border-border/70 bg-muted/20 p-3 md:block">
                            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3 lg:grid-cols-4">
                                {renderFilterInput('storeName', 'Shop Name', <User className="h-4 w-4" />, false)}
                                {renderFilterInput('ownerName', 'Owner Name', <User className="h-4 w-4" />, false)}
                                {renderFilterSelect('state', 'State', stateOptions, false)}
                                {renderFilterSelect('city', 'City', cityOptions, false)}
                                {renderFilterInput('primaryContact', 'Phone', <Phone className="h-4 w-4" />, false)}
                                {renderFilterSelect('clientType', 'Client type', clientTypeOptions, false)}
                                <div className="min-w-0">
                                    <Label className="sr-only">Employee</Label>
                                    <SearchableSelect
                                        options={employeeOptions}
                                        value={selectedEmployeeId}
                                        onSelect={handleDesktopEmployeeSelect}
                                        placeholder="Employee"
                                        loading={isLoadingEmployees}
                                        triggerClassName="h-8 w-full justify-between bg-background text-xs shadow-none"
                                        contentClassName="w-[var(--radix-popover-trigger-width)]"
                                        searchPlaceholder="Search employees..."
                                    />
                                </div>
                                <div className="flex h-8 items-center gap-2 rounded-md border border-border bg-background px-2.5 transition-colors hover:border-pink-200 hover:bg-pink-50/50">
                                    <Checkbox
                                        id="birthdayToday"
                                        checked={birthdayToday}
                                        onCheckedChange={(checked) => {
                                            setBirthdayToday(checked === true);
                                            setCurrentPage(1);
                                        }}
                                        className="h-3.5 w-3.5 border-pink-300 data-[state=checked]:border-pink-500 data-[state=checked]:bg-pink-500"
                                    />
                                    <Label
                                        htmlFor="birthdayToday"
                                        className="flex flex-1 cursor-pointer items-center gap-1.5 text-xs font-medium"
                                    >
                                        <Cake className="h-3.5 w-3.5 text-pink-500" />
                                        <span>Birthday today</span>
                                    </Label>
                                </div>
                            </div>
                    </div>
                )}

                {isManager && (
                    <div className="mb-4">
                        <h2 className="text-xl font-semibold">Team Customers</h2>
                    </div>
                )}

                <Sheet open={isMobileFilterExpanded} onOpenChange={setIsMobileFilterExpanded}>
                    <SheetContent>
                        <SheetHeader>
                            <SheetTitle>Customer Filters</SheetTitle>
                        </SheetHeader>
                        <div className="py-4 space-y-4">
                            {renderFilterInput('storeName', 'Shop Name', <User className="h-4 w-4" />, true)}
                            {renderFilterInput('ownerName', 'Owner Name', <User className="h-4 w-4" />, true)}
                            {renderFilterSelect('state', 'State', stateOptions, true)}
                            {renderFilterSelect('city', 'City', cityOptions, true)}
                            {renderFilterInput('primaryContact', 'Phone', <Phone className="h-4 w-4" />, true)}
                            {renderFilterSelect('clientType', 'Client type', clientTypeOptions, true)}
                            <div className="space-y-1">
                                <Label className="sr-only">Employee</Label>
                                <SearchableSelect
                                    options={employeeOptions}
                                    value={mobileSelectedEmployeeId}
                                    onSelect={handleMobileEmployeeSelect}
                                    placeholder="Employee"
                                    loading={isLoadingEmployees}
                                    triggerClassName="w-full justify-between h-11"
                                    contentClassName="w-[var(--radix-popover-trigger-width)]"
                                    searchPlaceholder="Search employees..."
                                />
                            </div>
                            <div className="flex items-center space-x-2 p-3 border rounded-md bg-gradient-to-r from-pink-50 to-rose-50 border-pink-200">
                                <Checkbox
                                    id="birthdayTodayMobile"
                                    checked={birthdayToday}
                                    onCheckedChange={(checked) => {
                                        setBirthdayToday(checked === true);
                                        setCurrentPage(1);
                                    }}
                                    className="border-pink-300"
                                />
                                <Label
                                    htmlFor="birthdayTodayMobile"
                                    className="text-sm font-medium cursor-pointer flex items-center gap-2 flex-1"
                                >
                                    <Cake className="h-4 w-4 text-pink-600" />
                                    <span className="text-pink-700">Birthday Today</span>
                                </Label>
                            </div>
                        </div>
                        <SheetFooter className="flex gap-2">
                            <Button variant="outline" onClick={clearAllFilters}>Clear All</Button>
                            <Button onClick={applyMobileFilters}>Apply Filters</Button>
                        </SheetFooter>
                    </SheetContent>
                </Sheet>

                {/* Mobile view - Cards for managers/field officers, table for admins */}
                <div className="md:hidden space-y-4">
                    {isLoading || !isRoleDetermined ? (
                        <>
                            {[...Array(5)].map((_, index) => (
                                <Card key={`mobile-skeleton-${index}`} className="overflow-hidden">
                                    <CardHeader className="pb-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-3">
                                                <Skeleton className="h-12 w-12 rounded-full" />
                                                <div className="space-y-2">
                                                    <Skeleton className="h-4 w-40" />
                                                    <Skeleton className="h-3 w-24" />
                                                </div>
                                            </div>
                                            <Skeleton className="h-6 w-16" />
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pt-2">
                                        <div className="flex items-center justify-between">
                                            <Skeleton className="h-4 w-32" />
                                            <Skeleton className="h-8 w-8" />
                                        </div>
                                        <div className="mt-4 flex justify-end">
                                            <Skeleton className="h-8 w-20" />
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </>
                    ) : (
                        customers.map((customer: Customer, index: number) => (
                            <Card key={`mobile-customer-${customer.storeId}-${index}`} className="overflow-hidden">
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-3">
                                            <Avatar>
                                                <AvatarImage src={`https://source.boringavatars.com/beam/120/${customer.clientFirstName}${customer.clientLastName}?colors=264653,2a9d8f,e9c46a,f4a261,e76f51`} />
                                                <AvatarFallback>{getInitials(customer.clientFirstName, customer.clientLastName)}</AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <CardTitle className="text-lg">{customer.storeName}</CardTitle>
                                                <p className="text-sm text-gray-500">{formatCityLabel(customer.city)}, {customer.state}</p>
                                            </div>
                                        </div>
                                        {customer.clientType && (
                                            <Badge variant="outline">
                                                {formatClientTypeLabel(customer.clientType)}
                                            </Badge>
                                        )}
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-2">
                                            <User className="text-blue-500" />
                                            <span className="font-medium">Owner:</span>
                                            <span>{customer.clientFirstName} {customer.clientLastName}</span>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => toggleCardExpansion(customer.storeId)}
                                        >
                                            {expandedCards.includes(customer.storeId) ? (
                                                <ChevronUp className="h-4 w-4" />
                                            ) : (
                                                <ChevronDown className="h-4 w-4" />
                                            )}
                                        </Button>
                                    </div>

                                    {expandedCards.includes(customer.storeId) && (
                                        <div className="mt-4 space-y-3 text-sm">
                                            <div className="flex items-center space-x-2">
                                                <Phone className="text-green-500" />
                                                <span className="font-medium">Phone:</span>
                                                <span>{customer.primaryContact}</span>
                                            </div>
                                            {customer.monthlySale && (
                                                <div className="flex items-center space-x-2">
                                                    <DollarSign className="text-yellow-500" />
                                                    <span className="font-medium">Monthly Sales:</span>
                                                    <span>{customer.monthlySale.toLocaleString()} tonnes</span>
                                                </div>
                                            )}
                                            {customer.intent && (
                                                <div className="flex items-center space-x-2">
                                                    <Target className="text-red-500" />
                                                    <span className="font-medium">Intent:</span>
                                                    <span>{customer.intent}</span>
                                                </div>
                                            )}
                                            {customer.employeeName && (
                                                <div className="flex items-center space-x-2">
                                                    <Briefcase className="text-purple-500" />
                                                    <span className="font-medium">Field Officer:</span>
                                                    <span>{customer.employeeName}</span>
                                                </div>
                                            )}
                                            <div className="flex items-center space-x-2">
                                                <User className="text-indigo-500" />
                                                <span className="font-medium">Total Visits:</span>
                                                <span>{customer.totalVisitCount}</span>
                                            </div>
                                        </div>
                                    )}

                                    <div className="mt-4 flex justify-end items-center">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="sm">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem
                                                    onSelect={() => {
                                                        router.push(`/dashboard/customers/${customer.storeId}`);
                                                    }}
                                                >
                                                    View
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onSelect={() => openDeleteModal(customer.storeId.toString())}>
                                                    Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>

                <div className="hidden min-w-0 md:block">
                    <Table className="table-fixed text-xs font-poppins">
                        <colgroup>
                            {selectedColumns.includes('shopName') && <col className="w-[15%]" />}
                            {selectedColumns.includes('ownerName') && <col className="w-[10%]" />}
                            {selectedColumns.includes('city') && <col className="w-[8%]" />}
                            {selectedColumns.includes('state') && <col className="w-[8%]" />}
                            {selectedColumns.includes('phone') && <col className="w-[9%]" />}
                            {selectedColumns.includes('monthlySales') && <col className="w-[8%]" />}
                            {selectedColumns.includes('intentLevel') && <col className="w-[5%]" />}
                            {selectedColumns.includes('fieldOfficer') && <col className="w-[12%]" />}
                            {selectedColumns.includes('clientType') && <col className="w-[8%]" />}
                            {selectedColumns.includes('totalVisits') && <col className="w-[5%]" />}
                            {selectedColumns.includes('lastVisitDate') && <col className="w-[7%]" />}
                            <col className="w-[5%]" />
                        </colgroup>
                        <TableHeader>
                            <TableRow>
                                {selectedColumns.includes('shopName') && (
                                    <TableHead className="cursor-pointer overflow-hidden text-ellipsis" title="Shop Name" onClick={() => handleSort('storeName')}>
                                        Shop Name
                                        {sortColumn === 'storeName' && (
                                            <span className="text-black text-sm">{sortDirection === 'asc' ? ' ▲' : ' ▼'}</span>
                                        )}
                                    </TableHead>
                                )}
                                {selectedColumns.includes('ownerName') && (
                                    <TableHead className="cursor-pointer overflow-hidden text-ellipsis" title="Owner Name" onClick={() => handleSort('ownerName')}>
                                        Owner Name
                                        {sortColumn === 'ownerFirstName' && (
                                            <span className="text-black text-sm">{sortDirection === 'asc' ? ' ▲' : ' ▼'}</span>
                                        )}
                                    </TableHead>
                                )}
                                {selectedColumns.includes('city') && (
                                    <TableHead className="cursor-pointer overflow-hidden text-ellipsis" title="City" onClick={() => handleSort('city')}>
                                        City
                                        {sortColumn === 'city' && (
                                            <span className="text-black text-sm">{sortDirection === 'asc' ? ' ▲' : ' ▼'}</span>
                                        )}
                                    </TableHead>
                                )}
                                {selectedColumns.includes('state') && (
                                    <TableHead className="cursor-pointer overflow-hidden text-ellipsis" title="State" onClick={() => handleSort('state')}>
                                        State
                                        {sortColumn === 'state' && (
                                            <span className="text-black text-sm">{sortDirection === 'asc' ? ' ▲' : ' ▼'}</span>
                                        )}
                                    </TableHead>
                                )}
                                {selectedColumns.includes('phone') && (
                                    <TableHead className="cursor-pointer overflow-hidden text-ellipsis" title="Phone" onClick={() => handleSort('primaryContact')}>
                                        Phone
                                        {sortColumn === 'primaryContact' && (
                                            <span className="text-black text-sm">{sortDirection === 'asc' ? ' ▲' : ' ▼'}</span>
                                        )}
                                    </TableHead>
                                )}
                                {selectedColumns.includes('monthlySales') && (
                                    <TableHead className="cursor-pointer overflow-hidden text-ellipsis" title="Monthly Sale" onClick={() => handleSort('monthlySale')}>
                                        Mon Sale
                                        {sortColumn === 'monthlySale' && (
                                            <span className="text-black text-sm">{sortDirection === 'asc' ? ' ▲' : ' ▼'}</span>
                                        )}
                                    </TableHead>
                                )}
                                {selectedColumns.includes('intentLevel') && (
                                    <TableHead className="cursor-pointer overflow-hidden text-ellipsis" title="Intent" onClick={() => handleSort('intent')}>
                                        Intent
                                        {sortColumn === 'intent' && (
                                            <span className="text-black text-sm">{sortDirection === 'asc' ? ' ▲' : ' ▼'}</span>
                                        )}
                                    </TableHead>
                                )}
                                {selectedColumns.includes('fieldOfficer') && (
                                    <TableHead className="cursor-pointer overflow-hidden text-ellipsis" title="Field Officer" onClick={() => handleSort('employeeName')}>
                                        Field Officer
                                        {sortColumn === 'employeeName' && (
                                            <span className="text-black text-sm">{sortDirection === 'asc' ? ' ▲' : ' ▼'}</span>
                                        )}
                                    </TableHead>
                                )}
                                {selectedColumns.includes('clientType') && (
                                    <TableHead className="cursor-pointer overflow-hidden text-ellipsis" title="Client type" onClick={() => handleSort('clientType')}>
                                        Client type
                                        {sortColumn === 'clientType' && (
                                            <span className="text-black text-sm">{sortDirection === 'asc' ? ' ▲' : ' ▼'}</span>
                                        )}
                                    </TableHead>
                                )}
                                {selectedColumns.includes('totalVisits') && (
                                    <TableHead className="cursor-pointer overflow-hidden text-ellipsis" title="Total Visits" onClick={() => handleSort('totalVisits')}>
                                        #Vists
                                        {sortColumn === 'visitCount' && (
                                            <span className="text-black text-sm">{sortDirection === 'asc' ? ' ▲' : ' ▼'}</span>
                                        )}
                                    </TableHead>
                                )}
                                {selectedColumns.includes('lastVisitDate') && (
                                    <TableHead className="cursor-pointer overflow-hidden text-ellipsis" title="Last Visit Date" onClick={() => handleSort('lastVisitDate')}>
                                        Last Visit Date
                                        {sortColumn === 'lastVisitDate' && (
                                            <span className="text-black text-sm">{sortDirection === 'asc' ? ' ▲' : ' ▼'}</span>
                                        )}
                                    </TableHead>
                                )}
                                <TableHead className="overflow-hidden text-ellipsis" title="Actions">Actions</TableHead>
                            </TableRow>
                        </TableHeader>

                        <TableBody>
                            {isLoading || !isRoleDetermined ? (
                                <>
                                    {[...Array(5)].map((_, index) => (
                                        <TableRow key={`skeleton-${index}`}>
                                            {selectedColumns.includes('shopName') && (
                                                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                            )}
                                            {selectedColumns.includes('ownerName') && (
                                                <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                                            )}
                                            {selectedColumns.includes('city') && (
                                                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                            )}
                                            {selectedColumns.includes('state') && (
                                                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                                            )}
                                            {selectedColumns.includes('phone') && (
                                                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                            )}
                                            {selectedColumns.includes('monthlySales') && (
                                                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                            )}
                                            {selectedColumns.includes('intentLevel') && (
                                                <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                                            )}
                                            {selectedColumns.includes('fieldOfficer') && (
                                                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                            )}
                                            {selectedColumns.includes('clientType') && (
                                                <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                                            )}
                                            {selectedColumns.includes('totalVisits') && (
                                                <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                                            )}
                                            {selectedColumns.includes('lastVisitDate') && (
                                                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                            )}
                                            <TableCell className="w-20">
                                                <Skeleton className="h-8 w-8" />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </>
                            ) : (
                                customers.map((customer: Customer, index: number) => (
                                    <TableRow key={`customer-${customer.storeId}-${index}`}>
                                        {selectedColumns.includes('shopName') && <TableCell className="overflow-hidden"><Ellipsis value={customer.storeName || ''} /></TableCell>}
                                        {selectedColumns.includes('ownerName') && (
                                            <TableCell className="overflow-hidden">
                                                <Ellipsis value={customer.clientFirstName || customer.clientLastName
                                                    ? `${customer.clientFirstName || ''} ${customer.clientLastName || ''}`.trim()
                                                    : ''} />
                                            </TableCell>
                                        )}
                                        {selectedColumns.includes('city') && <TableCell className="overflow-hidden"><Ellipsis value={customer.city || ''} /></TableCell>}
                                        {selectedColumns.includes('state') && <TableCell className="overflow-hidden"><Ellipsis value={customer.state || ''} /></TableCell>}
                                        {selectedColumns.includes('phone') && <TableCell className="overflow-hidden"><Ellipsis value={customer.primaryContact || ''} /></TableCell>}
                                        {selectedColumns.includes('monthlySales') && (
                                            <TableCell className="overflow-hidden">
                                                <Ellipsis value={customer.monthlySale !== null && customer.monthlySale !== undefined
                                                    ? `${customer.monthlySale.toLocaleString()} tonnes`
                                                    : ''} />
                                            </TableCell>
                                        )}
                                        {selectedColumns.includes('intentLevel') && (
                                            <TableCell>{customer.intent !== null && customer.intent !== undefined ? customer.intent : ''}</TableCell>
                                        )}
                                        {selectedColumns.includes('fieldOfficer') && <TableCell className="overflow-hidden"><Ellipsis value={customer.employeeName || ''} /></TableCell>}
                                        {selectedColumns.includes('clientType') && (
                                            <TableCell className="overflow-hidden">
                                                <Badge variant="outline" className="max-w-full">
                                                    <Ellipsis value={formatClientTypeLabel(customer.clientType)} />
                                                </Badge>
                                            </TableCell>
                                        )}
                                        {selectedColumns.includes('totalVisits') && <TableCell>{customer.totalVisitCount}</TableCell>}
                                        {selectedColumns.includes('lastVisitDate') && (
                                            <TableCell className="overflow-hidden">
                                                <Ellipsis value={customer.lastVisitDate
                                                    ? formatDateToUserFriendly(customer.lastVisitDate)
                                                    : ''} />
                                            </TableCell>
                                        )}
                                        <TableCell className="overflow-hidden px-1 text-center">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="sm">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem
                                                        onSelect={() => {
                                                            router.push(`/dashboard/customers/${customer.storeId}`);
                                                        }}
                                                    >
                                                        View
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onSelect={() => openDeleteModal(customer.storeId.toString())}>
                                                        Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {isRoleDetermined && customers.length > 0 && renderPagination()}

                {/* Simple delete confirmation modal */}
                {isDeleteModalOpen && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
                            <h3 className="text-lg font-semibold mb-4">Confirm Delete</h3>
                            <p className="text-gray-600 mb-6">Are you sure you want to delete this customer? This action cannot be undone.</p>
                            <div className="flex justify-end space-x-3">
                                <Button variant="outline" onClick={closeDeleteModal}>
                                    Cancel
                                </Button>
                                <Button variant="destructive" onClick={handleDeleteConfirm}>
                                    Delete
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Add Customer Modal */}
                <AddCustomerModal
                    isOpen={isModalOpen}
                    onClose={closeModal}
                    token={token || ''}
                    employeeId={employeeId ? Number(employeeId) : null}
                    onCustomerAdded={handleCustomerAdded}
                    userRole={userRole || undefined}
                    userData={userData ? (userData as unknown as Record<string, unknown>) : undefined}
                />
            </div>
    </div>
  );
}
