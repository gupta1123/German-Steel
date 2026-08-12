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
    MessageSquareText, // Icon for description
    Filter
} from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { isManagerRoleValue, normalizeRoleValue } from '@/lib/auth';
import { API, type TeamDataDto } from '@/lib/api';
import { getUniqueFieldOfficersFromTeams } from '@/lib/team-access';

// UI Components
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

// Animations
import { motion, AnimatePresence } from 'framer-motion';

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
    isDuplicate?: boolean;
    duplicateCount?: number;
    duplicateIndex?: number;
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
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('pending');
    const [approvalType, setApprovalType] = useState<ApprovalTypeState>({});
    
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
                const response = await fetch('/api/proxy/user/manage/current-user', {
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

    // --- 2. API Logic ---
    const fetchRequests = async () => {
        if (!token) return;
        if ((isManager || isFieldOfficer) && teamId === null) return;
        
        try {
            if (requests.length === 0) setLoading(true);
            else setIsRefreshing(true);

            const url = '/api/proxy/request/getByStatus?status=pending';
            const response = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data: ApprovalRequest[] = await response.json();

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
        if (!token) return;
        
        const currentReq = requests.find(r => r.id === id);
        const type = approvalType[id] || (currentReq?.requestedStatus || 'full day');
        
        // Optimistic Update
        const originalRequests = [...requests];
        setRequests(prev => prev.filter(r => r.id !== id));

        try {
            await fetch(
                `/api/proxy/request/updateStatus?id=${id}&status=${action}&attendance=${encodeURIComponent(type)}`,
                {
                    method: 'PUT',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        requestId: id.toString()
                    }
                }
            );
        } catch (err) {
            setRequests(originalRequests); // Revert on error
            setError('Action failed. Please try again.');
        }
    };

    // --- 3. Data Processing ---
    const processedRequests = useMemo(() => {
        const grouped = requests.reduce((acc, req) => {
            const key = `${req.employeeId}-${req.requestDate}`;
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
            const matchesSearch = req.employeeName.toLowerCase().includes(searchTerm.toLowerCase());
            const status = req.status?.toLowerCase() || 'pending';
            
            if (activeTab === 'pending') {
                return matchesSearch && status === 'pending';
            } else {
                return matchesSearch && status !== 'pending';
            }
        }).sort((a, b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime());
    }, [requests, searchTerm, activeTab]);

    const stats = useMemo(() => {
        const pending = requests.filter(r => r.status?.toLowerCase() === 'pending').length;
        return { pending, total: requests.length };
    }, [requests]);

    // --- Helpers ---
    const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const formatDate = (date: string) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    if (loading) return <LoadingSkeleton />;

    return (
        <div className="min-h-screen bg-background p-4 md:p-6 w-full animate-in fade-in duration-500">
            {/* Full width container */}
            <div className="w-full space-y-6">
                
                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pb-4 border-b">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">Approvals</h1>
                        <p className="text-muted-foreground mt-1">Review and manage team attendance requests.</p>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <Badge variant="outline" className="px-4 py-2 text-sm font-normal bg-card shadow-sm border-border">
                            <Clock className="w-4 h-4 mr-2 text-orange-500" />
                            Pending: <span className="font-bold ml-1 text-foreground">{stats.pending}</span>
                        </Badge>
                        <Badge variant="outline" className="px-4 py-2 text-sm font-normal bg-card shadow-sm border-border">
                            <Briefcase className="w-4 h-4 mr-2 text-blue-500" />
                            Total: <span className="font-bold ml-1 text-foreground">{stats.total}</span>
                        </Badge>
                    </div>
                </div>

                {/* Main Controls & List */}
                <Tabs defaultValue="pending" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                    
                    {/* Filter Toolbar */}
                    <div className="flex flex-col lg:flex-row gap-4 justify-between items-center bg-card p-4 rounded-xl border shadow-sm">
                        <TabsList className="grid w-full lg:w-[400px] grid-cols-2">
                            <TabsTrigger value="pending">Pending Actions</TabsTrigger>
                            <TabsTrigger value="history">History Log</TabsTrigger>
                        </TabsList>
                        
                        <div className="flex items-center gap-3 w-full lg:w-auto">
                            <div className="relative flex-1 lg:w-[400px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Search by employee name..." 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-9 bg-background" 
                                />
                            </div>
                            <Button 
                                variant="outline" 
                                size="icon" 
                                onClick={fetchRequests} 
                                disabled={isRefreshing}
                                className={isRefreshing ? "animate-spin" : ""}
                            >
                                <RefreshCw className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Content Table/List */}
                    <Card className="border shadow-sm bg-card overflow-hidden">
                        <ScrollArea className="h-[calc(100vh-300px)] min-h-[500px]">
                            <div className="w-full inline-block align-middle">
                                {/* Desktop Header */}
                                <div className="hidden lg:grid grid-cols-12 gap-6 px-6 py-4 border-b bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider sticky top-0 backdrop-blur-sm z-10">
                                    <div className="col-span-4">Employee & Description</div>
                                    <div className="col-span-3">Date Information</div>
                                    <div className="col-span-2">Attendance Type</div>
                                    <div className="col-span-3 text-right">Actions</div>
                                </div>

                                <div className="divide-y divide-border">
                                    <AnimatePresence mode="popLayout">
                                        {processedRequests.length === 0 ? (
                                            <EmptyState activeTab={activeTab} />
                                        ) : (
                                            processedRequests.map((req) => (
                                                <RequestRow 
                                                    key={req.id} 
                                                    req={req} 
                                                    activeTab={activeTab}
                                                    approvalType={approvalType}
                                                    setApprovalType={setApprovalType}
                                                    handleAction={handleAction}
                                                    formatDate={formatDate}
                                                    getInitials={getInitials}
                                                />
                                            ))
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </ScrollArea>
                    </Card>
                </Tabs>
            </div>
        </div>
    );
}

// --- Sub Components ---

interface RequestRowProps {
    req: ApprovalRequest;
    activeTab: string;
    approvalType: ApprovalTypeState;
    setApprovalType: React.Dispatch<React.SetStateAction<ApprovalTypeState>>;
    handleAction: (id: number, action: 'approved' | 'rejected') => Promise<void> | void;
    formatDate: (date: string) => string;
    getInitials: (name: string) => string;
}

function RequestRow({ 
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
        <motion.div
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className={`group flex flex-col lg:grid lg:grid-cols-12 gap-6 p-6 transition-all border-l-4 ${req.isDuplicate ? 'border-l-orange-500' : 'border-l-transparent'} ${rowClass}`}
        >
            {/* 1. Employee Info & Description */}
            <div className="col-span-4 w-full">
                <div className="flex items-start gap-4">
                    <Avatar className="h-12 w-12 border-2 border-background shadow-sm mt-1">
                        <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                            {getInitials(req.employeeName)}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h3 className="font-semibold text-base text-foreground truncate">{req.employeeName}</h3>
                            {req.isDuplicate && (
                                <Badge variant="outline" className="h-5 px-1.5 text-[10px] border-orange-500/50 text-orange-600 dark:text-orange-400 bg-orange-100/50">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    Duplicate #{req.duplicateIndex}
                                </Badge>
                            )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                            <Briefcase className="h-3 w-3" />
                            <span>ID: {req.employeeId}</span>
                        </div>
                        
                        {/* DESCRIPTION FIELD UI */}
                        {/* This will render if description exists, or handle if it's undefined gracefully */}
                        {req.description ? (
                            <div className="relative bg-muted/50 dark:bg-muted/20 p-3 rounded-lg border border-border/50">
                                <div className="flex gap-2 items-start">
                                    <MessageSquareText className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                                    <p className="text-sm text-foreground italic leading-relaxed">
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
            <div className="col-span-3 w-full flex lg:flex-col justify-between lg:justify-center gap-1 border-t lg:border-t-0 border-dashed pt-4 lg:pt-0">
                <div>
                    <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold block mb-1 lg:hidden">Request Date</span>
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground bg-background/50 w-fit lg:w-full lg:bg-transparent rounded px-2 lg:px-0 py-1 lg:py-0">
                        <Calendar className="h-4 w-4 text-primary/70" />
                        {formatDate(req.requestDate)}
                    </div>
                </div>
                <div>
                    <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold block mb-1 lg:hidden mt-2">Log Date</span>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground px-2 lg:px-0">
                        <Clock className="h-3.5 w-3.5" />
                        Logged: {formatDate(req.logDate)}
                    </div>
                </div>
            </div>

            {/* 3. Type Selector */}
            <div className="col-span-2 w-full flex items-center pt-2 lg:pt-0">
                {isPending ? (
                    <div className="w-full">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold block mb-2 lg:hidden">Attendance Type</span>
                        <div className="bg-muted/60 p-1 rounded-lg flex w-full lg:w-auto">
                            <button
                                onClick={() => setApprovalType((prev) => ({ ...prev, [req.id]: 'full day' }))}
                                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                                    currentType === 'full day' 
                                    ? 'bg-background text-foreground shadow-sm ring-1 ring-black/5 dark:ring-white/10' 
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                Full Day
                            </button>
                            <button
                                onClick={() => setApprovalType((prev) => ({ ...prev, [req.id]: 'half day' }))}
                                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
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
            <div className="col-span-3 w-full flex items-center lg:justify-end pt-2 lg:pt-0">
                {isPending ? (
                    <div className="flex flex-col sm:flex-row w-full lg:w-auto gap-3">
                        <Button 
                            onClick={() => handleAction(req.id, 'approved')}
                            className="flex-1 lg:flex-none bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm hover:shadow"
                        >
                            <Check className="h-4 w-4 mr-2" />
                            Approve
                        </Button>
                        <Button 
                            variant="outline"
                            onClick={() => handleAction(req.id, 'rejected')}
                            className="flex-1 lg:flex-none text-destructive border-destructive/20 hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive"
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
        </motion.div>
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
        <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="flex flex-col items-center justify-center py-24 text-center px-4 w-full"
        >
            <div className="h-20 w-20 bg-muted/50 rounded-full flex items-center justify-center mb-6">
                {activeTab === 'pending' 
                    ? <Check className="h-10 w-10 text-muted-foreground/50" /> 
                    : <Search className="h-10 w-10 text-muted-foreground/50" />
                }
            </div>
            <h3 className="text-xl font-semibold text-foreground">
                {activeTab === 'pending' ? "All caught up!" : "No records found"}
            </h3>
            <p className="text-muted-foreground max-w-sm mt-2 text-base">
                {activeTab === 'pending' 
                    ? "There are no pending requests requiring your attention right now." 
                    : "Try adjusting your search filters to find past requests."}
            </p>
        </motion.div>
    );
}

function LoadingSkeleton() {
    return (
        <div className="p-6 space-y-8 w-full">
            <div className="flex justify-between items-end">
                <div className="space-y-3">
                    <Skeleton className="h-10 w-48" />
                    <Skeleton className="h-5 w-64" />
                </div>
                <div className="flex gap-2">
                    <Skeleton className="h-10 w-24" />
                    <Skeleton className="h-10 w-24" />
                </div>
            </div>
            <div className="border rounded-xl bg-card overflow-hidden">
                <div className="p-4 border-b">
                    <div className="flex justify-between gap-4">
                        <Skeleton className="h-12 w-full lg:w-96" />
                    </div>
                </div>
                <div className="divide-y p-0">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="flex flex-col lg:flex-row items-center gap-6 p-6">
                            <Skeleton className="h-12 w-12 rounded-full" />
                            <div className="space-y-3 flex-1 w-full">
                                <Skeleton className="h-5 w-1/3" />
                                <Skeleton className="h-4 w-2/3" />
                            </div>
                            <Skeleton className="h-10 w-32" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
