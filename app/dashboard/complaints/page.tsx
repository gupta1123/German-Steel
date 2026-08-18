'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ReactSelect, { type SingleValue, type StylesConfig } from 'react-select';
import { format, subDays, differenceInDays } from 'date-fns';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { API, type TeamDataDto } from '@/lib/api';
import { hasManagerPrivileges } from '@/lib/auth';
import { getTeamIds, getUniqueFieldOfficersFromTeams } from '@/lib/team-access';
import { motion, AnimatePresence } from 'framer-motion';
import { sortBy, uniqBy } from 'lodash';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SearchableSelect, { SearchableSelectOption } from '@/components/ui/searchable-select';
import { SpacedCalendar } from '@/components/ui/spaced-calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Pagination, PaginationContent, PaginationLink, PaginationItem, PaginationPrevious, PaginationNext } from '@/components/ui/pagination';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from '@/components/ui/sheet';
import { CalendarIcon, MoreHorizontal, PlusCircle, Search, Filter, Clock, User, Building, MapPin, AlertTriangle, CheckCircle, Loader, FileText, Target, Trash2, Calendar as CalendarIcon2, X, ChevronLeft, ChevronRight, Check } from 'lucide-react';

interface Task {
    id: number;
    taskTitle: string;
    taskDesciption: string; // Note: API uses taskDesciption without 'r'
    dueDate: string;
    assignedToId: number;
    assignedToName: string;
    assignedById: number;
    status: string;
    priority: string;
    category: string;
    storeId: number;
    storeName: string;
    storeCity: string;
    taskType: string;
    imageCount: number;
}

interface Employee {
    id: number;
    firstName: string;
    lastName: string;
}

interface Store {
    id: number;
    storeName: string;
}

interface AttachmentResponse {
    fileName: string;
    fileDownloadUri: string;
    fileType: string;
    tag: string;
    size: number;
}

const Complaints = () => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
    const [newTask, setNewTask] = useState<Task>({
        id: 0,
        taskTitle: '',
        taskDesciption: '',
        dueDate: '',
        assignedToId: 0,
        assignedToName: '',
        assignedById: 0,
        status: 'Assigned',
        priority: 'low',
        category: 'Complaint',
        storeId: 0,
        storeName: '',
        storeCity: '',
        taskType: 'complaint',
        imageCount: 0
    });
    const router = useRouter();
    const FILTER_STATE_KEY = 'complaints.filters.v1';
    const [isFiltersHydrated, setIsFiltersHydrated] = useState(false);
    const [activeTab, setActiveTab] = useState('general');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);
    const [isStartDatePopoverOpen, setIsStartDatePopoverOpen] = useState(false);
    const [isEndDatePopoverOpen, setIsEndDatePopoverOpen] = useState(false);
    const [isFilterStartDatePopoverOpen, setIsFilterStartDatePopoverOpen] = useState(false);
    const [isFilterEndDatePopoverOpen, setIsFilterEndDatePopoverOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(0);
    const [pageSize, setPageSize] = useState(10);
    const [totalPages, setTotalPages] = useState(0);
    const [totalElements, setTotalElements] = useState(0);
    const [filters, setFilters] = useState({
        employee: '',
        priority: '',
        status: '',
        search: '',
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd')
    });
    const [isLoading, setIsLoading] = useState(true);
    const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
    const [filterEmployees, setFilterEmployees] = useState<{ id: number; name: string }[]>([]);
    const [stores, setStores] = useState<Store[]>([]);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [expandedComplaint, setExpandedComplaint] = useState<number | null>(null);
    const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState<string>('');
    const [taskToUpdate, setTaskToUpdate] = useState<number | null>(null);
    const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
    const [taskImages, setTaskImages] = useState<string[]>([]);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [isLoadingImages, setIsLoadingImages] = useState(false);
    const [isTabLoading, setIsTabLoading] = useState(false);
    const [isStoresLoading, setIsStoresLoading] = useState(false);
    const [teamId, setTeamId] = useState<number | null>(null);
    const [teamIds, setTeamIds] = useState<number[]>([]);
    const [isManager, setIsManager] = useState(false);
    const [teamMembers, setTeamMembers] = useState<Employee[]>([]);
    
    // SearchableSelect state variables
    const [selectedStore, setSelectedStore] = useState<string[]>([]);
    const [employeeOptions, setEmployeeOptions] = useState<SearchableSelectOption[]>([]);
    const [storeOptions, setStoreOptions] = useState<SearchableSelectOption[]>([]);
    const [isAssignPopoverOpen, setIsAssignPopoverOpen] = useState(false);
    const [employeeSearchTerm, setEmployeeSearchTerm] = useState("");
    const [filterEmployeeSearch, setFilterEmployeeSearch] = useState("");
    const [filterEmployeePopoverOpen, setFilterEmployeePopoverOpen] = useState(false);

    const statusOptions = ['Assigned', 'Work In Progress', 'Complete'] as const;

    const { token, userRole, userData, currentUser } = useAuth();

    // Determine user role and load team data for managers
    useEffect(() => {
        const checkUserRole = () => {
            // Check both userRole and currentUser authorities
            const isManagerRole = hasManagerPrivileges(userRole, currentUser);
            setIsManager(isManagerRole);
        };
        checkUserRole();
    }, [userRole, currentUser]);

    // Load team data for managers
    useEffect(() => {
        const loadTeamData = async () => {
            if (!isManager || !userData?.employeeId) return;
            
            try {
                console.log('Loading team data for manager with employeeId:', userData.employeeId);
                const teamData: TeamDataDto[] = await API.getTeamByEmployee(userData.employeeId);
                
                if (teamData && teamData.length > 0) {
                    const accessibleTeamIds = getTeamIds(teamData);
                    setTeamIds(accessibleTeamIds);
                    setTeamId(accessibleTeamIds[0] ?? null);
                    console.log('Team IDs loaded:', accessibleTeamIds);

                    const teamMemberIds = new Set(getUniqueFieldOfficersFromTeams(teamData).map((fo) => fo.id));
                    const filteredTeamMembers = allEmployees.filter((emp) => teamMemberIds.has(emp.id));
                    setTeamMembers(filteredTeamMembers);
                    console.log('Team members loaded:', filteredTeamMembers.length);
                } else {
                    console.warn('No team data found for manager');
                    setTeamId(null);
                    setTeamIds([]);
                    setTeamMembers([]);
                    setErrorMessage('No team data found for this manager');
                }
            } catch (err) {
                console.error('Failed to load team data:', err);
                setTeamId(null);
                setTeamIds([]);
                setTeamMembers([]);
                setErrorMessage('Failed to load team data');
            }
        };
        
        if (isManager && userData?.employeeId && allEmployees.length > 0) {
            loadTeamData();
        }
    }, [isManager, userData?.employeeId, allEmployees]);

    useEffect(() => {
        if (errorMessage) {
            const timer = setTimeout(() => {
                setErrorMessage(null);
            }, 20000);
            return () => clearTimeout(timer);
        }
    }, [errorMessage]);

    // Helper function to format date without timezone issues
    const formatDateForFilter = (date: Date | undefined): string => {
        if (!date) return '';
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const handleDateChange = (key: string, value: string) => {
        const newFilters = { ...filters, [key]: value };

        // Removed 30-day limit per request

        setFilters(newFilters);
    };

    const handleNext = () => {
        setIsTabLoading(true);
   
        setTimeout(() => {
            setActiveTab('details');
            setIsTabLoading(false);
        }, 500);
    };

    const handleBack = () => {
        setActiveTab('general');
    };

    const handleViewStore = (storeId: number) => {
        try {
            sessionStorage.setItem('nav.return.to', JSON.stringify({ page: 'complaints' }));
        } catch {}
        router.push(`/dashboard/customers/${storeId}`);
    };

    const fetchTasks = useCallback(async () => {
        if (!token) return;

        // For managers, wait until we have teamId
        if (isManager && teamIds.length === 0) {
            console.log('⏳ Manager detected but no teamId yet - waiting for team data');
            return;
        }
        
        console.log('Fetching tasks with:', { userRole, userData, isManager, teamId, token: token ? 'present' : 'missing' });
        
        setIsLoading(true);
        try {
            let url: string;
            
            // Use different API endpoints based on user role
            if (isManager) {
                const responses = await Promise.all(teamIds.map((id) =>
                    fetch(`http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/task/getByTeam?id=${id}`, {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    })
                ));

                const failedResponse = responses.find((response) => !response.ok);
                if (failedResponse) {
                    const errorText = await failedResponse.text();
                    throw new Error(`API request failed: ${failedResponse.status} ${errorText}`);
                }

                const payloads = await Promise.all(responses.map((response) => response.json()));
                const uniqueTasks = new Map<number, Record<string, unknown>>();
                payloads.flatMap((payload) => Array.isArray(payload) ? payload : []).forEach((task) => {
                    uniqueTasks.set(Number(task.id) || uniqueTasks.size, task);
                });

                const tasksArray = Array.from(uniqueTasks.values())
                    .filter((task: Record<string, unknown>) => task.taskType === 'complaint' || task.taskType === 'requirement')
                    .map((task: Record<string, unknown>) => ({
                        id: Number(task.id) || 0,
                        taskTitle: String(task.taskTitle || ''),
                        taskDesciption: String(task.taskDesciption || ''),
                        dueDate: String(task.dueDate || ''),
                        assignedToId: Number(task.assignedToId) || 0,
                        assignedToName: String(task.assignedToName || 'Unknown'),
                        assignedById: Number(task.assignedById) || 0,
                        status: String(task.status || ''),
                        priority: String(task.priority || ''),
                        category: String(task.category || ''),
                        storeId: Number(task.storeId) || 0,
                        storeName: String(task.storeName || ''),
                        storeCity: String(task.storeCity || ''),
                        taskType: String(task.taskType || ''),
                        imageCount: Number(task.imageCount) || 0,
                    } as Task))
                    .sort((a: Task, b: Task) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());

                setTasks(tasksArray);
                setIsLoading(false);
                return;
            } else {
                // For admins, use date-based API
            const formattedStartDate = format(new Date(filters.startDate), 'yyyy-MM-dd');
            const formattedEndDate = format(new Date(filters.endDate), 'yyyy-MM-dd');
                url = `http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/task/getByDate?start=${formattedStartDate}&end=${formattedEndDate}`;
                console.log('Using ADMIN API:', url, 'User Role:', userRole);
            }

            const response = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('API Error:', response.status, errorText);
                throw new Error(`API request failed: ${response.status} ${errorText}`);
            }

            const data = await response.json();
            console.log('API Response:', data);

            // Ensure data is an array
            const tasksArray = (Array.isArray(data) ? data : [])
                .filter((task: Record<string, unknown>) => task.taskType === 'complaint' || task.taskType === 'requirement')
                .map((task: Record<string, unknown>) => ({
                    id: Number(task.id) || 0,
                    taskTitle: String(task.taskTitle || ''),
                    taskDesciption: String(task.taskDesciption || ''),
                    dueDate: String(task.dueDate || ''),
                    assignedToId: Number(task.assignedToId) || 0,
                    assignedToName: String(task.assignedToName || 'Unknown'),
                    assignedById: Number(task.assignedById) || 0,
                    status: String(task.status || ''),
                    priority: String(task.priority || ''),
                    category: String(task.category || ''),
                    storeId: Number(task.storeId) || 0,
                    storeName: String(task.storeName || ''),
                    storeCity: String(task.storeCity || ''),
                    taskType: String(task.taskType || ''),
                    imageCount: Number(task.imageCount) || 0,
                } as Task))
                .sort((a: Task, b: Task) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());

            setTasks(tasksArray);
            setIsLoading(false);
        } catch (error) {
            console.error('Error fetching tasks:', error);
            setIsLoading(false);
        }
    }, [token, userRole, userData, isManager, teamIds, filters.startDate, filters.endDate]);

    const fetchEmployees = useCallback(async () => {
        if (!token) return;
        
        try {
            const data = await API.getAllEmployees<Employee>();
            const sortedEmployees = sortBy(data, (emp: Employee) => `${emp.firstName} ${emp.lastName}`);
            setAllEmployees(sortedEmployees);
        } catch (error) {
            console.error('Error fetching employees:', error);
        }
    }, [token]);

    const fetchStores = useCallback(async (employeeId?: number, searchTerm: string = '', page: number = 0, size: number = 500, sortBy: string = 'storeName', sortOrder: string = 'asc') => {
        if (!token || !employeeId) return;
        
        setIsStoresLoading(true);
        try {
            const params = new URLSearchParams({
                employeeId: employeeId.toString(),
                searchTerm,
                page: page.toString(),
                size: size.toString(),
                sortBy,
                sortOrder,
            });
            const url = `http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/store/getStoreNamesByEmployee?${params.toString()}`;
            
            const response = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            const data = await response.json();
            setStores(data.content || []);
        } catch (error) {
            console.error('Error fetching stores:', error);
        } finally {
            setIsStoresLoading(false);
        }
    }, [token]);

    // Hydrate filters on mount before fetching
    useEffect(() => {
        try {
            const raw = sessionStorage.getItem(FILTER_STATE_KEY);
            if (raw) {
                const saved = JSON.parse(raw);
                if (saved?.filters) setFilters((prev) => ({ ...prev, ...saved.filters }));
                if (typeof saved?.currentPage === 'number') setCurrentPage(saved.currentPage);
                if (typeof saved?.pageSize === 'number') setPageSize(saved.pageSize);
            }
        } catch {}
        setIsFiltersHydrated(true);
    }, []);

    // Persist filters on change
    useEffect(() => {
        if (!isFiltersHydrated) return;
        try {
            sessionStorage.setItem(
                FILTER_STATE_KEY,
                JSON.stringify({ filters, currentPage, pageSize })
            );
        } catch {}
    }, [filters, currentPage, pageSize, isFiltersHydrated]);

    useEffect(() => {
        if (!isFiltersHydrated) return;
        fetchTasks();
    }, [fetchTasks, teamId, isFiltersHydrated]);

    // Reset to first page when filters change
    useEffect(() => {
        setCurrentPage(0);
    }, [filters]);

    useEffect(() => {
        fetchEmployees();
    }, [fetchEmployees]);

    // Get employees for assignment dropdown based on user role
    const assignmentEmployees = isManager ? teamMembers : allEmployees;

    // Remove automatic store fetching - now only fetches when dropdown is clicked

    const applyFilters = useCallback(() => {
        const searchLower = filters.search.toLowerCase();
        const filtered = tasks.filter((task) => {
            const matchesType = task.taskType === 'complaint' || task.taskType === 'requirement';
            if (!matchesType) return false;

            const matchesSearch =
                (task.taskTitle?.toLowerCase() || '').includes(searchLower) ||
                (task.taskDesciption?.toLowerCase() || '').includes(searchLower) ||
                (task.storeName?.toLowerCase() || '').includes(searchLower) ||
                (task.assignedToName?.toLowerCase() || '').includes(searchLower);

            const matchesEmployee =
                filters.employee === '' ||
                filters.employee === 'all' ||
                task.assignedToId === parseInt(filters.employee, 10);

            const matchesPriority =
                filters.priority === '' ||
                filters.priority === 'all' ||
                task.priority === filters.priority;

            const matchesStatus =
                filters.status === '' ||
                filters.status === 'all'
                    ? task.status !== 'Complete'
                    : task.status === filters.status;

            const matchesDateRange =
                isManager ||
                (
                    (filters.startDate === '' || new Date(task.dueDate) >= new Date(filters.startDate)) &&
                    (filters.endDate === '' || new Date(task.dueDate) <= new Date(filters.endDate))
                );

            return matchesSearch && matchesEmployee && matchesPriority && matchesStatus && matchesDateRange;
        });

        const nextTotalPages = filtered.length === 0 ? 0 : Math.ceil(filtered.length / pageSize);
        setFilteredTasks(filtered);
        setTotalElements(filtered.length);
        setTotalPages(nextTotalPages);
        if (nextTotalPages === 0) {
            if (currentPage !== 0) setCurrentPage(0);
        } else if (currentPage >= nextTotalPages) {
            setCurrentPage(Math.max(0, nextTotalPages - 1));
        }
    }, [tasks, filters, isManager, pageSize, currentPage]);

    useEffect(() => {
        if (tasks.length > 0) {
            const uniqueEmployees = uniqBy(tasks.map(task => ({
                id: task.assignedToId,
                name: task.assignedToName
            })), 'id');
            const sortedEmployees = sortBy(uniqueEmployees, 'name');
            setFilterEmployees(sortedEmployees);
        }
    }, [tasks]);

    useEffect(() => {
        applyFilters();
    }, [applyFilters]);

    // Populate employee options for SearchableSelect
    useEffect(() => {
        const assignmentEmployees = isManager ? teamMembers : allEmployees;
        const options = assignmentEmployees.map(emp => ({
            value: emp.id.toString(),
            label: `${emp.firstName} ${emp.lastName}`
        })).sort((a, b) => a.label.localeCompare(b.label));
        setEmployeeOptions(options);
    }, [allEmployees, teamMembers, isManager]);

    // Populate store options for SearchableSelect
    useEffect(() => {
        const options = stores.map(store => ({
            value: store.id.toString(),
            label: store.storeName
        })).sort((a, b) => a.label.localeCompare(b.label));
        setStoreOptions(options);
    }, [stores]);

    const selectedStoreOption = useMemo(
        () => storeOptions.find((option) => option.value === selectedStore[0]) ?? null,
        [selectedStore, storeOptions]
    );

    const storeSelectStyles: StylesConfig<SearchableSelectOption, false> = {
        control: (base, state) => ({
            ...base,
            minHeight: 40,
            borderRadius: 6,
            backgroundColor: 'hsl(var(--background))',
            borderColor: state.isFocused ? 'hsl(var(--ring))' : 'hsl(var(--input))',
            boxShadow: state.isFocused ? '0 0 0 1px hsl(var(--ring))' : 'none',
            '&:hover': {
                borderColor: state.isFocused ? 'hsl(var(--ring))' : 'hsl(var(--input))',
            },
        }),
        valueContainer: (base) => ({ ...base, paddingLeft: 12, paddingRight: 8 }),
        singleValue: (base) => ({ ...base, color: 'hsl(var(--foreground))' }),
        placeholder: (base) => ({ ...base, color: 'hsl(var(--muted-foreground))' }),
        input: (base) => ({ ...base, color: 'hsl(var(--foreground))' }),
        indicatorSeparator: (base) => ({ ...base, backgroundColor: 'hsl(var(--border))' }),
        dropdownIndicator: (base) => ({
            ...base,
            color: 'hsl(var(--muted-foreground))',
            '&:hover': { color: 'hsl(var(--foreground))' },
        }),
        clearIndicator: (base) => ({
            ...base,
            color: 'hsl(var(--muted-foreground))',
            '&:hover': { color: 'hsl(var(--foreground))' },
        }),
        menu: (base) => ({
            ...base,
            backgroundColor: 'hsl(var(--popover))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 6,
            boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
            overflow: 'hidden',
            zIndex: 99999,
        }),
        menuList: (base) => ({ ...base, paddingTop: 4, paddingBottom: 4, maxHeight: 220 }),
        option: (base, state) => ({
            ...base,
            backgroundColor: state.isSelected
                ? 'hsl(var(--accent))'
                : state.isFocused
                    ? 'hsl(var(--muted))'
                    : 'transparent',
            color: 'hsl(var(--foreground))',
            cursor: 'pointer',
            fontSize: 14,
        }),
        noOptionsMessage: (base) => ({ ...base, color: 'hsl(var(--muted-foreground))' }),
        loadingMessage: (base) => ({ ...base, color: 'hsl(var(--muted-foreground))' }),
    };

    const createTask = async () => {
        if (!token) return;
        const assignedById = userData?.employeeId;
        if (!assignedById) {
            setErrorMessage('Unable to identify the logged-in employee. Please sign in again.');
            return;
        }
        
        try {
            const taskToCreate = {
                ...newTask,
                assignedById,
                taskDesciption: newTask.taskDesciption, // Backend expects taskDesciption without 'r'
                taskType: 'complaint',
            };

            const response = await fetch('http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/task/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(taskToCreate),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || `Failed to create complaint (${response.status})`);
            }
            const data = await response.json();

            const createdTask = {
                ...taskToCreate,
                id: data.id,
                assignedToName: assignmentEmployees.find(emp => emp.id === newTask.assignedToId)?.firstName + ' ' + assignmentEmployees.find(emp => emp.id === newTask.assignedToId)?.lastName || 'Unknown',
                storeName: stores.find(store => store.id === newTask.storeId)?.storeName || '',
            };

            setTasks(prevTasks => [createdTask, ...prevTasks]);

            setIsModalOpen(false);
            resetForm();
        } catch (error) {
            console.error('Error creating task:', error);
            setErrorMessage(error instanceof Error ? error.message : 'Failed to create complaint');
        }
    };

    const handleStatusChange = (task: Task) => {
        setSelectedTask(task);
        setTaskToUpdate(task.id);
        setSelectedStatus(task.status);
        setIsStatusModalOpen(true);
    };

    const resetStatusModal = () => {
        setIsStatusModalOpen(false);
        setTaskToUpdate(null);
        setSelectedStatus('');
        setSelectedTask(null);
    };

    const confirmStatusUpdate = async () => {
        if (!token || taskToUpdate === null) return;

        if (selectedTask && selectedStatus === selectedTask.status) {
            resetStatusModal();
            return;
        }
        
        try {
            const response = await fetch(
                `http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/task/updateTask?taskId=${taskToUpdate}`,
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ status: selectedStatus }),
                }
            );

            if (response.ok) {
                setTasks((prevTasks) =>
                    prevTasks.map((task) =>
                        task.id === taskToUpdate ? { ...task, status: selectedStatus } : task
                    )
                );
                resetStatusModal();
            } else {
                console.error('Failed to update task status');
            }
        } catch (error) {
            console.error('Error updating task status:', error);
        }
    };

    const deleteTask = async (taskId: number) => {
        if (!token) return;
        
        try {
            await fetch(`http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/task/deleteById?taskId=${taskId}`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            fetchTasks();
        } catch (error) {
            console.error('Error deleting task:', error);
        }
    };


    const handleFilterChange = (key: string, value: string) => {
        setFilters((prevFilters) => ({
            ...prevFilters,
            [key]: value,
        }));
    };

    // SearchableSelect handlers
    const handleEmployeeSelect = (value: string) => {
        if (!value) {
            setNewTask({
                ...newTask,
                assignedToId: 0,
                assignedToName: '',
                storeId: 0,
                storeName: ''
            });
            setStores([]);
            setSelectedStore([]);
            return;
        }

        const selectedEmp = assignmentEmployees.find(emp => emp.id.toString() === value);
        setNewTask({
            ...newTask,
            assignedToId: parseInt(value, 10),
            assignedToName: selectedEmp ? `${selectedEmp.firstName} ${selectedEmp.lastName}` : 'Unknown',
            storeId: 0,
            storeName: ''
        });
        setStores([]);
        setSelectedStore([]);
        fetchStores(parseInt(value, 10));
        setEmployeeSearchTerm('');
        setIsAssignPopoverOpen(false);
    };

    const handleStoreSelect = (values: string[]) => {
        setSelectedStore(values);
        if (values.length > 0) {
            const selectedStore = stores.find(store => store.id.toString() === values[0]);
            setNewTask({ 
                ...newTask, 
                storeId: parseInt(values[0]), 
                storeName: selectedStore ? selectedStore.storeName : 'Unknown'
            });
        } else {
            setNewTask({ 
                ...newTask, 
                storeId: 0, 
                storeName: ''
            });
        }
    };

    const handleStoreOptionSelect = (option: SingleValue<SearchableSelectOption>) => {
        handleStoreSelect(option ? [option.value] : []);
    };

    // Reset form function
    const resetForm = () => {
        setNewTask({
            id: 0,
            taskTitle: '',
            taskDesciption: '',
            dueDate: '',
            assignedToId: 0,
            assignedToName: '',
            assignedById: 0,
            status: 'Assigned',
            priority: 'low',
            category: 'Complaint',
            storeId: 0,
            storeName: '',
            storeCity: '',
            taskType: 'complaint',
            imageCount: 0
        });
        setSelectedStore([]);
        setStores([]);
        setActiveTab('general');
    };

    const paginatedTasks = useMemo(() => {
        const startIndex = currentPage * pageSize;
        const endIndex = startIndex + pageSize;
        return filteredTasks.slice(startIndex, endIndex);
    }, [filteredTasks, currentPage, pageSize]);

    const getStatusInfo = (status: string): { icon: React.ReactNode; color: string } => {
        switch (status.toLowerCase()) {
            case 'assigned':
                return { icon: <Clock className="w-4 h-4" />, color: 'bg-purple-100 text-purple-800' };
            case 'work in progress':
                return { icon: <Loader className="w-4 h-4 animate-spin" />, color: 'bg-blue-100 text-blue-800' };
            case 'complete':
                return { icon: <CheckCircle className="w-4 h-4" />, color: 'bg-green-100 text-green-800' };
            default:
                return { icon: <AlertTriangle className="w-4 h-4" />, color: 'bg-gray-100 text-gray-800' };
        }
    };

    const fetchTaskImages = async (taskId: number) => {
        setIsLoadingImages(true);
        try {
            // First, fetch the task details
            const taskResponse = await fetch(`http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/task/getById?id=${taskId}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (!taskResponse.ok) {
                throw new Error('Failed to fetch task details');
            }
            const taskData = await taskResponse.json();
    
            // Extract file names from the attachmentResponse
            const fileNames = taskData.attachmentResponse
                .filter((attachment: AttachmentResponse) => attachment.tag === 'check-in')
                .map((attachment: AttachmentResponse) => attachment.fileName);
    
            // Now fetch each image using the file names
            const imageUrls = await Promise.all(
                fileNames.map(async (fileName: string) => {
                    const imageResponse = await fetch(
                        `http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/task/downloadFile/${taskId}/check-in/${fileName}`,
                        {
                            headers: {
                                Authorization: `Bearer ${token}`,
                            },
                        }
                    );
                    if (imageResponse.ok) {
                        const blob = await imageResponse.blob();
                        return URL.createObjectURL(blob);
                    }
                    return null;
                })
            );
    
            setTaskImages(imageUrls.filter((url): url is string => url !== null));
            setIsImagePreviewOpen(true);
        } catch (error) {
            console.error('Error fetching task images:', error);
        } finally {
            setIsLoadingImages(false);
        }
  };

    const filteredEmployeeOptions = useMemo(() => {
        const query = employeeSearchTerm.trim().toLowerCase();
        if (!query) return employeeOptions;
        return employeeOptions.filter((option) => option.label.toLowerCase().includes(query));
    }, [employeeOptions, employeeSearchTerm]);

    const selectedEmployeeLabel = useMemo(() => {
        if (!newTask.assignedToId) return '';
        return employeeOptions.find((opt) => opt.value === newTask.assignedToId.toString())?.label ?? '';
    }, [employeeOptions, newTask.assignedToId]);

  return (
        <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8">
            <div className="mb-6 flex flex-wrap gap-4 items-center">
                <div className="flex-grow lg:flex-grow-0 lg:w-64 flex items-center gap-2">
                    <div className="relative w-full">
                        <Input
                            placeholder="Search complaints"
                            value={filters.search}
                            onChange={(e) => handleFilterChange('search', e.target.value)}
                            className="w-full pr-10"
                        />
                        {filters.search && (
                            <button
                                type="button"
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                onClick={() => handleFilterChange('search', '')}
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                    <Button onClick={() => setIsModalOpen(true)}>
                        <PlusCircle className="w-4 h-4 mr-2" /> New
                    </Button>
                </div>
                <div className="flex-shrink-0">
                    <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setIsFilterDrawerOpen(true)}>
                        <Filter className="w-4 h-4 mr-2" />
                        Filters
                    </Button>
                </div>
                <div className="hidden lg:flex flex-wrap gap-4 items-center">
                    <Popover open={filterEmployeePopoverOpen} onOpenChange={setFilterEmployeePopoverOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="w-[220px] justify-between">
                                <span className="truncate text-left">
                                    {filters.employee === '' || filters.employee === 'all'
                                        ? 'All Employees'
                                        : filterEmployees.find((emp) => emp.id.toString() === filters.employee)?.name || 'All Employees'}
                                </span>
                                <Search className="h-4 w-4 text-muted-foreground" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[280px] p-0" align="start">
                            <div className="p-3 border-b">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        placeholder="Search employees..."
                                        value={filterEmployeeSearch}
                                        onChange={(event) => setFilterEmployeeSearch(event.target.value)}
                                        className="pl-9"
                                    />
                                </div>
                            </div>
                            <div className="max-h-64 overflow-y-auto">
                                <button
                                    type="button"
                                    className={`flex w-full items-center justify-between px-4 py-2 text-sm ${
                                        filters.employee === '' || filters.employee === 'all'
                                            ? 'bg-primary/10 text-primary font-semibold'
                                            : 'hover:bg-muted/40'
                                    }`}
                                    onClick={() => {
                                        handleFilterChange('employee', 'all');
                                        setFilterEmployeePopoverOpen(false);
                                        setFilterEmployeeSearch('');
                                    }}
                                >
                                    <span>All Employees</span>
                                    {(filters.employee === '' || filters.employee === 'all') && <Check className="h-4 w-4 text-primary" />}
                                </button>
                                {filterEmployees
                                    .filter((employee) =>
                                        employee.name.toLowerCase().includes(filterEmployeeSearch.trim().toLowerCase())
                                    )
                                    .map((employee) => {
                                        const value = employee.id.toString();
                                        const isSelected = filters.employee === value;
                                        return (
                                            <button
                                                key={employee.id}
                                                type="button"
                                                className={`flex w-full items-center justify-between px-4 py-2 text-sm ${
                                                    isSelected ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-muted/40'
                                                }`}
                                                onClick={() => {
                                                    handleFilterChange('employee', value);
                                                    setFilterEmployeePopoverOpen(false);
                                                    setFilterEmployeeSearch('');
                                                }}
                                            >
                                                <span className="truncate text-left">{employee.name}</span>
                                                {isSelected && <Check className="h-4 w-4 text-primary" />}
                                            </button>
                                        );
                                    })}
                            </div>
                        </PopoverContent>
                    </Popover>
                    <Select value={filters.priority} onValueChange={(value) => handleFilterChange('priority', value)}>
                        <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Filter by priority" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Priorities</SelectItem>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
                        <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Filter by status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Open Statuses</SelectItem>
                            <SelectItem value="Assigned">Assigned</SelectItem>
                            <SelectItem value="Work In Progress">Work In Progress</SelectItem>
                            <SelectItem value="Complete">Complete</SelectItem>
                        </SelectContent>
                    </Select>
                    {/* Only show date filters for admin users */}
                    {!isManager && (
                        <>
                    <div className="flex items-center space-x-2">
                        <Label htmlFor="startDate">From:</Label>
                                <Popover modal={false} open={isStartDatePopoverOpen} onOpenChange={setIsStartDatePopoverOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className={`w-[140px] justify-start text-left font-normal ${!filters.startDate && 'text-muted-foreground'}`}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {filters.startDate ? format(new Date(filters.startDate), 'MMM d, yyyy') : <span>Pick start date</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start" side="bottom" onInteractOutside={(e)=>e.preventDefault()} onPointerDownOutside={(e)=>e.preventDefault()}>
                                        <SpacedCalendar
                                            mode="single"
                                            selected={filters.startDate ? new Date(filters.startDate) : undefined}
                                            onSelect={(date) => {
                                                handleDateChange('startDate', formatDateForFilter(date));
                                                setIsStartDatePopoverOpen(false);
                                            }}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Label htmlFor="endDate">To:</Label>
                                <Popover modal={false} open={isEndDatePopoverOpen} onOpenChange={setIsEndDatePopoverOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className={`w-[140px] justify-start text-left font-normal ${!filters.endDate && 'text-muted-foreground'}`}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {filters.endDate ? format(new Date(filters.endDate), 'MMM d, yyyy') : <span>Pick end date</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start" side="bottom" onInteractOutside={(e)=>e.preventDefault()} onPointerDownOutside={(e)=>e.preventDefault()}>
                                        <SpacedCalendar
                                            mode="single"
                                            selected={filters.endDate ? new Date(filters.endDate) : undefined}
                                            onSelect={(date) => {
                                                handleDateChange('endDate', formatDateForFilter(date));
                                                setIsEndDatePopoverOpen(false);
                                            }}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                    </div>
                        </>
                    )}
                </div>
            </div>

            <Dialog open={isModalOpen} onOpenChange={(open: boolean) => {
                setIsModalOpen(open);
                if (!open) {
                    resetForm();
                }
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create New Complaint</DialogTitle>
                        <DialogDescription>Fill in the details to create a new complaint.</DialogDescription>
                    </DialogHeader>
                    <Tabs value={activeTab} className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="general" disabled={activeTab === 'details'}>General</TabsTrigger>
                            <TabsTrigger value="details" disabled={activeTab === 'general'}>Details</TabsTrigger>
                        </TabsList>
                        <TabsContent value="general">
                            <div className="grid gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="taskTitle">Complaint Title</Label>
                                    <Input
                                        id="taskTitle"
                                        placeholder="Enter complaint title"
                                        value={newTask.taskTitle}
                                        onChange={(e) => setNewTask({ ...newTask, taskTitle: e.target.value })}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="taskDesciption">Complaint Description</Label>
                                    <Input
                                        id="taskDesciption"
                                        placeholder="Enter complaint description"
                                        value={newTask.taskDesciption}
                                        onChange={(e) => setNewTask({ ...newTask, taskDesciption: e.target.value })}
                                    />
          </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="category">Category</Label>
                                    <Select value={newTask.category} onValueChange={(value) => setNewTask({ ...newTask, category: value })}>
                                        <SelectTrigger className="w-[280px]">
                                            <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                                            <SelectItem value="Complaint">Complaint</SelectItem>
              </SelectContent>
            </Select>
          </div>
                                <div className="flex justify-between mt-4">
                                    <Button variant="outline" onClick={() => {
                                        setIsModalOpen(false);
                                        resetForm();
                                    }}>Cancel</Button>
                                    <Button onClick={handleNext} disabled={isTabLoading}>
                                        {isTabLoading ? (
                                            <>
                                                <Loader className="w-4 h-4 mr-2 animate-spin" />
                                                Loading...
                                            </>
                                        ) : (
                                            'Next'
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </TabsContent>
                        <TabsContent value="details">
                            <div className="grid gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="dueDate">Due Date</Label>
                                    <Popover modal={false} open={isDatePopoverOpen} onOpenChange={setIsDatePopoverOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className={`w-[280px] justify-start text-left font-normal ${!newTask.dueDate && 'text-muted-foreground'}`}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {newTask.dueDate ? format(new Date(newTask.dueDate), 'PPP') : <span>Pick a date</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start" side="bottom" onInteractOutside={(e)=>e.preventDefault()} onPointerDownOutside={(e)=>e.preventDefault()}>
                                            <SpacedCalendar
                                                mode="single"
                                                selected={newTask.dueDate ? new Date(newTask.dueDate) : undefined}
                                                onSelect={(date) => {
                                                    if (date) {
                                                        // Use local date format to avoid timezone issues
                                                        const year = date.getFullYear();
                                                        const month = String(date.getMonth() + 1).padStart(2, '0');
                                                        const day = String(date.getDate()).padStart(2, '0');
                                                        const dateString = `${year}-${month}-${day}`;
                                                        setNewTask({ ...newTask, dueDate: dateString });
                                                    } else {
                                                        setNewTask({ ...newTask, dueDate: '' });
                                                    }
                                                    setIsDatePopoverOpen(false);
                                                }}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="assignedToId">
                                        Assigned To {isManager && teamMembers.length > 0 && <span className="text-xs text-muted-foreground">(Team Members Only)</span>}
                                    </Label>
                                    <Popover
                                        open={isAssignPopoverOpen}
                                        onOpenChange={(open) => {
                                            if (employeeOptions.length === 0) return;
                                            setIsAssignPopoverOpen(open);
                                        }}
                                    >
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className="w-[280px] justify-between text-left font-normal"
                                                disabled={employeeOptions.length === 0}
                                            >
                                                <span className={`truncate ${selectedEmployeeLabel ? 'text-foreground' : 'text-muted-foreground'}`}>
                                                    {selectedEmployeeLabel ||
                                                        (isManager && teamMembers.length === 0 && allEmployees.length > 0
                                                            ? "Loading team members..."
                                                            : employeeOptions.length === 0
                                                            ? "No employees available"
                                                            : "Select an employee")}
                                                </span>
                                                <Search className="h-4 w-4 text-muted-foreground" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[320px] p-0" align="start">
                                            <div className="p-3 border-b">
                                                <div className="relative">
                                                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                                    <Input
                                                        placeholder="Search employees..."
                                                        value={employeeSearchTerm}
                                                        onChange={(event) => setEmployeeSearchTerm(event.target.value)}
                                                        className="pl-9"
                                                    />
                                                </div>
                                            </div>
                                            <div className="max-h-64 overflow-y-auto">
                                                {filteredEmployeeOptions.length === 0 ? (
                                                    <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                                                        {employeeOptions.length === 0 ? "No employees available" : "No matches found"}
                                                    </div>
                                                ) : (
                                                    filteredEmployeeOptions.map((option) => {
                                                        const isSelected = option.value === newTask.assignedToId.toString();
                                                        return (
                                                            <button
                                                                key={option.value}
                                                                type="button"
                                                                className={`flex w-full items-center justify-between px-4 py-2 text-sm ${
                                                                    isSelected ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-muted/40'
                                                                }`}
                                                                onClick={() => handleEmployeeSelect(option.value)}
                                                            >
                                                                <span className="truncate text-left">{option.label}</span>
                                                                {isSelected && <Check className="h-4 w-4 text-primary" />}
                                                            </button>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </PopoverContent>
                                    </Popover>
          </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="priority">Priority</Label>
                                    <Select value={newTask.priority} onValueChange={(value) => setNewTask({ ...newTask, priority: value })}>
                                        <SelectTrigger className="w-[280px]">
                                            <SelectValue placeholder="Select a priority" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="low">Low</SelectItem>
                                            <SelectItem value="medium">Medium</SelectItem>
                                            <SelectItem value="high">High</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="storeId">Store</Label>
                                    <ReactSelect
                                        options={storeOptions}
                                        value={selectedStoreOption}
                                        onChange={handleStoreOptionSelect}
                                        placeholder={
                                            isStoresLoading ? "Loading stores..." : 
                                            !newTask.assignedToId ? "Select employee first" : 
                                            "Select a store"
                                        }
                                        className="w-[280px]"
                                        classNamePrefix="select"
                                        styles={storeSelectStyles}
                                        isSearchable
                                        isClearable
                                        isDisabled={!newTask.assignedToId}
                                        isLoading={isStoresLoading}
                                        backspaceRemovesValue
                                        noOptionsMessage={() => "No matching stores found"}
                                    />
          </div>
                                <div className="flex justify-between mt-4">
                                    <Button variant="outline" onClick={handleBack}>Back</Button>
                                    <Button onClick={createTask}>Create Complaint</Button>
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                </DialogContent>
            </Dialog>

            {isLoading ? (
                <div className="flex justify-center items-center h-64">
                    <Loader className="w-8 h-8 animate-spin text-primary" />
                </div>
            ) : totalElements === 0 ? (
                <div className="text-center py-10">
                    <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                    <p className="text-xl font-semibold">No complaints found.</p>
                    <p className="text-gray-500 mt-2">Try adjusting your filters or create a new complaint.</p>
                </div>
            ) : (
                <div className="flex flex-wrap -mx-2">
                    {paginatedTasks.map((task, index) => (
                            <motion.div
                                key={task.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3, delay: index * 0.1 }}
                                className="w-full sm:w-1/2 lg:w-1/3 p-2"
                            >
                                <Card className="relative h-full overflow-visible shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
                                    <CardHeader className="pb-2">
                                        <div className="flex justify-between items-center">
                                            <Badge className={`${getStatusInfo(task.status).color} px-3 py-1 rounded-full font-semibold flex items-center space-x-2`}>
                                                {getStatusInfo(task.status).icon} <span>{task.status}</span>
                                            </Badge>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="sm">
                                                        <MoreHorizontal className="h-4 w-4" />
            </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => handleViewStore(task.storeId)}>
                                                        <Building className="mr-2 h-4 w-4" /> View Store
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onClick={() => handleStatusChange(task)}>
                                                        <Clock className="mr-2 h-4 w-4" /> Change Status
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onClick={() => deleteTask(task.id)} className="text-red-600">
                                                        <Trash2 className="mr-2 h-4 w-4" /> Delete Complaint
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                        <CardTitle className="text-xl mt-2">{task.taskTitle || 'Untitled Complaint'}</CardTitle>
                                        <CardDescription className="flex items-center mt-1 text-card-foreground">
                                            <Building className="w-4 h-4 mr-2 text-primary" />
                                            {task.storeName}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        {task.taskDesciption && (
                                            <div className="relative group mb-4 pb-4 border-b border-border">
                                                <p className="text-sm font-medium text-card-foreground dark:text-white line-clamp-2">
                                                    {task.taskDesciption}
                                                </p>
                                                {task.taskDesciption.length > 80 && (
                                                    <div className="pointer-events-none absolute left-1/2 bottom-full z-50 mb-3 w-full max-w-md -translate-x-1/2 -translate-y-2 rounded-xl border border-primary/40 bg-black p-4 text-white shadow-2xl opacity-0 invisible transition-all duration-200 group-hover:visible group-hover:opacity-100 group-hover:translate-y-0">
                                                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{task.taskDesciption}</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        <div className="grid grid-cols-2 gap-4 mb-4">
                                            <div className="flex items-center space-x-2">
                                                <User className="w-4 h-4 text-indigo-500" />
                                                <div>
                                                    <span className="text-sm text-white">Assigned to</span>
                                                    <p className="font-medium">{task.assignedToName}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <Target className="w-4 h-4 text-purple-500" />
                                                <div>
                                                    <span className="text-sm text-white">Priority</span>
                                                    <p className="font-medium capitalize">{task.priority}</p>
                                                </div>
          </div>
        </div>
                                        <div className="flex items-center space-x-2 text-sm text-white">
                                            <CalendarIcon2 className="w-4 h-4" />
                                            <span>Due: {format(new Date(task.dueDate), 'MMM d, yyyy')}</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
                </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
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
                            onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                            disabled={currentPage === 0}
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Previous
                        </Button>
                        <span className="text-sm text-muted-foreground">
                            Page {currentPage + 1} of {totalPages}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
                            disabled={currentPage >= totalPages - 1}
                        >
                            Next
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}

            {isImagePreviewOpen && (
                <Dialog open={isImagePreviewOpen} onOpenChange={setIsImagePreviewOpen}>
                    <DialogContent className="max-w-3xl">
                        <DialogHeader>
                            <DialogTitle>Image Preview</DialogTitle>
                        </DialogHeader>
                        {isLoadingImages ? (
                            <div className="flex justify-center items-center h-64">
                                <Loader className="w-8 h-8 animate-spin text-primary" />
                                <span className="ml-2">Loading images...</span>
          </div>
        ) : (
                            <>
                                <div className="relative">
                                    <img
                                        src={taskImages[currentImageIndex]}
                                        alt={`Image ${currentImageIndex + 1}`}
                                        className="w-full h-auto"
                                    />
                                    {taskImages.length > 1 && (
                                        <>
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="absolute left-2 top-1/2 transform -translate-y-1/2"
                                                onClick={() => setCurrentImageIndex((prev) => (prev === 0 ? taskImages.length - 1 : prev - 1))}
                                            >
                                                <ChevronLeft className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="absolute right-2 top-1/2 transform -translate-y-1/2"
                                                onClick={() => setCurrentImageIndex((prev) => (prev === taskImages.length - 1 ? 0 : prev + 1))}
                                            >
                                                <ChevronRight className="h-4 w-4" />
                                            </Button>
                                        </>
                                    )}
          </div>
                                <p className="text-center mt-2">
                                    Image {currentImageIndex + 1} of {taskImages.length}
                                </p>
                            </>
                        )}
                    </DialogContent>
                </Dialog>
            )}

            {/* Status Update Modal */}
            <Dialog
                open={isStatusModalOpen}
                onOpenChange={(open) => {
                    if (open) {
                        setIsStatusModalOpen(true);
                    } else {
                        resetStatusModal();
                    }
                }}
            >
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Change Status</DialogTitle>
                        <DialogDescription>
                            Update the workflow state for{" "}
                            <strong>{selectedTask?.taskTitle || "this complaint"}</strong>.
                        </DialogDescription>
                    </DialogHeader>
                    {selectedTask && (
                        <div className="space-y-6">
                            <div className="space-y-3 rounded-xl border border-border/60 bg-muted/30 p-4">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Complaint</p>
                                    <p className="text-lg font-semibold text-card-foreground">
                                        {selectedTask.taskTitle || "Untitled Complaint"}
                                    </p>
                                    <p className="text-sm text-muted-foreground">{selectedTask.storeName}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <p className="text-xs uppercase text-muted-foreground">Assigned To</p>
                                        <p className="font-semibold text-card-foreground">{selectedTask.assignedToName}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs uppercase text-muted-foreground">Due Date</p>
                                        <p className="font-semibold text-card-foreground">
                                            {selectedTask.dueDate ? format(new Date(selectedTask.dueDate), 'MMM d, yyyy') : 'Not set'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <p className="text-xs uppercase text-muted-foreground">Current Status</p>
                                    <Badge variant="secondary" className="text-xs">
                                        {selectedTask.status}
                                    </Badge>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="complaint-status">New Status</Label>
                                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                                    <SelectTrigger id="complaint-status" className="w-full">
                                        <SelectValue placeholder="Select new status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {statusOptions.map((status) => (
                                            <SelectItem key={status} value={status}>
                                                {status}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex justify-end gap-3">
                                <Button variant="outline" onClick={resetStatusModal}>
                                    Cancel
                                </Button>
                                <Button
                                    onClick={confirmStatusUpdate}
                                    disabled={!selectedStatus || selectedStatus === selectedTask.status}
                                >
                                    Update Status
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Mobile Filter Sheet */}
            <Sheet open={isFilterDrawerOpen} onOpenChange={setIsFilterDrawerOpen}>
                <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                    <SheetHeader>
                        <SheetTitle>Filter Complaints</SheetTitle>
                    </SheetHeader>
                    <div className="space-y-6 py-4">
                        {/* Employee Filter */}
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Employee</Label>
                            <Select value={filters.employee} onValueChange={(value) => handleFilterChange('employee', value)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Filter by employee" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Employees</SelectItem>
                                    {filterEmployees.map((employee) => (
                                        <SelectItem key={employee.id} value={employee.id.toString()}>
                                            {employee.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Priority Filter */}
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Priority</Label>
                            <Select value={filters.priority} onValueChange={(value) => handleFilterChange('priority', value)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Filter by priority" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Priorities</SelectItem>
                                    <SelectItem value="low">Low</SelectItem>
                                    <SelectItem value="medium">Medium</SelectItem>
                                    <SelectItem value="high">High</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Status Filter */}
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Status</Label>
                            <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Filter by status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Open Statuses</SelectItem>
                                    <SelectItem value="Assigned">Assigned</SelectItem>
                                    <SelectItem value="Work In Progress">Work In Progress</SelectItem>
                                    <SelectItem value="Complete">Complete</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Date Filters - Only show for admin users */}
                        {!isManager && (
                            <>
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium">Start Date</Label>
                                    <Popover modal={false} open={isFilterStartDatePopoverOpen} onOpenChange={setIsFilterStartDatePopoverOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className={`w-full justify-start text-left font-normal ${!filters.startDate && 'text-muted-foreground'}`}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {filters.startDate ? format(new Date(filters.startDate), 'MMM d, yyyy') : <span>Pick start date</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start" side="bottom" onInteractOutside={(e)=>e.preventDefault()} onPointerDownOutside={(e)=>e.preventDefault()}>
                                            <SpacedCalendar
                                                mode="single"
                                                selected={filters.startDate ? new Date(filters.startDate) : undefined}
                                                onSelect={(date) => {
                                                    handleDateChange('startDate', formatDateForFilter(date));
                                                    setIsFilterStartDatePopoverOpen(false);
                                                }}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-sm font-medium">End Date</Label>
                                    <Popover modal={false} open={isFilterEndDatePopoverOpen} onOpenChange={setIsFilterEndDatePopoverOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className={`w-full justify-start text-left font-normal ${!filters.endDate && 'text-muted-foreground'}`}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {filters.endDate ? format(new Date(filters.endDate), 'MMM d, yyyy') : <span>Pick end date</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start" side="bottom" onInteractOutside={(e)=>e.preventDefault()} onPointerDownOutside={(e)=>e.preventDefault()}>
                                            <SpacedCalendar
                                                mode="single"
                                                selected={filters.endDate ? new Date(filters.endDate) : undefined}
                                                onSelect={(date) => {
                                                    handleDateChange('endDate', formatDateForFilter(date));
                                                    setIsFilterEndDatePopoverOpen(false);
                                                }}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </>
                        )}
                    </div>
                    <SheetFooter className="flex gap-2">
                        <Button variant="outline" onClick={() => {
                            setFilters({
                                search: '',
                                employee: 'all',
                                priority: 'all',
                                status: 'all',
                                startDate: '',
                                endDate: ''
                            });
                        }}>
                            Clear All
                        </Button>
                        <Button onClick={() => setIsFilterDrawerOpen(false)}>
                            Apply Filters
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>
        </div>
    );
};

export default Complaints;
