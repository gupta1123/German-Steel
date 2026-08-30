'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
    Check, 
    X, 
    Search,
    Calendar, 
    Clock, 
    AlertTriangle, 
    Briefcase,
    RefreshCw,
    CheckCircle2,
    XCircle,
    MessageSquareText
} from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { toast } from 'sonner';
import { isManagerRoleValue, normalizeRoleValue } from '@/lib/auth';
import { API, type TeamDataDto } from '@/lib/api';
import { getUniqueFieldOfficersFromTeams } from '@/lib/team-access';
import { isAdminEmployeeRole } from '@/lib/employee-role';

// UI Components
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { SearchableSelect, type SearchableOption } from '@/components/ui/searchable-select2';

// Types
interface ApprovalRequest {
    id: number;
    employeeId: number;
    employeeName: string;
    requestDate: string;
    requestedStatus: string;
    logDate: string;
    actionDate: string | null;
    status: string;
    // Added description field to interface
    description?: string; 
    reason?: string;
    isDuplicate?: boolean;
    duplicateCount?: number;
    duplicateIndex?: number;
}

interface EmployeeDirectoryEntry {
    id: number;
    firstName: string;
    lastName: string;
    role?: string;
    userName?: string;
    email?: string;
}

type ApprovalTypeValue = 'full day' | 'half day';
type ApprovalTypeState = Record<number, ApprovalTypeValue>;

export default function ApprovalsPage() {
    const { token, userData } = useAuth();
    
    // Data State
    const [requests, setRequests] = useState<ApprovalRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    
    // UI State
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
    const [eligibleEmployees, setEligibleEmployees] = useState<EmployeeDirectoryEntry[]>([]);
    const [activeTab, setActiveTab] = useState('pending');
    const [approvalType, setApprovalType] = useState<ApprovalTypeState>({});
    const [savingIds, setSavingIds] = useState<number[]>([]);
    
    // Role State
    const [isManager, setIsManager] = useState(false);
    const [isFieldOfficer, setIsFieldOfficer] = useState(false);
    const [teamId, setTeamId] = useState<number | null>(null);
    const [teamMemberIds, setTeamMemberIds] = useState<number[]>([]);

    // --- 1. Initial Data Loading ---
    useEffect(() => {
        const fetchCurrentUser = async () => {
            if (!token) return;
            try {
                const response = await fetch('http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/user/manage/current-user', {
                    headers: { 'Authorization': `Bearer ${token}` },
                });
                
                if (response.ok) {
                    const data = await response.json();
                    const role = data.authorities?.[0]?.authority;
                    const normalizedRole = normalizeRoleValue(role);
                    
                    setIsManager(isManagerRoleValue(role));
                    setIsFieldOfficer(normalizedRole === 'ROLE_FIELD OFFICER' || normalizedRole === 'FIELD OFFICER');
                }
            } catch (error) {
                console.error('Error fetching user:', error);
            }
        };
        fetchCurrentUser();
    }, [token]);

    useEffect(() => {
        const loadTeamData = async () => {
            if ((!isManager && !isFieldOfficer) || !userData?.employeeId) return;
            try {
                const teamData: TeamDataDto[] = await API.getTeamByEmployee(userData.employeeId);
                setTeamId(teamData.length > 0 ? teamData[0].id : null);
                setTeamMemberIds(getUniqueFieldOfficersFromTeams(teamData).map((officer) => officer.id));
            } catch (err) {
                setTeamId(null);
                setTeamMemberIds([]);
            }
        };
        loadTeamData();
    }, [isManager, isFieldOfficer, userData?.employeeId]);

    useEffect(() => {
        if (token) fetchRequests();
    }, [token, teamId, teamMemberIds, isManager, isFieldOfficer, userData?.employeeId]);

    useEffect(() => {
        if (!token) return;

        let isMounted = true;
        API.getAllEmployees()
            .then((data) => {
                if (!isMounted) return;
                setEligibleEmployees(
                    data
                        .filter((employee) => !isAdminEmployeeRole(employee.role))
                        .sort((a, b) => {
                            const aName = `${a.firstName ?? ''} ${a.lastName ?? ''}`.trim();
                            const bName = `${b.firstName ?? ''} ${b.lastName ?? ''}`.trim();
                            return aName.localeCompare(bName);
                        })
                );
            })
            .catch(() => {
                if (isMounted) setEligibleEmployees([]);
            });

        return () => {
            isMounted = false;
        };
    }, [token]);

    // --- 2. API Logic ---
    const fetchRequests = async () => {
        if (!token) return;
        if ((isManager || isFieldOfficer) && teamId === null) return;
        
        try {
            if (requests.length === 0) setLoading(true);
            else setIsRefreshing(true);

            const results = await Promise.all(['pending', 'approved', 'rejected'].map(async (status) => {
                const response = await fetch(`http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/request/getByStatus?status=${status}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!response.ok) throw new Error('Unable to load attendance requests.');
                const records = await response.json();
                if (!Array.isArray(records)) throw new Error('Invalid attendance response.');
                return records as ApprovalRequest[];
            }));
            const data = Array.from(new Map(results.flat().map(request => [request.id, request])).values());

            // --- MOCK DESCRIPTION LOGIC (Remove this block when API has real descriptions) ---
            // Uncomment the lines below to see how descriptions look in the UI right now
            /* 
            const dataWithMockDesc = data.map((req, i) => ({
                ...req,
                description: i % 3 === 0 ? "Feeling unwell since morning." : i % 4 === 0 ? "Family emergency, need to leave early." : undefined
            }));
            setRequests(dataWithMockDesc);
            */
            // --------------------------------------------------------------------------------

            const scopedData = isManager || isFieldOfficer
                ? data.filter((request) => teamMemberIds.includes(request.employeeId) || request.employeeId === userData?.employeeId)
                : data;
            setRequests(scopedData);
            setError(null);
        } catch (err) {
            setError('Failed to fetch requests.');
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    };

    const handleAction = async (id: number, action: 'approved' | 'rejected') => {
        if (!token || savingIds.includes(id)) return;
        
        const currentReq = requests.find(r => r.id === id);
        const type = approvalType[id] || (currentReq?.requestedStatus || 'full day');
        
        setSavingIds(prev => [...prev, id]);

        try {
            const response = await fetch(
                `http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/request/updateStatus?id=${id}&status=${action}&attendance=${encodeURIComponent(type)}`,
                {
                    method: 'PUT',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        requestId: id.toString()
                    }
                }
            );
            if (!response.ok) {
                const failure = await response.json().catch(() => null);
                const detail = typeof failure?.message === 'string' ? failure.message : '';
                if (response.status === 404 && /log not found/i.test(detail)) {
                    throw new Error('No attendance log exists for this date. The request is still pending; an administrator needs to resolve the missing log before approval.');
                }
                throw new Error(`Unable to update attendance request (HTTP ${response.status}).${detail ? ` ${detail}` : ' Please try again.'}`);
            }
            setRequests(prev => prev.map(request => request.id === id ? { ...request, status: action, requestedStatus: type } : request));
            setError(null);
            toast.success(`Attendance request ${action}.`, { duration: 3000 });
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unable to update attendance request. Please try again.';
            setError(message);
            toast.error(message, { duration: 3000 });
        } finally {
            setSavingIds(prev => prev.filter(value => value !== id));
        }
    };

    // --- 3. Data Processing ---
    const processedRequests = useMemo(() => {
        const grouped = requests.reduce((acc, req) => {
            const key = `${req.employeeId}-${req.logDate}`;
            if (!acc[key]) acc[key] = [];
            acc[key].push(req);
            return acc;
        }, {} as Record<string, ApprovalRequest[]>);

        const flat = Object.values(grouped).flatMap(group => {
            if (group.length > 1) {
                return group.map((req, idx) => ({
                    ...req,
                    isDuplicate: true,
                    duplicateCount: group.length,
                    duplicateIndex: idx + 1
                }));
            }
            return group;
        });

        return flat.filter(req => {
            const matchesEmployee = !selectedEmployeeId || req.employeeId === Number(selectedEmployeeId);
            const status = req.status?.toLowerCase() || 'pending';
            
            if (activeTab === 'pending') {
                return matchesEmployee && status === 'pending';
            } else {
                return matchesEmployee && status !== 'pending';
            }
        }).sort((a, b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime());
    }, [requests, selectedEmployeeId, activeTab]);

    const employeeOptions = useMemo<SearchableOption[]>(() => eligibleEmployees.map((employee) => {
        const name = `${employee.firstName ?? ''} ${employee.lastName ?? ''}`.trim();
        return {
            value: String(employee.id),
            label: name || employee.userName || employee.email || `Employee ${employee.id}`,
        };
    }), [eligibleEmployees]);

    const stats = useMemo(() => {
        const pending = requests.filter(r => r.status?.toLowerCase() === 'pending').length;
        return { pending, total: requests.length };
    }, [requests]);

    // --- Helpers ---
    const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const formatDate = (date: string) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });

    if (loading) return <LoadingSkeleton />;

    return (
        <div className="mx-auto w-full max-w-none py-4">
                <Tabs defaultValue="pending" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                    <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
                        <TabsList className="grid h-9 w-full grid-cols-2 p-1 sm:w-[320px]">
                            <TabsTrigger value="pending">Pending requests</TabsTrigger>
                            <TabsTrigger value="history">Request history</TabsTrigger>
                        </TabsList>
                        
                        <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
                            <div className="min-w-[220px] flex-1 sm:max-w-[300px]">
                                <Label className="sr-only">Employee</Label>
                                <SearchableSelect
                                    options={employeeOptions}
                                    value={selectedEmployeeId || undefined}
                                    onSelect={(option) => setSelectedEmployeeId(option?.value ?? '')}
                                    placeholder="All employees"
                                    searchPlaceholder="Search employees..."
                                    emptyMessage="No employees found"
                                    allowClear
                                    triggerClassName="h-9 w-full bg-background text-sm shadow-none"
                                />
                            </div>
                            <div className="flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-xs text-muted-foreground">
                                <Clock className="h-3.5 w-3.5 text-amber-600" />
                                <span><span className="font-semibold text-foreground">{stats.pending}</span> pending</span>
                                <span className="text-border">•</span>
                                <span><span className="font-semibold text-foreground">{stats.total}</span> total</span>
                            </div>
                            <Button 
                                variant="outline" 
                                size="icon" 
                                onClick={fetchRequests} 
                                disabled={isRefreshing}
                                className="h-9 w-9 shrink-0"
                                aria-label="Refresh approval requests"
                            >
                                <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                            </Button>
                        </div>
                    </div>

                    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                    <Card className="overflow-hidden border-border/70 bg-card shadow-sm">
                            <div className="w-full align-middle">
                                <div className="hidden lg:grid grid-cols-12 gap-4 border-b bg-muted/30 px-5 py-2.5 text-[11px] font-medium text-muted-foreground">
                                    <div className="col-span-4">Employee</div>
                                    <div className="col-span-3">Request dates</div>
                                    <div className="col-span-2">Attendance</div>
                                    <div className="col-span-3 text-right">Actions</div>
                                </div>

                                <div className="divide-y divide-border">
                                    {processedRequests.length === 0 ? (
                                        <EmptyState activeTab={activeTab} />
                                    ) : (
                                        processedRequests.map((req) => (
                                            <RequestRow
                                                key={req.id}
                                                req={req}
                                                saving={savingIds.includes(req.id)}
                                                activeTab={activeTab}
                                                approvalType={approvalType}
                                                setApprovalType={setApprovalType}
                                                handleAction={handleAction}
                                                formatDate={formatDate}
                                                getInitials={getInitials}
                                            />
                                        ))
                                    )}
                                </div>
                            </div>
                    </Card>
                </Tabs>
        </div>
    );
}

// --- Sub Components ---

interface RequestRowProps {
    saving: boolean;
    req: ApprovalRequest;
    activeTab: string;
    approvalType: ApprovalTypeState;
    setApprovalType: React.Dispatch<React.SetStateAction<ApprovalTypeState>>;
    handleAction: (id: number, action: 'approved' | 'rejected') => Promise<void> | void;
    formatDate: (date: string) => string;
    getInitials: (name: string) => string;
}

function RequestRow({ 
    saving,
    req, 
    activeTab, 
    approvalType, 
    setApprovalType, 
    handleAction, 
    formatDate,
    getInitials 
}: RequestRowProps) {
    const isPending = activeTab === 'pending';
    const currentType = approvalType[req.id] || req.requestedStatus || 'full day';

    // Duplicate logic styles
    const rowClass = req.isDuplicate 
        ? "bg-orange-50/40 dark:bg-orange-950/20 hover:bg-orange-50 dark:hover:bg-orange-950/30" 
        : "bg-card hover:bg-muted/30";

    return (
        <div
            className={`group flex flex-col gap-4 border-l-2 px-4 py-4 transition-colors lg:grid lg:grid-cols-12 lg:px-5 ${req.isDuplicate ? 'border-l-orange-500' : 'border-l-transparent'} ${rowClass}`}
        >
            {/* 1. Employee Info & Description */}
            <div className="col-span-4 w-full">
                <div className="flex items-start gap-3">
                    <Avatar className="mt-0.5 h-10 w-10 border border-border">
                        <AvatarFallback className="bg-muted text-xs font-semibold text-foreground">
                            {getInitials(req.employeeName)}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                        <div className="mb-0.5 flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-sm font-semibold text-foreground">{req.employeeName}</h3>
                            {req.isDuplicate && (
                                <Badge variant="outline" className="h-5 px-1.5 text-[10px] border-orange-500/50 text-orange-600 dark:text-orange-400 bg-orange-100/50">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    Duplicate #{req.duplicateIndex}
                                </Badge>
                            )}
                        </div>
                        <div className="mb-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <Briefcase className="h-3 w-3" />
                            <span>ID: {req.employeeId}</span>
                        </div>
                        
                        {/* DESCRIPTION FIELD UI */}
                        {req.reason && <p className="mb-1 text-xs text-muted-foreground">{req.reason}</p>}
                        {/* This will render if description exists, or handle if it's undefined gracefully */}
                        {req.description ? (
                            <div className="relative rounded-md border border-border/50 bg-muted/40 p-2">
                                <div className="flex gap-2 items-start">
                                    <MessageSquareText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                    <p className="line-clamp-2 text-xs italic leading-relaxed text-foreground">
                                        <span aria-hidden="true">&ldquo;</span>
                                        {req.description}
                                        <span aria-hidden="true">&rdquo;</span>
                                    </p>
                                </div>
                            </div>
                        ) : (
                             // Optional: Placeholder if you want to indicate no description, 
                             // otherwise keep it empty for cleaner look.
                            null
                        )}
                    </div>
                </div>
            </div>

            {/* 2. Date Info */}
            <div className="col-span-3 flex w-full justify-between gap-1 border-t border-dashed pt-3 lg:flex-col lg:justify-center lg:border-t-0 lg:pt-0">
                <div>
                    <div className="flex w-fit items-center gap-2 rounded py-1 text-sm font-medium text-foreground lg:w-full lg:py-0">
                        <Calendar className="h-4 w-4 text-primary/70" />
                        Attendance: {formatDate(req.logDate)}
                    </div>
                </div>
                <div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        Submitted: {formatDate(req.requestDate)}
                    </div>
                </div>
            </div>

            {/* 3. Type Selector */}
            <div className="col-span-2 flex w-full items-center">
                {isPending ? (
                    <div className="w-full">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold block mb-2 lg:hidden">Attendance Type</span>
                        <div className="flex w-full rounded-md bg-muted/60 p-1 lg:w-auto">
                            <button
                                onClick={() => setApprovalType((prev) => ({ ...prev, [req.id]: 'full day' }))}
                                disabled={saving}
                                className={`flex-1 rounded px-3 py-1 text-xs font-medium transition-all ${
                                    currentType === 'full day' 
                                    ? 'bg-background text-foreground shadow-sm ring-1 ring-black/5 dark:ring-white/10' 
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                Full Day
                            </button>
                            <button
                                onClick={() => setApprovalType((prev) => ({ ...prev, [req.id]: 'half day' }))}
                                disabled={saving}
                                className={`flex-1 rounded px-3 py-1 text-xs font-medium transition-all ${
                                    currentType === 'half day' 
                                    ? 'bg-background text-foreground shadow-sm ring-1 ring-black/5 dark:ring-white/10' 
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                Half Day
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center">
                         <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mr-2 lg:hidden">Type:</span>
                        <Badge variant="secondary" className="capitalize px-3 py-1">
                            {req.requestedStatus}
                        </Badge>
                    </div>
                )}
            </div>

            {/* 4. Actions */}
            <div className="col-span-3 flex w-full items-center lg:justify-end">
                {isPending ? (
                    <div className="flex w-full gap-2 lg:w-auto">
                        <Button 
                            onClick={() => handleAction(req.id, 'approved')}
                            disabled={saving}
                            size="sm"
                            className="h-8 flex-1 bg-emerald-600 text-xs text-white shadow-none hover:bg-emerald-700 lg:flex-none"
                        >
                            <Check className="h-4 w-4 mr-2" />
                            Approve
                        </Button>
                        <Button 
                            variant="outline"
                            onClick={() => handleAction(req.id, 'rejected')}
                            disabled={saving}
                            size="sm"
                            className="h-8 flex-1 border-destructive/25 text-xs text-destructive hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive lg:flex-none"
                        >
                            <X className="h-4 w-4 mr-2" />
                            Reject
                        </Button>
                    </div>
                ) : (
                    <div className="w-full lg:w-auto flex justify-end">
                        <StatusBadge status={req.status} />
                    </div>
                )}
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const s = status?.toLowerCase();
    
    if (s === 'approved') {
        return (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="h-4 w-4" /> Approved
            </div>
        );
    }
    if (s === 'rejected') {
        return (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800">
                <XCircle className="h-4 w-4" /> Rejected
            </div>
        );
    }
    return (
        <Badge variant="outline" className="capitalize">{status}</Badge>
    );
}

function EmptyState({ activeTab }: { activeTab: string }) {
    return (
        <div
            className="flex w-full flex-col items-center justify-center px-4 py-16 text-center"
        >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
                {activeTab === 'pending' 
                    ? <Check className="h-6 w-6 text-muted-foreground/50" />
                    : <Search className="h-6 w-6 text-muted-foreground/50" />
                }
            </div>
            <h3 className="text-base font-semibold text-foreground">
                {activeTab === 'pending' ? "All caught up!" : "No records found"}
            </h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                {activeTab === 'pending' 
                    ? "There are no pending requests requiring your attention right now." 
                    : "Try adjusting your search filters to find past requests."}
            </p>
        </div>
    );
}

function LoadingSkeleton() {
    return (
        <div className="w-full space-y-4 py-4">
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                <Skeleton className="h-9 w-full sm:w-80" />
                <div className="flex gap-2">
                    <Skeleton className="h-9 w-64" />
                    <Skeleton className="h-9 w-9" />
                </div>
            </div>
            <div className="border rounded-xl bg-card overflow-hidden">
                <div className="divide-y p-0">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="flex items-center gap-4 p-4">
                            <Skeleton className="h-10 w-10 rounded-full" />
                            <div className="w-full flex-1 space-y-2">
                                <Skeleton className="h-4 w-1/3" />
                                <Skeleton className="h-3 w-2/3" />
                            </div>
                            <Skeleton className="h-8 w-28" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
