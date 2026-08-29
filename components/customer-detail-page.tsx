"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import { useParams } from 'next/navigation';
import { AlertCircle, CalendarIcon, Edit, Trash2, Search, Check, MessageSquare, ClipboardList, User, Mail, Phone, Store, Tag, MapPin, Building, Flag, Loader2, Cake } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { SpacedCalendar } from '@/components/ui/spaced-calendar';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { API, type StoreDto, type VisitDto, type Note as ApiNote, type BrandProCon } from "@/lib/api";
import { useAuth } from '@/components/auth-provider';
import BrandTab from "@/components/BrandTab";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { formatDateToUserFriendly } from "@/lib/utils";
import { getApiErrorMessage, getErrorMessage } from '@/lib/api-error';
import { useGuardedRouter, useUnsavedChanges } from '@/components/unsaved-changes-provider';
import { DateRangeError, isDateRangeInvalid } from '@/components/date-range-error';

const ITEMS_PER_PAGE = 3;
const JOINING_YEAR_OPTIONS = Array.from(
    { length: 76 },
    (_, index) => new Date().getFullYear() - index,
);

interface CustomerData {
    storeId: number;
    storeName: string;
    clientFirstName: string;
    clientLastName: string;
    primaryContact: number;
    monthlySale: number | null;
    intent: number | null;
    employeeName: string;
    clientType: string | null;
    totalVisitCount: number;
    lastVisitDate: string | null;
    email: string | null;
    city: string;
    state: string;
    country: string | null;
    gstNumber?: string;
    otherClientType?: string;
    addressLine1?: string;
    addressLine2?: string;
    village?: string;
    taluka?: string;
    pincode?: string;
    dateOfBirth?: string | null;
    dob?: string | null;
    yearOfJoining?: number | null;
}

interface Visit {
    id: number;
    purpose: string;
    visit_date: string;
    employeeId: number;
    employeeName: string;
    checkinTime?: string;
    checkoutTime?: string;
    state?: string;
}

interface Note {
    id: number;
    content: string;
    createdDate: string;
    employeeName?: string;
}

interface Task {
    id: number;
    taskTitle: string;
    taskDescription: string;
    dueDate: string;
    status: string;
    priority: string;
    assignedToId?: number;
    assignedToName: string;
    taskType: string;
    storeName?: string;
}

export default function CustomerDetailPage({ customer }: { customer: Record<string, unknown> }) {
    const router = useGuardedRouter();
    const params = useParams();
    const storeId = params.id;
    const { token, userData } = useAuth();

    const [customerData, setCustomerData] = useState<Record<string, unknown> | null>(null);
    const [isLoadingCustomer, setIsLoadingCustomer] = useState(true);
    const [notesData, setNotesData] = useState<Note[]>([]);
    const [brandProCons, setBrandProCons] = useState<BrandProCon[]>([]);
    const [visitsData, setVisitsData] = useState<Visit[]>([]);
    const [visitTotalPages, setVisitTotalPages] = useState(1);
    const [visitTotalElements, setVisitTotalElements] = useState(0);
    const [requirementsData, setRequirementsData] = useState<Task[]>([]);
    const [complaintsData, setComplaintsData] = useState<Task[]>([]);
    const [employees, setEmployees] = useState<Array<Record<string, unknown>>>([]);
    const [editingTask, setEditingTask] = useState<Record<string, unknown> | null>(null);
    const [activeInfoTab, setActiveInfoTab] = useState('leads-info');
    const [isEditCustomerModalVisible, setIsEditCustomerModalVisible] = useState(false);
    const [isUpdatingCustomer, setIsUpdatingCustomer] = useState(false);
    const [customerEditError, setCustomerEditError] = useState<string | null>(null);
    const [noteContent, setNoteContent] = useState('');
    const [activeActivityTab, setActiveActivityTab] = useState('visits');
    const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
    const [activeTab, setActiveTab] = useState("basic-info");
    const [hasUnlockedAddressTab, setHasUnlockedAddressTab] = useState(false);
    const [formData, setFormData] = useState<Partial<CustomerData>>({
        storeId: 0,
        storeName: '',
        clientFirstName: '',
        clientLastName: '',
        email: '',
        primaryContact: 0,
        gstNumber: '',
        clientType: '',
        otherClientType: '',
        addressLine1: '',
        addressLine2: '',
        village: '',
        taluka: '',
        city: '',
        state: '',
        pincode: '',
        dateOfBirth: null,
        dob: null,
        yearOfJoining: null,
    });
    const [baselineFormData, setBaselineFormData] = useState<Partial<CustomerData>>({});
    const [isOtherClientType, setIsOtherClientType] = useState(false);

    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [isVisitModalVisible, setIsVisitModalVisible] = useState(false);
    const [isRequirementModalOpen, setIsRequirementModalOpen] = useState(false);
    const [isComplaintModalOpen, setIsComplaintModalOpen] = useState(false);
    const [isCreatingTask, setIsCreatingTask] = useState(false);
    const [taskCreateError, setTaskCreateError] = useState<string | null>(null);
    const [requirementTask, setRequirementTask] = useState({
        taskTitle: '',
        taskDesciption: '',
        dueDate: '',
        assignedToId: 0,
        assignedToName: '',
        assignedById: 0,
        status: 'Assigned',
        priority: 'low',
        taskType: 'requirement',
        storeId: parseInt(storeId as string),
        category: 'Requirement',
        storeName: ''
    });
    const [requirementActiveTab, setRequirementActiveTab] = useState('general');
    const [complaintTask, setComplaintTask] = useState({
        taskTitle: '',
        taskDesciption: '',
        dueDate: '',
        assignedToId: 0,
        assignedToName: '',
        assignedById: 0,
        status: 'Assigned',
        priority: 'low',
        taskType: 'complaint',
        storeId: parseInt(storeId as string),
        category: 'Complaint',
        storeName: ''
    });
    const [requirementTaskBaseline, setRequirementTaskBaseline] = useState(requirementTask);
    const [complaintTaskBaseline, setComplaintTaskBaseline] = useState(complaintTask);
    const [complaintActiveTab, setComplaintActiveTab] = useState('general');
    const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
    const [complaintEmployeeSearch, setComplaintEmployeeSearch] = useState('');
    const [requirementEmployeeSearch, setRequirementEmployeeSearch] = useState('');
    const [startDate, setStartDate] = useState(new Date());
    const [endDate, setEndDate] = useState(addDays(new Date(), 5));
    const dateRangeInvalid = isDateRangeInvalid(startDate, endDate);
    const [showSitesTab, setShowSitesTab] = useState(false);
    const [showMore, setShowMore] = useState({
        visits: true,
        notes: false,
        complaints: false,
        requirements: false,
    });
    const [isNoteSaving, setIsNoteSaving] = useState(false);
    const [notePendingDelete, setNotePendingDelete] = useState<Note | null>(null);

    const originalNoteContent = editingNoteId === null
        ? ''
        : notesData.find((note) => note.id === editingNoteId)?.content ?? '';
    const customerFormIsDirty = isEditCustomerModalVisible &&
        JSON.stringify(formData) !== JSON.stringify(baselineFormData);
    const noteDraftIsDirty = isModalVisible && noteContent !== originalNoteContent;
    const complaintDraftIsDirty = isComplaintModalOpen &&
        JSON.stringify(complaintTask) !== JSON.stringify(complaintTaskBaseline);
    const requirementDraftIsDirty = isRequirementModalOpen &&
        JSON.stringify(requirementTask) !== JSON.stringify(requirementTaskBaseline);
    const { requestDiscard } = useUnsavedChanges(
        customerFormIsDirty || noteDraftIsDirty || complaintDraftIsDirty || requirementDraftIsDirty
    );

    const [currentPage, setCurrentPage] = useState({
        visits: 1,
        notes: 1,
        complaints: 1,
        requirements: 1,
    });

    const [filteredVisitsData, setFilteredVisitsData] = useState<Visit[]>([]);
    const [intentData, setIntentData] = useState<Array<Record<string, unknown>>>([]);
    const [salesData, setSalesData] = useState<Array<Record<string, unknown>>>([]);

    const employeeId = userData?.employeeId ?? null;

    const fetchIntentData = useCallback(async (id: string) => {
        try {
            const response = await fetch(`http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/intent-audit/getByStore?id=${id}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            const data = await response.json();
            setIntentData(data);
        } catch (error) {
            console.error('Error fetching intent data:', error);
        }
    }, [token]);

    const fetchSalesData = useCallback(async (id: string) => {
        try {
            const response = await fetch(`http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/monthly-sale/getByStore?storeId=${id}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            const data = await response.json();
            setSalesData(data);
        } catch (error) {
            console.error('Error fetching sales data:', error);
        }
    }, [token]);

    const fetchCustomerData = useCallback(async (id: string) => {
        try {
            setIsLoadingCustomer(true);
            const response = await fetch(`http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/store/getById?id=${id}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            const data = await response.json();
            setCustomerData(data);

            // Set the visibility of the Sites tab based on clientType
            const validClientTypes = ['builder', 'site visit', 'architect', 'engineer'];
            setShowSitesTab(validClientTypes.includes(data.clientType?.toLowerCase() || ''));
        } catch (error) {
            console.error('Error fetching customer data:', error);
        } finally {
            setIsLoadingCustomer(false);
        }
    }, [token]);

    const fetchNotesData = useCallback(async (id: string) => {
        try {
            const response = await fetch(`http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/notes/getByStore?id=${id}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            const data = await response.json();
            setNotesData(data);
        } catch (error) {
            console.error('Error fetching notes data:', error);
        }
    }, [token]);

    const fetchVisitsData = useCallback(async (id: string, page = 1) => {
        try {
            const data = await API.getVisitsByStorePaged(Number(id), Math.max(page - 1, 0), ITEMS_PER_PAGE, 'visitDate,desc');
            const visits = (data.content || []) as Visit[];
            setVisitsData(visits);
            setFilteredVisitsData(visits);
            setVisitTotalPages(Math.max(data.totalPages || 1, 1));
            setVisitTotalElements(data.totalElements || 0);
        } catch (error) {
            console.error('Error fetching visits data:', error);
        }
    }, [token]);

    const fetchTasksData = useCallback(async (id: string, start: Date, end: Date) => {
        if (isDateRangeInvalid(start, end)) return;
        try {
            const response = await fetch(`http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/task/getByStoreAndDate?storeId=${id}&start=${format(start, 'yyyy-MM-dd')}&end=${format(end, 'yyyy-MM-dd')}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (!response.ok) {
                throw new Error(`Failed to fetch customer tasks (${response.status})`);
            }
            const data = await response.json() as Task[];
            const tasks = Array.isArray(data) ? data : [];
            setRequirementsData(tasks.filter((task) => task.taskType === 'requirement'));
            setComplaintsData(tasks.filter((task) => task.taskType === 'complaint'));
        } catch (error) {
            console.error('Error fetching customer tasks:', error);
            setRequirementsData([]);
            setComplaintsData([]);
        }
    }, [token]);

    const fetchEmployees = useCallback(async () => {
        try {
            setIsLoadingEmployees(true);
            const response = await fetch('http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/employee/getFieldOfficer', {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            const data = await response.json();
            setEmployees(data);
        } catch (error) {
            console.error('Error fetching field officers:', error);
        } finally {
            setIsLoadingEmployees(false);
        }
    }, [token]);

    const getStoreId = (): string => {
        if (typeof storeId === 'string') {
            return storeId;
        }
        if (Array.isArray(storeId)) {
            return storeId[0];
        }
        return '';
    };

    const getNumericStoreId = useCallback(() => {
        const idString = getStoreId();
        const parsed = parseInt(idString, 10);
        return Number.isNaN(parsed) ? 0 : parsed;
    }, [storeId]);

    const handleCloseNoteModal = useCallback(() => {
        setIsModalVisible(false);
        setIsEditMode(false);
        setNoteContent('');
        setEditingNoteId(null);
        setIsNoteSaving(false);
    }, []);

    const resetComplaintTaskState = useCallback(() => {
        const today = new Date();
        const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        
        // Find employee by name to get ID
        const employeeNameStr = typeof customerData?.employeeName === 'string' ? customerData.employeeName : '';
        const employee = employees.find(emp => {
            const firstName = typeof emp.firstName === 'string' ? emp.firstName : '';
            const lastName = typeof emp.lastName === 'string' ? emp.lastName : '';
            return `${firstName} ${lastName}` === employeeNameStr || 
                (typeof firstName === 'string' && employeeNameStr.includes(firstName)) ||
                (typeof lastName === 'string' && employeeNameStr.includes(lastName));
        });
        
        const existingTask = complaintsData[0];

        const nextComplaintTask = {
            taskTitle: '',
            taskDesciption: '',
            dueDate: todayString,
            assignedToId: existingTask?.assignedToId ?? (employee ? employee.id as number : 0),
            assignedToName: existingTask?.assignedToName || employeeNameStr || '',
            assignedById: 0,
            status: 'Assigned',
            priority: 'low',
            taskType: 'complaint',
            storeId: getNumericStoreId(),
            category: 'Complaint',
            storeName: (customerData?.storeName as string) || existingTask?.storeName || ''
        };
        setComplaintTask(nextComplaintTask);
        setComplaintTaskBaseline(nextComplaintTask);
        setComplaintEmployeeSearch('');
        setComplaintActiveTab('general');
    }, [complaintsData, customerData?.storeName, customerData?.employeeName, getNumericStoreId, employees]);

    const resetRequirementTaskState = useCallback(() => {
        const today = new Date();
        const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        
        // Find employee by name to get ID
        const employeeNameStr = typeof customerData?.employeeName === 'string' ? customerData.employeeName : '';
        const employee = employees.find(emp => {
            const firstName = typeof emp.firstName === 'string' ? emp.firstName : '';
            const lastName = typeof emp.lastName === 'string' ? emp.lastName : '';
            return `${firstName} ${lastName}` === employeeNameStr || 
                (typeof firstName === 'string' && employeeNameStr.includes(firstName)) ||
                (typeof lastName === 'string' && employeeNameStr.includes(lastName));
        });
        
        const existingTask = requirementsData[0];

        const nextRequirementTask = {
            taskTitle: '',
            taskDesciption: '',
            dueDate: todayString,
            assignedToId: existingTask?.assignedToId ?? (employee ? employee.id as number : 0),
            assignedToName: existingTask?.assignedToName || employeeNameStr || '',
            assignedById: 0,
            status: 'Assigned',
            priority: 'low',
            taskType: 'requirement',
            storeId: getNumericStoreId(),
            category: 'Requirement',
            storeName: (customerData?.storeName as string) || existingTask?.storeName || ''
        };
        setRequirementTask(nextRequirementTask);
        setRequirementTaskBaseline(nextRequirementTask);
        setRequirementEmployeeSearch('');
        setRequirementActiveTab('general');
    }, [requirementsData, customerData?.storeName, customerData?.employeeName, getNumericStoreId, employees]);

    const closeComplaintModal = useCallback(() => {
        setIsComplaintModalOpen(false);
        setTaskCreateError(null);
        resetComplaintTaskState();
    }, [resetComplaintTaskState]);

    const closeRequirementModal = useCallback(() => {
        setIsRequirementModalOpen(false);
        setTaskCreateError(null);
        resetRequirementTaskState();
    }, [resetRequirementTaskState]);

    const closeEditCustomerModal = useCallback(() => {
        setIsEditCustomerModalVisible(false);
        setCustomerEditError(null);
        setActiveTab('basic-info');
        setHasUnlockedAddressTab(false);
        setFormData(baselineFormData);
        setIsOtherClientType(baselineFormData.clientType === 'others');
    }, [baselineFormData]);

    const requestCloseNoteModal = useCallback(() => {
        requestDiscard(handleCloseNoteModal, noteDraftIsDirty);
    }, [handleCloseNoteModal, noteDraftIsDirty, requestDiscard]);

    const requestCloseComplaintModal = useCallback(() => {
        requestDiscard(closeComplaintModal, complaintDraftIsDirty);
    }, [closeComplaintModal, complaintDraftIsDirty, requestDiscard]);

    const requestCloseRequirementModal = useCallback(() => {
        requestDiscard(closeRequirementModal, requirementDraftIsDirty);
    }, [closeRequirementModal, requirementDraftIsDirty, requestDiscard]);

    const requestCloseEditCustomerModal = useCallback(() => {
        requestDiscard(closeEditCustomerModal, customerFormIsDirty);
    }, [closeEditCustomerModal, customerFormIsDirty, requestDiscard]);

    const handleCustomerTabChange = useCallback((value: string) => {
        if (value === 'address-info' && !hasUnlockedAddressTab) {
            return;
        }
        setActiveTab(value);
    }, [hasUnlockedAddressTab]);

    const handleAddNote = async () => {
        if (isNoteSaving) return;
        try {
            setIsNoteSaving(true);
            const response = await fetch('http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/notes/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    content: noteContent,
                    employeeId: employeeId,
                    storeId: parseInt(storeId as string),
                }),
            });

            if (response.ok) {
                await fetchNotesData(storeId as string);
                handleCloseNoteModal();
                console.log('Note added successfully!');
            }
        } catch (error) {
            console.error('Error creating note:', error);
        } finally {
            setIsNoteSaving(false);
        }
    };

    const handleEditNote = (note: Note) => {
        setEditingNoteId(note.id);
        setNoteContent(note.content);
        setIsEditMode(true);
        setIsModalVisible(true);
    };

    const handleSaveEditNote = async () => {
        if (isNoteSaving) return;
        try {
            setIsNoteSaving(true);
            const response = await fetch(`http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/notes/edit?id=${editingNoteId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    content: noteContent,
                    employeeId: employeeId,
                    storeId: parseInt(storeId as string),
                }),
            });

            if (response.ok) {
                await fetchNotesData(storeId as string);
                handleCloseNoteModal();
                console.log('Note updated successfully!');
            }
        } catch (error) {
            console.error('Error updating note:', error);
        } finally {
            setIsNoteSaving(false);
        }
    };

    const handleDeleteNoteConfirm = async () => {
        if (!notePendingDelete) return;
        try {
            const response = await fetch(`http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/notes/delete?id=${notePendingDelete.id}`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (response.ok) {
                await fetchNotesData(storeId as string);
                console.log('Note deleted successfully!');
            }
        } catch (error) {
            console.error('Error deleting note:', error);
        } finally {
            setNotePendingDelete(null);
        }
    };

    const handleStatusChange = (value: string) => {
        if (value === "All Statuses") {
            setFilteredVisitsData(visitsData);
        } else {
            setFilteredVisitsData(visitsData.filter(visit => getOutcomeStatus(visit).status === value));
        }
    };

    const handlePageChange = (tab: keyof typeof currentPage, page: number) => {
        setCurrentPage(prev => ({ ...prev, [tab]: page }));
    };

    const renderPaginationItems = (tab: keyof typeof currentPage) => {
        const items = [];
        let totalPages;

        switch (tab) {
            case 'visits':
                totalPages = visitTotalPages;
                break;
            case 'notes':
                totalPages = Math.ceil(notesData.length / ITEMS_PER_PAGE);
                break;
            case 'complaints':
                totalPages = Math.ceil(complaintsData.length / ITEMS_PER_PAGE);
                break;
            case 'requirements':
                totalPages = Math.ceil(requirementsData.length / ITEMS_PER_PAGE);
                break;
            default:
                totalPages = 0;
        }

        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= currentPage[tab] - 1 && i <= currentPage[tab] + 1)) {
                items.push(
                    <PaginationItem key={i}>
                        <PaginationLink
                            size="default"
                            isActive={currentPage[tab] === i}
                            onClick={() => handlePageChange(tab, i)}
                        >
                            {i}
                        </PaginationLink>
                    </PaginationItem>
                );
            }
        }
        return items;
    };

    const createTask = async () => {
        const id = getStoreId();
        if (!id) return;
        await fetchTasksData(id, startDate, endDate);
    };

    const getInitials = (name: string) => {
        if (!name) return '';
        const nameParts = name.split(' ');
        return nameParts.map(part => part[0]).join('');
    };

    // Check if today is the customer's birthday
    const isBirthdayToday = useCallback((dob: string | null | undefined): boolean => {
        if (!dob) return false;
        
        try {
            const birthDate = new Date(dob);
            const today = new Date();
            
            // Check if month and day match (ignore year)
            return birthDate.getMonth() === today.getMonth() && 
                   birthDate.getDate() === today.getDate();
        } catch (error) {
            console.error('Error parsing date of birth:', error);
            return false;
        }
    }, []);

    // Format date of birth for display
    const formatDateOfBirth = useCallback((dob: string | null | undefined): string | null => {
        if (!dob) return null;
        
        try {
            const date = new Date(dob);
            if (isNaN(date.getTime())) return null;
            
            return format(date, 'MMM dd, yyyy');
        } catch (error) {
            console.error('Error formatting date of birth:', error);
            return null;
        }
    }, []);

    const handleBackClick = () => {
        if (typeof window !== 'undefined') {
            try {
                const raw = sessionStorage.getItem('nav.return.to');
                if (raw) {
                    const saved = JSON.parse(raw);
                    if (saved?.page === 'complaints') {
                        router.back();
                        return;
                    }
                    if (saved?.page === 'requirements') {
                        router.back();
                        return;
                    }
                }
            } catch {}
        }
        router.push('/dashboard/customers');
    };

    const addNote = () => {
        setIsEditMode(false);
        setNoteContent('');
        setEditingNoteId(null);
        setIsModalVisible(true);
    };

    const getOutcomeStatus = (visit: Visit) => {
        if (visit.checkinTime && visit.checkoutTime) {
            return { emoji: '✅', status: 'Complete', color: 'bg-purple-100 text-purple-800' };
        } else {
            return { emoji: '📅', status: 'Assigned', color: 'bg-blue-100 text-blue-800' };
        }
    };

    const paginate = <T,>(data: T[], page: number): T[] => {
        const start = (page - 1) * ITEMS_PER_PAGE;
        return data.slice(start, start + ITEMS_PER_PAGE);
    };

    useEffect(() => {
        setCurrentPage(prev => {
            if (prev.visits > visitTotalPages) {
                return { ...prev, visits: visitTotalPages };
            }
            return prev;
        });
    }, [visitTotalPages]);

    useEffect(() => {
        setCurrentPage(prev => {
            const totalPages = Math.max(1, Math.ceil(notesData.length / ITEMS_PER_PAGE));
            if (prev.notes > totalPages) {
                return { ...prev, notes: totalPages };
            }
            return prev;
        });
    }, [notesData.length]);

    const handleChangeStatus = async (taskId: number, status: string) => {
        try {
            const response = await fetch(`http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/task/updateTask?taskId=${taskId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    status,
                    priority: "Medium",
                }),
            });

            if (response.ok) {
                console.log('Status updated successfully!');
                createTask();
            }
        } catch (error) {
            console.error('Error updating status:', error);
        }
    };

    const handleCustomerEditSubmit = async (data: Partial<CustomerData>) => {
        const clientFirstName = data.clientFirstName?.trim();
        const clientLastName = data.clientLastName?.trim();

        if (!clientFirstName || !clientLastName) {
            setCustomerEditError('First name and last name are required.');
            setActiveTab('basic-info');
            return;
        }

        setIsUpdatingCustomer(true);
        setCustomerEditError(null);
        try {
            const dobValue = data.dob || data.dateOfBirth || '';
            const normalizedDob = dobValue ? dobValue.replace(/\//g, '-') : undefined;

            const requestData = {
                clientFirstName,
                clientLastName,
                email: data.email?.trim() || null,
                clientType: data.clientType,
                gstNumber: data.gstNumber?.trim() || null,
                addressLine1: data.addressLine1?.trim() || null,
                addressLine2: data.addressLine2?.trim() || null,
                district: data.village?.trim() || null,
                subDistrict: data.taluka?.trim() || null,
                city: data.city?.trim() || null,
                state: data.state?.trim() || null,
                pincode: data.pincode ? Number(data.pincode) : null,
                dob: normalizedDob,
                yearOfJoining: data.yearOfJoining == null ? null : Number(data.yearOfJoining),
            };

            const response = await fetch(`http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/store/edit?id=${storeId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(requestData),
            });

            if (response.ok) {
                await fetchCustomerData(storeId as string);
                closeEditCustomerModal();
                console.log('Customer updated successfully!');
            } else {
                throw new Error(
                    await getApiErrorMessage(response, 'Unable to update customer.')
                );
            }
        } catch (error) {
            console.error('Error updating customer:', error);
            setCustomerEditError(getErrorMessage(error, 'Unable to update customer.'));
        } finally {
            setIsUpdatingCustomer(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setCustomerEditError(null);
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleClientTypeChange = (value: string) => {
        const lowercaseValue = value.toLowerCase();
        setCustomerEditError(null);
        setIsOtherClientType(lowercaseValue === 'others');
        setFormData((prev) => ({
            ...prev,
            clientType: lowercaseValue,
            otherClientType: lowercaseValue === 'others' ? prev.otherClientType : '',
        }));
    };

    const handleSubmit = () => {
        const updatedFormData = { ...formData };
        if (isOtherClientType) {
            updatedFormData.clientType = formData.otherClientType || 'Others';
        }
        handleCustomerEditSubmit(updatedFormData);
    };

    const handleComplaintNext = () => {
        setComplaintActiveTab('details');
    };

    const handleComplaintBack = () => {
        setComplaintActiveTab('general');
    };

    const handleCreateComplaint = async () => {
        const assignedById = userData?.employeeId;
        if (!assignedById) {
            setTaskCreateError('Unable to identify the logged-in employee. Please sign in again.');
            return;
        }

        setIsCreatingTask(true);
        setTaskCreateError(null);
        try {
            const response = await fetch('http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/task/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    ...complaintTask,
                    dueDate: complaintTask.dueDate.split('T')[0],
                    storeId: complaintTask.storeId,
                    assignedById,
                    taskType: 'complaint'
                }),
            });

            if (response.ok) {
                console.log('Complaint created successfully!');
                await createTask();
                closeComplaintModal();
            } else {
                const errorText = await response.text();
                throw new Error(errorText || `Failed to create complaint (${response.status})`);
            }
        } catch (error) {
            console.error('Error creating complaint:', error);
            setTaskCreateError(error instanceof Error ? error.message : 'Failed to create complaint');
        } finally {
            setIsCreatingTask(false);
        }
    };

    const handleRequirementNext = () => {
        setRequirementActiveTab('details');
    };

    const handleRequirementBack = () => {
        setRequirementActiveTab('general');
    };

    const handleCreateRequirement = async () => {
        const assignedById = userData?.employeeId;
        if (!assignedById) {
            setTaskCreateError('Unable to identify the logged-in employee. Please sign in again.');
            return;
        }

        setIsCreatingTask(true);
        setTaskCreateError(null);
        try {
            const response = await fetch('http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/task/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    ...requirementTask,
                    dueDate: requirementTask.dueDate.split('T')[0],
                    storeId: requirementTask.storeId,
                    assignedById,
                    taskType: 'requirement'
                }),
            });

            if (response.ok) {
                console.log('Requirement created successfully!');
                await createTask();
                closeRequirementModal();
            } else {
                const errorText = await response.text();
                throw new Error(errorText || `Failed to create requirement (${response.status})`);
            }
        } catch (error) {
            console.error('Error creating requirement:', error);
            setTaskCreateError(error instanceof Error ? error.message : 'Failed to create requirement');
        } finally {
            setIsCreatingTask(false);
        }
    };

    const calculateIntentTrend = () => {
        const dates = intentData.map(item => item.changeDate);
        const intentLevels = intentData.map(item => item.newIntentLevel);
        return { dates, intentLevels };
    };

    const calculateSalesTrend = () => {
        const dates = salesData.map(item => item.visitDate);
        const salesAmounts = salesData.map(item => item.newMonthlySale);
        return { dates, salesAmounts };
    };

    const { dates: intentDates, intentLevels } = calculateIntentTrend();
    const { dates: salesDates, salesAmounts } = calculateSalesTrend();

    const intentChartData = {
        labels: intentDates,
        datasets: [
            {
                label: 'Intent Level',
                data: intentLevels,
                borderColor: 'rgba(75, 192, 192, 1)',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                fill: true,
            },
        ],
    };

    const salesChartData = {
        labels: salesDates,
        datasets: [
            {
                label: 'Monthly Sales',
                data: salesAmounts,
                borderColor: 'rgba(153, 102, 255, 1)',
                backgroundColor: 'rgba(153, 102, 255, 0.2)',
                fill: true,
            },
        ],
    };

    useEffect(() => {
        if (token && storeId) {
            fetchCustomerData(storeId as string);
            fetchNotesData(storeId as string);
            fetchIntentData(storeId as string);
            fetchSalesData(storeId as string);
        }
    }, [token, storeId, fetchCustomerData, fetchNotesData, fetchIntentData, fetchSalesData]);

    useEffect(() => {
        if (token && storeId && !dateRangeInvalid) {
            fetchTasksData(storeId as string, startDate, endDate);
        }
    }, [token, storeId, startDate, endDate, dateRangeInvalid, fetchTasksData]);

    useEffect(() => {
        if (token && storeId) {
            fetchVisitsData(storeId as string, currentPage.visits);
        }
    }, [token, storeId, currentPage.visits, fetchVisitsData]);

    useEffect(() => {
        if (customerData) {
            const clientType = (customerData.clientType as string)?.toLowerCase() || '';
            const standardClientTypes = ["shop", "site visit", "architect", "engineer"];
            const isStandardType = standardClientTypes.includes(clientType);

            const nextFormData: Partial<CustomerData> = {
                storeId: customerData.storeId as number,
                storeName: customerData.storeName as string,
                clientFirstName: customerData.clientFirstName as string,
                clientLastName: customerData.clientLastName as string,
                email: (customerData.email as string) || '',
                primaryContact: customerData.primaryContact as number,
                gstNumber: (customerData.gstNumber as string) || '',
                clientType: isStandardType ? clientType : 'others',
                otherClientType: isStandardType ? '' : (customerData.clientType as string) || '',
                addressLine1: (customerData.addressLine1 as string) || '',
                addressLine2: (customerData.addressLine2 as string) || '',
                village: (customerData.district as string) || '',
                taluka: (customerData.subDistrict as string) || '',
                city: customerData.city as string,
                state: customerData.state as string,
                pincode: (customerData.pincode as string) || '',
                dateOfBirth: (customerData.dateOfBirth as string) || (customerData.dob as string) || null,
                dob: (customerData.dateOfBirth as string) || (customerData.dob as string) || null,
                yearOfJoining: customerData.yearOfJoining != null && Number.isInteger(Number(customerData.yearOfJoining))
                    ? Number(customerData.yearOfJoining)
                    : null,
            };
            setFormData(nextFormData);
            setBaselineFormData(nextFormData);

            setIsOtherClientType(!isStandardType);
        }
    }, [customerData]);

    useEffect(() => {
        if (
            (isComplaintModalOpen || isRequirementModalOpen) &&
            employees.length === 0 &&
            !isLoadingEmployees
        ) {
            void fetchEmployees();
        }
    }, [isComplaintModalOpen, isRequirementModalOpen, employees.length, isLoadingEmployees, fetchEmployees]);

    useEffect(() => {
        if (isComplaintModalOpen) {
            resetComplaintTaskState();
        }
    }, [isComplaintModalOpen, employees, resetComplaintTaskState]);

    useEffect(() => {
        if (isRequirementModalOpen) {
            resetRequirementTaskState();
        }
    }, [isRequirementModalOpen, employees, resetRequirementTaskState]);

    // Show skeleton loader while customer data is loading
    if (isLoadingCustomer) {
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-1">
                        <Card className="border-0 shadow-sm">
                            <CardHeader className="pb-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-xl font-semibold text-foreground">Customer Details</CardTitle>
                                        <p className="text-sm text-muted-foreground">Customer information and actions</p>
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={handleBackClick}>
                                        <i className="fas fa-arrow-left mr-2"></i> Back
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="flex items-start gap-4">
                                    <Skeleton className="h-14 w-14 rounded-xl" />
                                    <div className="flex-1 min-w-0 space-y-2">
                                        <Skeleton className="h-6 w-32" />
                                        <Skeleton className="h-4 w-24" />
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Skeleton className="h-4 w-16" />
                                        <Skeleton className="h-8 w-full" />
                                    </div>
                                    <div className="space-y-2">
                                        <Skeleton className="h-4 w-20" />
                                        <Skeleton className="h-8 w-full" />
                                    </div>
                                    <div className="space-y-2">
                                        <Skeleton className="h-4 w-24" />
                                        <Skeleton className="h-8 w-full" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                    <div className="lg:col-span-2">
                        <Card className="border-0 shadow-sm">
                            <CardHeader>
                                <CardTitle className="text-xl font-semibold text-foreground">Customer Information</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Skeleton className="h-4 w-20" />
                                        <Skeleton className="h-8 w-full" />
                                    </div>
                                    <div className="space-y-2">
                                        <Skeleton className="h-4 w-16" />
                                        <Skeleton className="h-8 w-full" />
                                    </div>
                                    <div className="space-y-2">
                                        <Skeleton className="h-4 w-24" />
                                        <Skeleton className="h-8 w-full" />
                                    </div>
                                    <div className="space-y-2">
                                        <Skeleton className="h-4 w-18" />
                                        <Skeleton className="h-8 w-full" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        );
    }

    // Check if it's customer's birthday
    const customerDob = customerData ? ((customerData.dateOfBirth as string) || (customerData.dob as string)) : null;
    const isBirthday = isBirthdayToday(customerDob);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                    <Card className="border-0 shadow-sm">
                        <CardContent className="space-y-6">
                            <div className="flex items-start gap-4">
                                <div className="relative h-14 w-14 rounded-xl border-2 border-dashed bg-muted flex items-center justify-center">
                                    <span className="text-lg font-semibold text-muted-foreground">
                                        {customerData ? getInitials(`${customerData.clientFirstName} ${customerData.clientLastName}`) : ''}
                                    </span>
                                    {/* Birthday indicator on avatar */}
                                    {customerData && isBirthdayToday((customerData.dateOfBirth as string) || (customerData.dob as string)) && (
                                        <div className="absolute -top-1 -right-1 h-5 w-5 bg-gradient-to-br from-pink-400 to-pink-600 rounded-full flex items-center justify-center shadow-lg animate-pulse">
                                            <Cake className="h-3 w-3 text-white" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0 space-y-1">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className="text-lg font-semibold text-foreground truncate max-w-[200px]">
                                            {customerData ? `${customerData.clientFirstName} ${customerData.clientLastName}` : ''}
                                        </h3>
                                            {/* Birthday badge */}
                                            {customerData && isBirthdayToday((customerData.dateOfBirth as string) || (customerData.dob as string)) && (
                                                <Badge className="bg-gradient-to-r from-pink-500 to-rose-500 text-white border-0 shadow-md animate-pulse">
                                                    <Cake className="h-3 w-3 mr-1" />
                                                    Birthday Today! <span>🎉</span>
                                                </Badge>
                                            )}
                                        </div>
                                        <Button variant="ghost" size="sm" onClick={handleBackClick} className="ml-2 flex-shrink-0">
                                            <i className="fas fa-arrow-left mr-2"></i> Back
                                        </Button>
                                    </div>
                                    <p className="text-sm text-muted-foreground truncate">
                                        {customerData ? (customerData.storeName as string) : ''}
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <div className="relative group">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => {
                                            setActiveTab('basic-info');
                                            setHasUnlockedAddressTab(false);
                                            setIsEditCustomerModalVisible(true);
                                        }}
                                        className="h-10 w-10"
                                    >
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                                        Edit Customer
                                    </div>
                                </div>

                                <div className="relative group">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => {
                                            resetComplaintTaskState();
                                            setIsComplaintModalOpen(true);
                                        }}
                                        className="h-10 w-10"
                                    >
                                        <MessageSquare className="h-4 w-4" />
                                    </Button>
                                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                                        Log Complaint
                                    </div>
                                </div>

                                <div className="relative group">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => {
                                            resetRequirementTaskState();
                                            setIsRequirementModalOpen(true);
                                        }}
                                        className="h-10 w-10"
                                    >
                                        <ClipboardList className="h-4 w-4" />
                                    </Button>
                                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                                        Add Requirement
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex border-b">
                                    <button
                                        className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${activeInfoTab === 'leads-info'
                                                ? 'border-primary text-primary'
                                                : 'border-transparent text-muted-foreground hover:text-foreground'
                                            }`}
                                        onClick={() => setActiveInfoTab('leads-info')}
                                    >
                                        Leads Info
                                    </button>
                                    <button
                                        className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${activeInfoTab === 'address-info'
                                                ? 'border-primary text-primary'
                                                : 'border-transparent text-muted-foreground hover:text-foreground'
                                            }`}
                                        onClick={() => setActiveInfoTab('address-info')}
                                    >
                                        Address Info
                                    </button>
                                </div>

                                {activeInfoTab === 'leads-info' && customerData && (
                                    <div className="space-y-3">
                                        <div className="flex items-start gap-3">
                                            <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-muted-foreground">Customer Name</p>
                                                <p className="text-sm text-foreground">{(customerData.clientFirstName as string)} {(customerData.clientLastName as string)}</p>
                                            </div>
                                        </div>
                                        {(customerData.email as string) && (
                                            <div className="flex items-start gap-3">
                                                <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-muted-foreground">Email</p>
                                                    <p className="text-sm text-foreground">{customerData.email as string}</p>
                                                </div>
                                            </div>
                                        )}
                                        <div className="flex items-start gap-3">
                                            <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-muted-foreground">Phone</p>
                                                <p className="text-sm text-foreground">{customerData.primaryContact as number}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <Store className="h-4 w-4 text-muted-foreground mt-0.5" />
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-muted-foreground">Store Name</p>
                                                <p className="text-sm text-foreground">{customerData.storeName as string}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <CalendarIcon className="h-4 w-4 text-muted-foreground mt-0.5" />
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-muted-foreground">Year of Joining</p>
                                                <p className="text-sm text-foreground">
                                                    {customerData.yearOfJoining != null
                                                        ? String(customerData.yearOfJoining)
                                                        : 'Not recorded'}
                                                </p>
                                            </div>
                                        </div>
                                        {(customerData.clientType as string) && (
                                            <div className="flex items-start gap-3">
                                                <Tag className="h-4 w-4 text-muted-foreground mt-0.5" />
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-muted-foreground">Client Type</p>
                                                    <p className="text-sm text-foreground">{customerData.clientType as string}</p>
                                                </div>
                                            </div>
                                        )}
                                        {(() => {
                                            const dob = (customerData.dateOfBirth as string) || (customerData.dob as string);
                                            const formattedDob = formatDateOfBirth(dob);
                                            const isBirthday = isBirthdayToday(dob);
                                            
                                            if (!formattedDob) return null;
                                            
                                            return (
                                                <div className="flex items-start gap-3">
                                                    <CalendarIcon className={`h-4 w-4 mt-0.5 ${isBirthday ? 'text-pink-500' : 'text-muted-foreground'}`} />
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-sm font-medium text-muted-foreground">Date of Birth</p>
                                                            {isBirthday && (
                                                                <Badge variant="outline" className="bg-pink-50 text-pink-600 border-pink-200 text-xs">
                                                                    <Cake className="h-3 w-3 mr-1" />
                                                                    Birthday!
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <p className={`text-sm ${isBirthday ? 'font-semibold text-pink-600' : 'text-foreground'}`}>
                                                            {formattedDob}
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}

                                {activeInfoTab === 'address-info' && customerData && (
                                    <div className="space-y-3">
                                        {(() => {
                                            const addressParts = [];
                                            if (customerData.addressLine1) addressParts.push(customerData.addressLine1);
                                            if (customerData.addressLine2) addressParts.push(customerData.addressLine2);
                                            if (customerData.village) addressParts.push(customerData.village);
                                            if (customerData.taluka) addressParts.push(customerData.taluka);
                                            if (customerData.city) addressParts.push(customerData.city);
                                            if (customerData.district) addressParts.push(customerData.district);
                                            if (customerData.state) addressParts.push(customerData.state);
                                            if (customerData.pincode) addressParts.push(customerData.pincode);

                                            return addressParts.length > 0 ? (
                                                <div className="flex items-start gap-3">
                                                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-medium text-muted-foreground">Address</p>
                                                        <p className="text-sm text-foreground">{addressParts.join(', ')}</p>
                                                    </div>
                                                </div>
                                            ) : null;
                                        })()}
                                        {(customerData.city as string) && (
                                            <div className="flex items-start gap-3">
                                                <Building className="h-4 w-4 text-muted-foreground mt-0.5" />
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-muted-foreground">City</p>
                                                    <p className="text-sm text-foreground">{customerData.city as string}</p>
                                                </div>
                                            </div>
                                        )}
                                        {(customerData.state as string) && (
                                            <div className="flex items-start gap-3">
                                                <Flag className="h-4 w-4 text-muted-foreground mt-0.5" />
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-muted-foreground">State</p>
                                                    <p className="text-sm text-foreground">{customerData.state as string}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
                <div className="lg:col-span-2">
                    <Card className="border-0 shadow-sm">
                        <CardHeader className="pb-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-xl font-semibold text-foreground">Customer Activity</CardTitle>
                                    <p className="text-sm text-muted-foreground">View visits, notes, complaints, and requirements</p>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-6">
                                <div className="flex border-b">
                                    <button
                                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeActivityTab === 'visits'
                                                ? 'border-primary text-primary'
                                                : 'border-transparent text-muted-foreground hover:text-foreground'
                                            }`}
                                        onClick={() => setActiveActivityTab('visits')}
                                    >
                                        <i className="fas fa-calendar-check"></i> Visits
                                    </button>
                                    <button
                                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeActivityTab === 'brands'
                                                ? 'border-primary text-primary'
                                                : 'border-transparent text-muted-foreground hover:text-foreground'
                                                }`}
                                        onClick={() => setActiveActivityTab('brands')}
                                    >
                                        <i className="fas fa-building"></i> Brands
                                    </button>
                                    <button
                                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeActivityTab === 'notes'
                                                ? 'border-primary text-primary'
                                                : 'border-transparent text-muted-foreground hover:text-foreground'
                                            }`}
                                        onClick={() => setActiveActivityTab('notes')}
                                    >
                                        <i className="fas fa-sticky-note"></i> Notes
                                    </button>
                                    <button
                                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeActivityTab === 'complaints'
                                                ? 'border-primary text-primary'
                                                : 'border-transparent text-muted-foreground hover:text-foreground'
                                            }`}
                                        onClick={() => setActiveActivityTab('complaints')}
                                    >
                                        <i className="fas fa-exclamation-circle"></i> Complaints
                                    </button>
                                    <button
                                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeActivityTab === 'requirements'
                                                ? 'border-primary text-primary'
                                                : 'border-transparent text-muted-foreground hover:text-foreground'
                                            }`}
                                        onClick={() => setActiveActivityTab('requirements')}
                                    >
                                        <i className="fas fa-tasks"></i> Requirements
                                    </button>
                                    {showSitesTab && (
                                        <button
                                            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeActivityTab === 'sites'
                                                    ? 'border-primary text-primary'
                                                    : 'border-transparent text-muted-foreground hover:text-foreground'
                                                }`}
                                            onClick={() => setActiveActivityTab('sites')}
                                        >
                                            <i className="fas fa-map-marker-alt"></i> Sites
                                        </button>
                                    )}
                                </div>

                                {activeActivityTab === 'visits' && (
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-4">
                                            <select
                                                onChange={(e) => handleStatusChange(e.target.value)}
                                                className="px-3 py-2 border border-input bg-background rounded-md text-sm"
                                            >
                                                <option value="All Statuses">All Statuses</option>
                                                <option value="Assigned">Assigned</option>
                                                <option value="On Going">On Going</option>
                                                <option value="Complete">Complete</option>
                                            </select>
                                        </div>
                                        <div className="space-y-3">
                                            {filteredVisitsData.map((visit, index) => {
                                                const { emoji, status, color } = getOutcomeStatus(visit);
                                                return (
                                                    <div key={index} className="rounded-lg border bg-card p-4">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div className="flex items-center gap-2">
                                                                <i className="fas fa-calendar-alt text-muted-foreground"></i>
                                                                <span className="text-sm font-medium">Visit scheduled by {visit.employeeName}</span>
                                                            </div>
                                                            <span className="text-xs text-muted-foreground">{formatDateToUserFriendly(visit.visit_date)}</span>
                                                        </div>
                                                        <p className="text-sm text-foreground mb-3">{visit.purpose}</p>
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-4">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-xs text-muted-foreground">Status:</span>
                                                                    <Badge variant="secondary" className={color}>{emoji} {status}</Badge>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-xs text-muted-foreground">Purpose:</span>
                                                                    <span className="text-xs text-primary">{visit.purpose}</span>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                                                                    {getInitials(visit.employeeName)}
                                                                </div>
                                                                <span className="text-xs text-muted-foreground">{visit.employeeName}</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex justify-end mt-3">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => router.push(`/dashboard/visits/${visit.id}`)}
                                                                className="text-xs"
                                                            >
                                                                View Visit
                                                            </Button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        {showMore.visits && visitTotalPages > 1 && (
                                            <Pagination>
                                                <PaginationPrevious
                                                    size="default"
                                                    onClick={currentPage.visits === 1 ? undefined : () => setCurrentPage(prev => ({ ...prev, visits: Math.max(prev.visits - 1, 1) }))}
                                                />
                                                <PaginationContent>
                                                    {renderPaginationItems('visits')}
                                                </PaginationContent>
                                                <PaginationNext
                                                    size="default"
                                                    onClick={currentPage.visits === visitTotalPages ? undefined : () => setCurrentPage(prev => ({ ...prev, visits: Math.min(prev.visits + 1, visitTotalPages) }))}
                                                />
                                            </Pagination>
                                        )}
                                        {visitTotalElements > ITEMS_PER_PAGE && (
                                            <Button variant="outline" onClick={() => setShowMore(prev => ({ ...prev, visits: !prev.visits }))}>
                                                {showMore.visits ? 'Show Less' : 'Show More'}
                                            </Button>
                                        )}
                                    </div>
                                )}

                                {activeActivityTab === 'brands' && (
                                    <div className="space-y-4">
                                        <BrandTab
                                            brands={brandProCons}
                                            setBrands={setBrandProCons}
                                            visitId={String(visitsData[0]?.id || '')}
                                            token={localStorage.getItem('authToken')}
                                            fetchVisitDetail={async () => {
                                                // Refresh visits/brands after any change
                                                if (storeId) {
                                                    await fetchVisitsData(String(storeId), currentPage.visits);
                                                }
                                            }}
                                        />
                                    </div>
                                )}

                                {activeActivityTab === 'notes' && (
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-4">
                                            <Button onClick={addNote}>
                                                <i className="fas fa-plus mr-2"></i> Add Note
                                            </Button>
                                        </div>
                                        <div className="space-y-3">
                                            {paginate(notesData, currentPage.notes).map((note) => (
                                                <div key={note.id} className="rounded-lg border bg-card p-4">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-xs text-muted-foreground">{formatDateToUserFriendly(note.createdDate)}</span>
                                                        <div className="flex items-center gap-2">
                                                            <Button variant="ghost" size="sm" onClick={() => handleEditNote(note)}>
                                                                <Edit className="h-3 w-3 mr-1" />
                                                                Edit
                                                            </Button>
                                                            <Button variant="ghost" size="sm" onClick={() => setNotePendingDelete(note)}>
                                                                <Trash2 className="h-3 w-3 mr-1" />
                                                                Delete
                                                            </Button>
                                                        </div>
                                                    </div>
                                                    <div className="text-sm text-foreground">{note.content}</div>
                                                </div>
                                            ))}
                                        </div>
                                        {showMore.notes && notesData.length > ITEMS_PER_PAGE && (
                                            <Pagination>
                                                <PaginationPrevious
                                                    size="default"
                                                    onClick={currentPage.notes === 1 ? undefined : () => setCurrentPage(prev => ({ ...prev, notes: Math.max(prev.notes - 1, 1) }))}
                                                />
                                                <PaginationContent>
                                                    {renderPaginationItems('notes')}
                                                </PaginationContent>
                                                <PaginationNext
                                                    size="default"
                                                    onClick={currentPage.notes === Math.ceil(notesData.length / ITEMS_PER_PAGE) ? undefined : () => setCurrentPage(prev => ({ ...prev, notes: Math.min(prev.notes + 1, Math.ceil(notesData.length / ITEMS_PER_PAGE)) }))}
                                                />
                                            </Pagination>
                                        )}
                                        {notesData.length > 3 && (
                                            <Button variant="outline" onClick={() => setShowMore(prev => ({ ...prev, notes: !prev.notes }))}>
                                                {showMore.notes ? 'Show Less' : 'Show More'}
                                            </Button>
                                        )}
                                    </div>
                                )}

                                {activeActivityTab === 'complaints' && (
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-4">
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button variant="outline" className={`w-[200px] justify-start text-left font-normal ${!startDate && 'text-muted-foreground'}`}>
                                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                                        {startDate ? format(new Date(startDate), 'MMM dd, yyyy') : <span>Start Date</span>}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0">
                                                    <SpacedCalendar
                                                        mode="single"
                                                        selected={startDate}
                                                        onSelect={(date: Date | undefined) => {
                                                            setStartDate(date || new Date());
                                                            setEndDate(addDays(date || new Date(), 5));
                                                        }}
                                                        initialFocus
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button variant="outline" className={`w-[200px] justify-start text-left font-normal ${!endDate && 'text-muted-foreground'}`}>
                                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                                        {endDate ? format(new Date(endDate), 'MMM dd, yyyy') : <span>End Date</span>}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0">
                                                    <SpacedCalendar
                                                        mode="single"
                                                        selected={endDate}
                                                        onSelect={(date) => setEndDate(date || new Date())}
                                                        initialFocus
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                        <DateRangeError fromDate={startDate} toDate={endDate} />
                                        <div className="space-y-3">
                                            {paginate(complaintsData, currentPage.complaints).map((complaint) => (
                                                <div key={complaint.id} className="rounded-lg border bg-card p-4">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <i className="fas fa-exclamation-circle text-muted-foreground"></i>
                                                            <span className="text-sm font-medium">{complaint.taskTitle}</span>
                                                        </div>
                                                        <span className="text-xs text-muted-foreground">Due: {format(new Date(complaint.dueDate), 'MMM dd, yyyy')}</span>
                                                    </div>
                                                    <p className="text-sm text-foreground mb-3">{complaint.taskDescription}</p>
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-4">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs text-muted-foreground">Status:</span>
                                                                <select
                                                                    onChange={(e) => handleChangeStatus(complaint.id, e.target.value)}
                                                                    value={complaint.status}
                                                                    className="px-2 py-1 border border-input bg-background rounded text-xs"
                                                                >
                                                                    <option value="Assigned">Assigned</option>
                                                                    <option value="On Going">On Going</option>
                                                                    <option value="Complete">Complete</option>
                                                                </select>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs text-muted-foreground">Priority:</span>
                                                                <Badge variant="outline">{complaint.priority}</Badge>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                                                                {getInitials(complaint.assignedToName)}
                                                            </div>
                                                            <span className="text-xs text-muted-foreground">{complaint.assignedToName}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        {showMore.complaints && complaintsData.length > ITEMS_PER_PAGE && (
                                            <Pagination>
                                                <PaginationPrevious
                                                    size="default"
                                                    onClick={currentPage.complaints === 1 ? undefined : () => setCurrentPage(prev => ({ ...prev, complaints: Math.max(prev.complaints - 1, 1) }))}
                                                />
                                                <PaginationContent>
                                                    {renderPaginationItems('complaints')}
                                                </PaginationContent>
                                                <PaginationNext
                                                    size="default"
                                                    onClick={currentPage.complaints === Math.ceil(complaintsData.length / ITEMS_PER_PAGE) ? undefined : () => setCurrentPage(prev => ({ ...prev, complaints: Math.min(prev.complaints + 1, Math.ceil(complaintsData.length / ITEMS_PER_PAGE)) }))}
                                                />
                                            </Pagination>
                                        )}
                                        {complaintsData.length > 3 && (
                                            <Button variant="outline" onClick={() => setShowMore(prev => ({ ...prev, complaints: !prev.complaints }))}>
                                                {showMore.complaints ? 'Show Less' : 'Show More'}
                                            </Button>
                                        )}
                                    </div>
                                )}

                                {activeActivityTab === 'requirements' && (
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-4">
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button variant="outline" className={`w-[200px] justify-start text-left font-normal ${!startDate && 'text-muted-foreground'}`}>
                                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                                        {startDate ? format(new Date(startDate), 'MMM dd, yyyy') : <span>Start Date</span>}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0">
                                                    <SpacedCalendar
                                                        mode="single"
                                                        selected={startDate}
                                                        onSelect={(date: Date | undefined) => {
                                                            setStartDate(date || new Date());
                                                            setEndDate(addDays(date || new Date(), 5));
                                                        }}
                                                        initialFocus
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button variant="outline" className={`w-[200px] justify-start text-left font-normal ${!endDate && 'text-muted-foreground'}`}>
                                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                                        {endDate ? format(new Date(endDate), 'MMM dd, yyyy') : <span>End Date</span>}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0">
                                                    <SpacedCalendar
                                                        mode="single"
                                                        selected={endDate}
                                                        onSelect={(date) => setEndDate(date || new Date())}
                                                        initialFocus
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                        <DateRangeError fromDate={startDate} toDate={endDate} />
                                        <div className="space-y-3">
                                            {paginate(requirementsData, currentPage.requirements).map((requirement) => (
                                                <div key={requirement.id} className="rounded-lg border bg-card p-4">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <i className="fas fa-tasks text-muted-foreground"></i>
                                                            <span className="text-sm font-medium">{requirement.taskTitle}</span>
                                                        </div>
                                                        <span className="text-xs text-muted-foreground">Due: {format(new Date(requirement.dueDate), 'MMM dd, yyyy')}</span>
                                                    </div>
                                                    <p className="text-sm text-foreground mb-3">{requirement.taskDescription}</p>
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-4">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs text-muted-foreground">Status:</span>
                                                                <select
                                                                    onChange={(e) => handleChangeStatus(requirement.id, e.target.value)}
                                                                    value={requirement.status}
                                                                    className="px-2 py-1 border border-input bg-background rounded text-xs"
                                                                >
                                                                    <option value="Assigned">Assigned</option>
                                                                    <option value="On Going">On Going</option>
                                                                    <option value="Complete">Complete</option>
                                                                </select>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs text-muted-foreground">Priority:</span>
                                                                <Badge variant="outline">{requirement.priority}</Badge>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                                                                {getInitials(requirement.assignedToName)}
                                                            </div>
                                                            <span className="text-xs text-muted-foreground">{requirement.assignedToName}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        {showMore.requirements && requirementsData.length > ITEMS_PER_PAGE && (
                                            <Pagination>
                                                <PaginationPrevious
                                                    size="default"
                                                    onClick={currentPage.requirements === 1 ? undefined : () => setCurrentPage(prev => ({ ...prev, requirements: Math.max(prev.requirements - 1, 1) }))}
                                                />
                                                <PaginationContent>
                                                    {renderPaginationItems('requirements')}
                                                </PaginationContent>
                                                <PaginationNext
                                                    size="default"
                                                    onClick={currentPage.requirements === Math.ceil(requirementsData.length / ITEMS_PER_PAGE) ? undefined : () => setCurrentPage(prev => ({ ...prev, requirements: Math.min(prev.requirements + 1, Math.ceil(requirementsData.length / ITEMS_PER_PAGE)) }))}
                                                />
                                            </Pagination>
                                        )}
                                        {requirementsData.length > 3 && (
                                            <Button variant="outline" onClick={() => setShowMore(prev => ({ ...prev, requirements: !prev.requirements }))}>
                                                {showMore.requirements ? 'Show Less' : 'Show More'}
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Modals */}
            <Dialog
                open={isModalVisible}
                onOpenChange={(open) => {
                    if (!open) {
                        requestCloseNoteModal();
                    }
                }}
            >
                <DialogContent className="max-w-md border-0 shadow-lg max-h-[85vh] overflow-y-auto">
                    <DialogHeader className="gap-1">
                        <DialogTitle>{isEditMode ? "Edit Note" : "Add Note"}</DialogTitle>
                        <DialogDescription>
                            Add quick context so everyone stays aligned on this customer.
                        </DialogDescription>
                    </DialogHeader>
                    <Textarea
                        placeholder="Write a note that teammates can follow up on..."
                        value={noteContent}
                        onChange={(e) => setNoteContent(e.target.value)}
                        className="min-h-[140px]"
                    />
                    <DialogFooter>
                        <Button variant="outline" onClick={requestCloseNoteModal}>
                            Cancel
                        </Button>
                        <Button
                            onClick={isEditMode ? handleSaveEditNote : handleAddNote}
                            disabled={isNoteSaving || !noteContent.trim()}
                        >
                            {isNoteSaving ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {isEditMode ? "Updating..." : "Adding..."}
                                </>
                            ) : (
                                isEditMode ? "Update Note" : "Add Note"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={notePendingDelete != null}
                onOpenChange={(open) => {
                    if (!open) {
                        setNotePendingDelete(null);
                    }
                }}
            >
                <DialogContent className="max-w-sm border-0 shadow-lg">
                    <DialogHeader className="gap-1">
                        <DialogTitle>Delete Note?</DialogTitle>
                        <DialogDescription>
                            This note will be removed permanently for everyone viewing this customer.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setNotePendingDelete(null)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleDeleteNoteConfirm}>
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={isEditCustomerModalVisible}
                onOpenChange={(open) => {
                    if (!open) {
                        requestCloseEditCustomerModal();
                    }
                }}
            >
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader className="gap-1">
                        <DialogTitle>Edit Customer</DialogTitle>
                        <DialogDescription>
                            Update customer contact or address details.
                        </DialogDescription>
                    </DialogHeader>
                    {customerEditError && (
                        <div
                            role="alert"
                            aria-live="assertive"
                            className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                        >
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>{customerEditError}</span>
                        </div>
                    )}
                    <Tabs value={activeTab} onValueChange={handleCustomerTabChange} className="w-full">
                        <TabsList className="grid w-full grid-cols-2 mb-6">
                            <TabsTrigger value="basic-info" className="flex items-center gap-2">
                                <span>Basic Info</span>
                            </TabsTrigger>
                            <TabsTrigger
                                value="address-info"
                                className="flex items-center gap-2"
                                disabled={!hasUnlockedAddressTab && activeTab !== "address-info"}
                            >
                                <span>Address Info</span>
                            </TabsTrigger>
                        </TabsList>
                        <TabsContent value="basic-info">
                            <div className="space-y-6 py-2">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-3">
                                        <Label htmlFor="storeName" className="text-sm font-medium text-foreground">
                                            Store Name
                                        </Label>
                                        <Input
                                            id="storeName"
                                            name="storeName"
                                            value={formData.storeName}
                                            disabled
                                            className="h-11 bg-muted text-muted-foreground font-medium cursor-not-allowed"
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Store name is managed centrally; contact your admin to update it.
                                        </p>
                                    </div>
                                    <div className="space-y-3">
                                        <Label htmlFor="gstNumber" className="text-sm font-medium text-foreground">
                                            GST Number
                                        </Label>
                                        <Input
                                            id="gstNumber"
                                            name="gstNumber"
                                            value={formData.gstNumber}
                                            onChange={handleInputChange}
                                            placeholder="Enter GST number"
                                            className="h-11"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-3">
                                        <Label htmlFor="clientFirstName" className="text-sm font-medium text-foreground">
                                            First Name *
                                        </Label>
                                        <Input
                                            id="clientFirstName"
                                            name="clientFirstName"
                                            value={formData.clientFirstName}
                                            onChange={handleInputChange}
                                            placeholder="Enter first name"
                                            className="h-11"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <Label htmlFor="clientLastName" className="text-sm font-medium text-foreground">
                                            Last Name *
                                        </Label>
                                        <Input
                                            id="clientLastName"
                                            name="clientLastName"
                                            value={formData.clientLastName}
                                            onChange={handleInputChange}
                                            placeholder="Enter last name"
                                            className="h-11"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-3">
                                        <Label htmlFor="email" className="text-sm font-medium text-foreground">
                                            Email
                                        </Label>
                                        <Input
                                            id="email"
                                            name="email"
                                            type="email"
                                            value={formData.email || ""}
                                            onChange={handleInputChange}
                                            placeholder="Enter email address"
                                            className="h-11"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <Label htmlFor="primaryContact" className="text-sm font-medium text-foreground">
                                            Phone
                                        </Label>
                                        <Input
                                            id="primaryContact"
                                            name="primaryContact"
                                            value={formData.primaryContact}
                                            disabled
                                            className="h-11 bg-muted text-muted-foreground font-medium cursor-not-allowed"
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Phone numbers sync from customer master and can’t be changed here.
                                        </p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-3">
                                        <Label htmlFor="dob" className="text-sm font-medium text-foreground">
                                            Date of Birth
                                        </Label>
                                        <Input
                                            id="dob"
                                            name="dob"
                                            value={formData.dob || ""}
                                            onChange={(e) => {
                                                const sanitized = e.target.value.replace(/[^0-9-]/g, '');
                                                setCustomerEditError(null);
                                                setFormData((prev) => ({ ...prev, dob: sanitized }));
                                            }}
                                            placeholder="YYYY-MM-DD"
                                            className="h-11"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <Label htmlFor="yearOfJoining" className="text-sm font-medium text-foreground">
                                            Year of Joining
                                        </Label>
                                        <Select
                                            value={formData.yearOfJoining != null ? String(formData.yearOfJoining) : 'not-set'}
                                            onValueChange={(value) => {
                                                setCustomerEditError(null);
                                                setFormData((previous) => ({
                                                    ...previous,
                                                    yearOfJoining: value === 'not-set' ? null : Number(value),
                                                }));
                                            }}
                                        >
                                            <SelectTrigger id="yearOfJoining" className="h-11">
                                                <SelectValue placeholder="Select year" />
                                            </SelectTrigger>
                                            <SelectContent className="max-h-64">
                                                <SelectItem value="not-set">Not set</SelectItem>
                                                {JOINING_YEAR_OPTIONS.map((year) => (
                                                    <SelectItem key={year} value={String(year)}>
                                                        {year}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <Label htmlFor="clientType" className="text-sm font-medium text-foreground">
                                        Client Type
                                    </Label>
                                    <Select onValueChange={handleClientTypeChange} value={formData.clientType || ""}>
                                        <SelectTrigger className="h-11">
                                            <SelectValue placeholder="Select Client Type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="shop">Shop</SelectItem>
                                            <SelectItem value="site visit">Site Visit</SelectItem>
                                            <SelectItem value="architect">Architect</SelectItem>
                                            <SelectItem value="engineer">Engineer</SelectItem>
                                            <SelectItem value="others">Others</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {isOtherClientType && (
                                    <div className="space-y-3">
                                        <Label htmlFor="otherClientType" className="text-sm font-medium text-foreground">
                                            Other Client Type
                                        </Label>
                                        <Input
                                            id="otherClientType"
                                            name="otherClientType"
                                            value={formData.otherClientType}
                                            placeholder="Enter client type"
                                            className="h-11"
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                )}
                                <div className="flex items-center justify-between pt-4 border-t">
                                    <Button variant="ghost" onClick={requestCloseEditCustomerModal}>
                                        Cancel
                                    </Button>
                                    <Button
                                        className="h-11 px-6"
                                        onClick={() => {
                                            setHasUnlockedAddressTab(true);
                                            setActiveTab("address-info");
                                        }}
                                    >
                                        Continue
                                    </Button>
                                </div>
                            </div>
                        </TabsContent>
                        <TabsContent value="address-info">
                            <div className="space-y-6 py-2">
                                <div className="space-y-3">
                                    <Label htmlFor="addressLine1" className="text-sm font-medium text-foreground">
                                        Address Line 1
                                    </Label>
                                    <Input
                                        id="addressLine1"
                                        name="addressLine1"
                                        value={formData.addressLine1}
                                        onChange={handleInputChange}
                                        placeholder="Enter address line 1"
                                        className="h-11"
                                    />
                                </div>
                                <div className="space-y-3">
                                    <Label htmlFor="addressLine2" className="text-sm font-medium text-foreground">
                                        Address Line 2
                                    </Label>
                                    <Input
                                        id="addressLine2"
                                        name="addressLine2"
                                        value={formData.addressLine2}
                                        onChange={handleInputChange}
                                        placeholder="Enter address line 2"
                                        className="h-11"
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-3">
                                        <Label htmlFor="village" className="text-sm font-medium text-foreground">
                                            Village (District)
                                        </Label>
                                        <Input
                                            id="village"
                                            name="village"
                                            value={formData.village}
                                            onChange={handleInputChange}
                                            placeholder="Enter village"
                                            className="h-11"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <Label htmlFor="taluka" className="text-sm font-medium text-foreground">
                                            Taluka (Sub District)
                                        </Label>
                                        <Input
                                            id="taluka"
                                            name="taluka"
                                            value={formData.taluka}
                                            onChange={handleInputChange}
                                            placeholder="Enter taluka"
                                            className="h-11"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-3">
                                        <Label htmlFor="city" className="text-sm font-medium text-foreground">
                                            City
                                        </Label>
                                        <Input
                                            id="city"
                                            name="city"
                                            value={formData.city}
                                            onChange={handleInputChange}
                                            placeholder="Enter city"
                                            className="h-11"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <Label htmlFor="state" className="text-sm font-medium text-foreground">
                                            State
                                        </Label>
                                        <Input
                                            id="state"
                                            name="state"
                                            value={formData.state}
                                            onChange={handleInputChange}
                                            placeholder="Enter state"
                                            className="h-11"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <Label htmlFor="pincode" className="text-sm font-medium text-foreground">
                                            Pincode
                                        </Label>
                                        <Input
                                            id="pincode"
                                            name="pincode"
                                            value={formData.pincode}
                                            onChange={handleInputChange}
                                            placeholder="Enter pincode"
                                            className="h-11"
                                        />
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t">
                                    <div className="flex gap-2">
                                        <Button variant="outline" onClick={() => setActiveTab("basic-info")} className="h-11 px-6">
                                            Back
                                        </Button>
                                        <Button variant="ghost" onClick={requestCloseEditCustomerModal} className="h-11 px-6">
                                            Cancel
                                        </Button>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <Button onClick={handleSubmit} disabled={isUpdatingCustomer} className="h-11 px-6">
                                            {isUpdatingCustomer && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            Save Changes
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                </DialogContent>
            </Dialog>

            {/* Log Complaint Modal */}
            {isComplaintModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <Card className="w-full max-w-2xl border-0 shadow-lg max-h-[90vh] overflow-y-auto">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-lg md:text-xl font-semibold text-foreground">Log Complaint</CardTitle>
                            <p className="text-xs md:text-sm text-muted-foreground">
                                Capture the complaint details and assign the right teammate to resolve it.
                            </p>
                        </CardHeader>
                        <CardContent>
                            <Tabs value={complaintActiveTab} onValueChange={setComplaintActiveTab} className="w-full">
                                <TabsList className="grid w-full grid-cols-2 mb-4">
                                    <TabsTrigger value="general">General</TabsTrigger>
                                    <TabsTrigger value="details">Details</TabsTrigger>
                                </TabsList>
                                <TabsContent value="general">
                                    <div className="space-y-6 py-2">
                                        <div className="space-y-3">
                                            <Label htmlFor="complaintTitle" className="text-sm font-medium text-foreground">
                                                Complaint Title *
                                            </Label>
                                            <Input
                                                id="complaintTitle"
                                                placeholder="Add a short title"
                                                value={complaintTask.taskTitle}
                                                onChange={(e) => setComplaintTask({ ...complaintTask, taskTitle: e.target.value })}
                                                className="w-full h-11"
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            <Label htmlFor="complaintDescription" className="text-sm font-medium text-foreground">
                                                Complaint Description *
                                            </Label>
                                            <Textarea
                                                id="complaintDescription"
                                                placeholder="Describe the complaint so the assignee has the right context..."
                                                value={complaintTask.taskDesciption}
                                                onChange={(e) => setComplaintTask({ ...complaintTask, taskDesciption: e.target.value })}
                                                className="min-h-[140px]"
                                            />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="complaintCategory" className="text-sm font-medium text-foreground">
                                                    Category
                                                </Label>
                                                <Input
                                                    id="complaintCategory"
                                                    value="Complaint"
                                                    readOnly
                                                    className="h-11 bg-muted text-muted-foreground font-medium cursor-not-allowed"
                                                />
                                                <p className="text-xs text-muted-foreground">
                                                    Category is fixed for complaint records.
                                                </p>
                                            </div>
                                            <div className="space-y-3">
                                                <Label htmlFor="complaintStoreName" className="text-sm font-medium text-foreground">
                                                    Store
                                                </Label>
                                                <Input
                                                    id="complaintStoreName"
                                                    value={(customerData?.storeName as string) || 'Loading...'}
                                                    disabled
                                                    className="w-full h-11 bg-muted text-muted-foreground font-medium cursor-not-allowed"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between pt-4 border-t">
                                            <Button variant="ghost" onClick={requestCloseComplaintModal}>
                                                Cancel
                                            </Button>
                                            <Button onClick={handleComplaintNext} className="h-11 px-6">
                                                Continue
                                            </Button>
                                        </div>
                                    </div>
                                </TabsContent>
                                <TabsContent value="details">
                                    <div className="space-y-6 py-2">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-3">
                                                <Label htmlFor="complaintDueDate" className="text-sm font-medium text-foreground">
                                                    Due Date
                                                </Label>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <Button
                                                            variant="outline"
                                                            className={`w-full h-11 justify-start text-left font-normal ${!complaintTask.dueDate && 'text-muted-foreground'}`}
                                                        >
                                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                                            {complaintTask.dueDate ? format(new Date(complaintTask.dueDate), 'MMM dd, yyyy') : <span>Select due date</span>}
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-0">
                                                        <SpacedCalendar
                                                            mode="single"
                                                            selected={complaintTask.dueDate ? new Date(complaintTask.dueDate + 'T00:00:00') : undefined}
                                                            onSelect={(date: Date | undefined) => {
                                                                if (date) {
                                                                    const year = date.getFullYear();
                                                                    const month = String(date.getMonth() + 1).padStart(2, '0');
                                                                    const day = String(date.getDate()).padStart(2, '0');
                                                                    const dateString = `${year}-${month}-${day}`;
                                                                    setComplaintTask({ ...complaintTask, dueDate: dateString });
                                                                }
                                                            }}
                                                            initialFocus
                                                        />
                                                    </PopoverContent>
                                                </Popover>
                                            </div>
                                            <div className="space-y-3">
                                                <Label htmlFor="complaintPriority" className="text-sm font-medium text-foreground">
                                                    Priority
                                                </Label>
                                                <Select value={complaintTask.priority} onValueChange={(value) => setComplaintTask({ ...complaintTask, priority: value })}>
                                                    <SelectTrigger className="w-full h-11">
                                                        <SelectValue placeholder="Select a priority" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="low">Low</SelectItem>
                                                        <SelectItem value="medium">Medium</SelectItem>
                                                        <SelectItem value="high">High</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            <Label htmlFor="complaintAssignedTo" className="text-sm font-medium text-foreground">
                                                Assigned To
                                            </Label>
                                            <Input
                                                id="complaintAssignedTo"
                                                value={complaintTask.assignedToName || 'Not assigned'}
                                                disabled
                                                className="w-full h-11 bg-muted text-foreground font-medium cursor-not-allowed"
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                This field is auto-filled with the field officer assigned to this store.
                                            </p>
                                        </div>
                                        {taskCreateError && (
                                            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                                                {taskCreateError}
                                            </div>
                                        )}
                                        <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t">
                                            <Button variant="outline" onClick={handleComplaintBack} className="h-11 px-6">
                                                Back
                                            </Button>
                                            <div className="flex gap-2">
                                                <Button variant="ghost" onClick={requestCloseComplaintModal} className="h-11 px-6">
                                                    Cancel
                                                </Button>
                                                <Button onClick={handleCreateComplaint} disabled={isCreatingTask} className="h-11 px-6">
                                                    {isCreatingTask && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                    Save Complaint
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Add Requirement Modal */}
            {isRequirementModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <Card className="w-full max-w-2xl border-0 shadow-lg max-h-[90vh] overflow-y-auto">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-lg md:text-xl font-semibold text-foreground">Add Requirement</CardTitle>
                            <p className="text-xs md:text-sm text-muted-foreground">
                                Capture the requirement and assign it to the right teammate.
                            </p>
                        </CardHeader>
                        <CardContent>
                            <Tabs value={requirementActiveTab} onValueChange={setRequirementActiveTab} className="w-full">
                                <TabsList className="grid w-full grid-cols-2 mb-4">
                                    <TabsTrigger value="general">General</TabsTrigger>
                                    <TabsTrigger value="details">Details</TabsTrigger>
                                </TabsList>
                                <TabsContent value="general">
                                    <div className="space-y-6 py-2">
                                        <div className="space-y-3">
                                            <Label htmlFor="requirementTitle" className="text-sm font-medium text-foreground">
                                                Requirement Title *
                                            </Label>
                                            <Input
                                                id="requirementTitle"
                                                placeholder="What does the customer need?"
                                                value={requirementTask.taskTitle}
                                                onChange={(e) => setRequirementTask({ ...requirementTask, taskTitle: e.target.value })}
                                                className="w-full h-11"
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            <Label htmlFor="requirementDescription" className="text-sm font-medium text-foreground">
                                                Requirement Description *
                                            </Label>
                                            <Textarea
                                                id="requirementDescription"
                                                placeholder="Document the requirement so the assignee understands the scope..."
                                                value={requirementTask.taskDesciption}
                                                onChange={(e) => setRequirementTask({ ...requirementTask, taskDesciption: e.target.value })}
                                                className="min-h-[140px]"
                                            />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="requirementCategory" className="text-sm font-medium text-foreground">
                                                    Category
                                                </Label>
                                                <Input
                                                    id="requirementCategory"
                                                    value="Requirement"
                                                    readOnly
                                                    className="h-11 bg-muted text-muted-foreground font-medium cursor-not-allowed"
                                                />
                                                <p className="text-xs text-muted-foreground">
                                                    Category stays fixed for requirements.
                                                </p>
                                            </div>
                                            <div className="space-y-3">
                                                <Label htmlFor="requirementStoreName" className="text-sm font-medium text-foreground">
                                                    Store
                                                </Label>
                                                <Input
                                                    id="requirementStoreName"
                                                    value={(customerData?.storeName as string) || 'Loading...'}
                                                    disabled
                                                    className="w-full h-11 bg-muted text-muted-foreground font-medium cursor-not-allowed"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between pt-4 border-t">
                                            <Button variant="ghost" onClick={requestCloseRequirementModal}>
                                                Cancel
                                            </Button>
                                            <Button onClick={handleRequirementNext} className="h-11 px-6">
                                                Continue
                                            </Button>
                                        </div>
                                    </div>
                                </TabsContent>
                                <TabsContent value="details">
                                    <div className="space-y-6 py-2">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-3">
                                                <Label htmlFor="requirementDueDate" className="text-sm font-medium text-foreground">
                                                    Due Date
                                                </Label>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <Button
                                                            variant="outline"
                                                            className={`w-full h-11 justify-start text-left font-normal ${!requirementTask.dueDate && 'text-muted-foreground'}`}
                                                        >
                                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                                            {requirementTask.dueDate ? format(new Date(requirementTask.dueDate), 'MMM dd, yyyy') : <span>Select due date</span>}
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-0">
                                                        <SpacedCalendar
                                                            mode="single"
                                                            selected={requirementTask.dueDate ? new Date(requirementTask.dueDate + 'T00:00:00') : undefined}
                                                            onSelect={(date: Date | undefined) => {
                                                                if (date) {
                                                                    const year = date.getFullYear();
                                                                    const month = String(date.getMonth() + 1).padStart(2, '0');
                                                                    const day = String(date.getDate()).padStart(2, '0');
                                                                    const dateString = `${year}-${month}-${day}`;
                                                                    setRequirementTask({ ...requirementTask, dueDate: dateString });
                                                                }
                                                            }}
                                                            initialFocus
                                                        />
                                                    </PopoverContent>
                                                </Popover>
                                            </div>
                                            <div className="space-y-3">
                                                <Label htmlFor="requirementPriority" className="text-sm font-medium text-foreground">
                                                    Priority
                                                </Label>
                                                <Select value={requirementTask.priority} onValueChange={(value) => setRequirementTask({ ...requirementTask, priority: value })}>
                                                    <SelectTrigger className="w-full h-11">
                                                        <SelectValue placeholder="Select a priority" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="low">Low</SelectItem>
                                                        <SelectItem value="medium">Medium</SelectItem>
                                                        <SelectItem value="high">High</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            <Label htmlFor="requirementAssignedTo" className="text-sm font-medium text-foreground">
                                                Assigned To
                                            </Label>
                                            <Input
                                                id="requirementAssignedTo"
                                                value={requirementTask.assignedToName || 'Not assigned'}
                                                disabled
                                                className="w-full h-11 bg-muted text-foreground font-medium cursor-not-allowed"
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                This field is auto-filled with the field officer assigned to this store.
                                            </p>
                                        </div>
                                        {taskCreateError && (
                                            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                                                {taskCreateError}
                                            </div>
                                        )}
                                        <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t">
                                            <Button variant="outline" onClick={handleRequirementBack} className="h-11 px-6">
                                                Back
                                            </Button>
                                            <div className="flex gap-2">
                                                <Button variant="ghost" onClick={requestCloseRequirementModal} className="h-11 px-6">
                                                    Cancel
                                                </Button>
                                                <Button onClick={handleCreateRequirement} disabled={isCreatingTask} className="h-11 px-6">
                                                    {isCreatingTask && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                    Save Requirement
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
