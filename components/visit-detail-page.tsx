"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  User, 
  Clock, 
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  MessageSquare,
  FileText,
  AlertCircle,
  Image as ImageIcon,
  Navigation,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Store,
  CheckCircle,
  Loader2,
  ExternalLink,
  ClipboardList,
  ListTodo,
  LogIn,
  LogOut,
  Gift,
  ChevronLeft,
  ChevronRight,
  X,
  Hash,
  Package,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCityLabel } from "@/lib/city-options";
import { format, parseISO } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { API, BrandProCon, IntentAuditLog, MonthlySaleChange, Task, Note as ApiNote, VisitAttachmentResponse, VisitDto } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { hasManagerPrivileges } from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";
import Image from 'next/image';
import BrandTab from './BrandTab';
import VisitTasksTab from './visit-tasks-tab';
import { normalizeVisitTask } from '@/lib/visit-task';
import { teamsApi } from '@/lib/teams-api';
import { useGuardedRouter, useUnsavedChanges } from '@/components/unsaved-changes-provider';
import { DetailShell } from '@/components/detail-shell';
import { DetailHero, DetailSkeleton, EmptyState, FormField, FormGroup, FormSheet, Info, KpiCell, OptionCards, Pill, Section, WarningBanner, formatDay, type HeroNextStep, type Tone } from '@/components/detail-ui';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';

type Priority = 'low' | 'medium' | 'high';

type Metric = {
  title: string;
  value: string;
};

type VisitDetail = {
  id: number;
  storeName: string;
  visitType?: string;
  clientKind?: 'RETAIL' | 'INSTITUTION' | 'PROJECT' | 'UNKNOWN';
  employeeName: string;
  visit_date: string;
  purpose: string;
  description?: string | null;
  priority: string;
  outcome: string | null;
  brandsInUse: string[];
  brandProCons: {
    id: number;
    brandName: string;
    pros: string[];
    cons: string[];
  }[];
  createdAt: string;
  updatedAt: string;
  storeId: number;
  employeeId: number;
  checkinLatitude?: number;
  checkinLongitude?: number;
  checkinTime?: string;
  checkinDate?: string;  
  checkoutTime?: string;
  checkoutDate?: string; 
  feedback?: string;
  hasGift?: boolean;
  giftName?: string | null;
  giftQuantity?: number | null;
  giftRemarks?: string | null;
  attachmentResponse?: VisitAttachmentResponse[];
};

interface Visit {
  id: number;
  date: string;
  time: string;
  duration: string;
  visitor: string;
  customer: string;
  customerOwner: string;
  address: string;
  phone: string;
  email: string;
  status: string;
  location: {
    lat: number;
    lng: number;
  };
  purpose?: string;
  outcome?: string;
  feedback?: string;
  priority?: string;
  intent?: number;
  monthlySale?: number;
  brandsInUse?: string[];
  brandProCons?: BrandProCon[];
  attachmentResponse?: Array<{ fileName: string; fileDownloadUri: string; fileType: string; tag?: string; size?: number }>;
  intentAuditLogDto?: { oldIntent?: number; newIntent?: number; updatedAt?: string; updatedBy?: string };
  storeId?: number;
  employeeId?: number;
}

interface Brand {
  id: number;
  name: string;
  product: string;
  interestLevel: "High" | "Medium" | "Low";
}

interface Requirement {
  id: number;
  title: string;
  date: string;
  status: "new" | "in-progress" | "completed";
  value: string;
}

interface Complaint {
  id: number;
  date: string;
  title: string;
  status: "open" | "in-progress" | "resolved";
  assignedTo: string;
}

interface PreviousVisit {
  id: number;
  date: string;
  visitor: string;
  purpose: string;
  outcome: string;
  duration: string;
}

interface Note {
  id: number;
  author: string;
  date: string;
  content: string;
  priority: "low" | "medium" | "high";
}

type Employee = {
  id: number;
  firstName: string;
  lastName: string;
};

type Store = {
  id: number;
  storeName: string;
};

type NewTask = {
  id: number;
  taskTitle: string;
  taskDesciption: string;
  taskType: string;
  dueDate: string;
  assignedToId: number;
  assignedToName: string;
  assignedById: number;
  assignedByName: string;
  storeId: number;
  storeName: string;
  storeCity: string;
  visitId: number;
  visitDate: string;
  status: string;
  priority: Priority;
  attachment: Array<{ fileName: string; fileData: string }>;
  attachmentResponse: Array<{ fileName: string; fileDownloadUri: string; fileType: string; tag?: string; size?: number }>;
  createdAt: string;
  updatedAt: string;
  createdTime: string;
  updatedTime: string;
};

interface CheckinImage {
  id: number;
  url: string;
  caption: string;
  timestamp: string;
}

const mockBrands: Brand[] = [
  {
    id: 1,
    name: "Brand A",
    product: "Product X",
    interestLevel: "High"
  },
  {
    id: 2,
    name: "Brand B",
    product: "Product Y",
    interestLevel: "Medium"
  },
  {
    id: 3,
    name: "Brand C",
    product: "Product Z",
    interestLevel: "Low"
  }
];

const mockRequirements: Requirement[] = [
  {
    id: 1,
    title: "Custom integration with existing system",
    date: "2023-06-15",
    status: "in-progress",
    value: "$15,000"
  },
  {
    id: 2,
    title: "Training for 10 employees",
    date: "2023-06-10",
    status: "completed",
    value: "$5,000"
  }
];

const mockComplaints: Complaint[] = [
  {
    id: 1,
    date: "2023-06-12",
    title: "Late delivery of last order",
    status: "resolved",
    assignedTo: "Support Team"
  },
  {
    id: 2,
    date: "2023-06-18",
    title: "Product quality issue",
    status: "in-progress",
    assignedTo: "Quality Team"
  }
];

const mockPreviousVisits: PreviousVisit[] = [
  {
    id: 1,
    date: "2023-06-10",
    visitor: "Bob Johnson",
    purpose: "Follow-up meeting",
    outcome: "Scheduled next visit",
    duration: "45m"
  },
  {
    id: 2,
    date: "2023-06-05",
    visitor: "Charlie Brown",
    purpose: "Initial consultation",
    outcome: "Requirements gathered",
    duration: "1h 15m"
  },
  {
    id: 3,
    date: "2023-05-20",
    visitor: "Alice Smith",
    purpose: "Product Demo",
    outcome: "Positive feedback received",
    duration: "1h 30m"
  }
];

const mockNotes: Note[] = [
  {
    id: 1,
    author: "Alice Smith",
    date: "2023-06-15",
    content: "Customer is interested in our premium package. Wants to see a detailed proposal.",
    priority: "high"
  },
  {
    id: 2,
    author: "Alice Smith",
    date: "2023-06-15",
    content: "Customer mentioned budget constraints. Suggested our mid-tier package as an alternative.",
    priority: "medium"
  }
];

const mockCheckinImages: CheckinImage[] = [
  {
    id: 1,
    url: "/placeholder.svg?height=200&width=200",
    caption: "Store front",
    timestamp: "2023-06-15 10:35 AM"
  },
  {
    id: 2,
    url: "/placeholder.svg?height=200&width=200",
    caption: "Meeting with owner",
    timestamp: "2023-06-15 11:15 AM"
  },
  {
    id: 3,
    url: "/placeholder.svg?height=200&width=200",
    caption: "Product display",
    timestamp: "2023-06-15 11:45 AM"
  }
];

const keyMetrics = {
  totalVisits: 12,
  avgDuration: "1h 15m",
  conversionRate: "65%",
  lastVisit: "2023-06-15"
};

const VISIT_CHECKOUT_ROLES = new Set([
  "ADMIN",
  "OWNER",
  "OFFICE MANAGER",
  "DEVELOPER",
  "FIELD OFFICER",
  "MANAGER",
]);

const VISIT_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://ec2-18-211-58-135.compute-1.amazonaws.com:8081';

interface VisitFileAsset {
  id: number;
  originalFileName: string;
  storedMimeType: string;
}

// Documented: GET /api/hr/files?parentType=VISIT_ACTIVITY&parentId={visitId} (HrController.files),
// download via GET /api/hr/files/{fileAssetId}/download. Replaces legacy /visit/downloadFile/{id}/{tag}/{file}.
const listVisitFiles = async (visitId: number, authToken: string | null): Promise<VisitFileAsset[]> => {
  const url = `${VISIT_API_BASE_URL}/api/hr/files?parentType=VISIT_ACTIVITY&parentId=${visitId}&page=0&size=50`;
  const response = await fetch(url, {
    headers: authToken ? { Authorization: `Bearer ${authToken}`, Accept: 'application/json' } : { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Failed to list visit files (${response.status})`);
  const data = await response.json();
  const items = Array.isArray(data) ? data : Array.isArray((data as Record<string, unknown>).content) ? (data as Record<string, unknown>).content as Record<string, unknown>[] : [];
  return items.flatMap((item) => {
    const id = typeof item.id === 'number' ? item.id : Number(item.id);
    if (!Number.isFinite(id)) return [];
    return [{
      id,
      originalFileName: typeof item.originalFileName === 'string' ? item.originalFileName : '',
      storedMimeType: typeof item.storedMimeType === 'string' ? item.storedMimeType : '',
    }];
  });
};

const downloadFileAsset = async (
  fileAssetId: number,
  signal?: AbortSignal
) => {
  const authToken = localStorage.getItem('authToken');
  const response = await fetch(
    `${VISIT_API_BASE_URL}/api/hr/files/${fileAssetId}/download`,
    {
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
      signal,
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch file ${fileAssetId}`);
  }

  return URL.createObjectURL(await response.blob());
};

const isImageAsset = (asset: VisitFileAsset): boolean => {
  if (asset.storedMimeType.toLowerCase().startsWith('image/')) return true;
  return /\.(jpe?g|png|gif|webp|bmp)$/i.test(asset.originalFileName);
};

const normalizeVisitRole = (value?: string | null) =>
  String(value || "")
    .replace(/^ROLE[\s_]+/i, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

const formatActivityValue = (value?: string | null) => String(value || '')
  .replace(/_/g, ' ')
  .toLowerCase()
  .replace(/^\w/, (character) => character.toUpperCase());

const canRoleCheckoutVisit = (
  userRole?: string | null,
  currentUser?: { authorities?: Array<{ authority?: string | null }> } | null
) => {
  const roles = [
    userRole,
    ...(currentUser?.authorities || []).map((authority) => authority.authority),
  ];

  return roles.some((role) => VISIT_CHECKOUT_ROLES.has(normalizeVisitRole(role)));
};

const getBrowserLocation = () =>
  new Promise<GeolocationPosition>((resolve, reject) => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      reject(new Error("Location access is not available in this browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
  });

export default function VisitDetailPage() {
  const router = useGuardedRouter();
  const params = useParams();
  const visitId = params?.id as string;
  const { token, userRole, userData, currentUser } = useAuth();
  
  const [visitDetail, setVisitDetail] = useState<VisitDetail | null>(null);
  // Employee directory for resolving IDs to names — the visit API returns only
  // assignedEmployeeId (no name), so map via GET /api/common/employees.
  const [employeeDirectory, setEmployeeDirectory] = useState<Map<number, string>>(new Map());

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    teamsApi.getEmployeesPage(token, { active: true, page: 0, size: 500 })
      .then((page) => {
        if (cancelled) return;
        const map = new Map<number, string>();
        for (const e of page.content) {
          const name = `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim();
          if (!map.has(e.id)) map.set(e.id, name || `Employee ${e.id}`);
        }
        setEmployeeDirectory(map);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [token]);

  const resolveEmployeeName = (name?: string | null, employeeId?: number | null): string => {
    if (name && name !== '—') return name;
    if (employeeId != null && employeeDirectory.has(employeeId)) {
      return employeeDirectory.get(employeeId) as string;
    }
    return '';
  };

  // Backend RecordNoteDto uses noteText/createdAt/authorEmployeeId; the timeline below
  // renders legacy content/createdDate/employeeName — normalize once at fetch time.
  const toApiNote = (item: unknown): ApiNote => {
    const row = (item ?? {}) as Record<string, unknown>;
    const authorId = typeof row.authorEmployeeId === 'number' ? row.authorEmployeeId : null;
    const createdAt = typeof row.createdAt === 'string' && row.createdAt.trim()
      ? row.createdAt
      : typeof row.createdDate === 'string'
        ? (row.createdDate as string)
        : '';
    return {
      ...(item as object),
      content: typeof row.noteText === 'string' && row.noteText.trim()
        ? (row.noteText as string)
        : typeof row.content === 'string'
          ? (row.content as string)
          : '',
      createdDate: createdAt,
      employeeName: resolveEmployeeName(
        typeof row.employeeName === 'string' ? (row.employeeName as string) : null,
        authorId ?? (typeof row.employeeId === 'number' ? (row.employeeId as number) : null),
      ),
    } as unknown as ApiNote;
  };

  const notesLinkedToCurrentVisit = (items: unknown[]): unknown[] => items.filter((item) => {
    const row = (item ?? {}) as Record<string, unknown>;
    const nestedVisit = row.visitActivity && typeof row.visitActivity === 'object'
      ? row.visitActivity as Record<string, unknown>
      : null;
    const linkedId = row.visitActivityId ?? nestedVisit?.id;
    // The backend filter is authoritative. When a link id is included in the DTO,
    // additionally reject mismatched rows so a backend/query regression cannot leak notes.
    return linkedId == null || Number(linkedId) === Number(visitId);
  });

  // date-fns format throws RangeError on invalid dates — never crash the timeline.
  const formatNoteDate = (value: unknown): string => {
    if (typeof value !== 'string' || !value.trim()) return '';
    try {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '';
      return format(date, "MMM dd, yyyy");
    } catch {
      return '';
    }
  };
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [brandProCons, setBrandProCons] = useState<BrandProCon[]>([]);
  const [intentAuditLogs, setIntentAuditLogs] = useState<IntentAuditLog[]>([]);
  const [monthlySaleChanges, setMonthlySaleChanges] = useState<MonthlySaleChange[]>([]);
  const [requirements, setRequirements] = useState<Task[]>([]);
  const [complaints, setComplaints] = useState<Task[]>([]);
  const [notes, setNotes] = useState<ApiNote[]>([]);
  const [storeVisits, setStoreVisits] = useState<VisitDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkinImages, setCheckinImages] = useState<string[]>([]);
  const [giftImage, setGiftImage] = useState<string | null>(null);
  const [isGiftImageLoading, setIsGiftImageLoading] = useState(false);
  const [giftImageError, setGiftImageError] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [taskLoading, setTaskLoading] = useState({ requirement: true, complaint: true });
  const [taskErrors, setTaskErrors] = useState<{ requirement: string | null; complaint: string | null }>({ requirement: null, complaint: null });
  const [isRequirementModalOpen, setIsRequirementModalOpen] = useState(false);
  const [isComplaintModalOpen, setIsComplaintModalOpen] = useState(false);
  // Single right-side panel replaces the two centered two-step modals (one-page flow)
  const [taskPanel, setTaskPanel] = useState<'requirement' | 'complaint' | null>(null);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [taskCreateError, setTaskCreateError] = useState<string | null>(null);
  const [activeRequirementTab, setActiveRequirementTab] = useState('general');
  const [activeComplaintTab, setActiveComplaintTab] = useState('general');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [newTask, setNewTask] = useState<NewTask>({
    id: 0,
    taskTitle: '',
    taskDesciption: '',
    dueDate: '',
    assignedToId: 0,
    assignedToName: '',
    assignedById: 0,
    assignedByName: '',
    storeId: 0,
    storeName: '',
    storeCity: '',
    visitId: Number(visitId),
    visitDate: '',
    status: 'Assigned',
    priority: 'low',
    taskType: 'requirement',
    attachment: [],
    attachmentResponse: [],
    createdAt: '',
    updatedAt: '',
    createdTime: '',
    updatedTime: '',
  });
  const [complaintTask, setComplaintTask] = useState<NewTask>({
    id: 0,
    taskTitle: '',
    taskDesciption: '',
    dueDate: '',
    assignedToId: 0,
    assignedToName: '',
    assignedById: 0,
    assignedByName: '',
    storeId: 0,
    storeName: '',
    storeCity: '',
    visitId: Number(visitId),
    visitDate: '',
    status: 'Assigned',
    priority: 'low',
    taskType: 'complaint',
    attachment: [],
    attachmentResponse: [],
    createdAt: '',
    updatedAt: '',
    createdTime: '',
    updatedTime: '',
  });
  const [storeDetails, setStoreDetails] = useState<{
    contactNumber: string;
    city: string;
    address: string;
  } | null>(null);
  const loggedInEmployeeId = useMemo(() => {
    if (userData?.employeeId) {
      return userData.employeeId;
    }
    if (typeof window !== "undefined") {
      const stored = Number(localStorage.getItem("employeeId"));
      if (!Number.isNaN(stored) && stored > 0) {
        return stored;
      }
    }
    return 0;
  }, [userData?.employeeId]);
  
  // Role-based state
  const [isManager, setIsManager] = useState(false);
  
  // Notes functionality
  const [isNoteModalVisible, setIsNoteModalVisible] = useState(false);
  const [isNoteEditMode, setIsNoteEditMode] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingNoteDetails, setEditingNoteDetails] = useState<{ employeeId: number; storeId: number } | null>(null);
  const [isNoteSaving, setIsNoteSaving] = useState(false);
  const [notePendingDelete, setNotePendingDelete] = useState<ApiNote | null>(null);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [checkoutOutcome, setCheckoutOutcome] = useState("");
  const [checkoutFeedback, setCheckoutFeedback] = useState("");
  const [checkoutNextAction, setCheckoutNextAction] = useState("");
  const [checkoutNextActionDate, setCheckoutNextActionDate] = useState("");
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);
  
  // Brand functionality
  const [isAddBrandModalVisible, setIsAddBrandModalVisible] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [newPros, setNewPros] = useState<string[]>([]);
  const [newCons, setNewCons] = useState<string[]>([]);
  const [currentPro, setCurrentPro] = useState('');
  const [currentCon, setCurrentCon] = useState('');

  const originalNoteContent = isNoteEditMode && editingNoteId !== null
    ? notes.find((note) => note.id === editingNoteId)?.content ?? ''
    : '';
  const noteDraftIsDirty = isNoteModalVisible && noteContent !== originalNoteContent;
  const checkoutDraftIsDirty = isCheckoutModalOpen && Boolean(visitDetail) && (
    checkoutOutcome !== (visitDetail?.outcome || 'Interested') ||
    checkoutFeedback !== (visitDetail?.feedback || '')
  );
  const brandDraftIsDirty = isAddBrandModalVisible && (
    Boolean(newBrandName.trim()) ||
    newPros.length > 0 ||
    newCons.length > 0 ||
    Boolean(currentPro.trim()) ||
    Boolean(currentCon.trim())
  );
  const requirementDraftIsDirty = taskPanel === 'requirement' && (
    Boolean(newTask.taskTitle.trim()) ||
    Boolean(newTask.taskDesciption.trim()) ||
    Boolean(newTask.dueDate) ||
    newTask.priority !== 'low'
  );
  const complaintDraftIsDirty = taskPanel === 'complaint' && (
    Boolean(complaintTask.taskTitle.trim()) ||
    Boolean(complaintTask.taskDesciption.trim()) ||
    Boolean(complaintTask.dueDate) ||
    complaintTask.priority !== 'low'
  );
  const { requestDiscard } = useUnsavedChanges(
    noteDraftIsDirty ||
    checkoutDraftIsDirty ||
    brandDraftIsDirty ||
    requirementDraftIsDirty ||
    complaintDraftIsDirty
  );

  const closeNoteModal = () => {
    setIsNoteModalVisible(false);
    setNoteContent('');
    setIsNoteEditMode(false);
    setEditingNoteId(null);
    setEditingNoteDetails(null);
  };
  const requestCloseNoteModal = () => {
    requestDiscard(closeNoteModal, noteDraftIsDirty);
  };
  const closeCheckoutModal = () => {
    setIsCheckoutModalOpen(false);
    setCheckoutError(null);
    setCheckoutOutcome(visitDetail?.outcome || 'Interested');
    setCheckoutFeedback(visitDetail?.feedback || '');
    setCheckoutNextAction((visitDetail as unknown as { nextActionText?: string })?.nextActionText || '');
    setCheckoutNextActionDate((visitDetail as unknown as { nextActionDate?: string })?.nextActionDate || '');
  };
  const requestCloseCheckoutModal = () => {
    requestDiscard(closeCheckoutModal, checkoutDraftIsDirty);
  };
  const closeRequirementModal = () => {
    setIsRequirementModalOpen(false);
    setTaskPanel(null);
    setTaskCreateError(null);
    setActiveRequirementTab('general');
    setNewTask((current) => ({
      ...current,
      taskTitle: '',
      taskDesciption: '',
      dueDate: '',
      priority: 'low',
    }));
  };
  const requestCloseRequirementModal = () => {
    requestDiscard(closeRequirementModal, requirementDraftIsDirty);
  };
  const closeComplaintModal = () => {
    setIsComplaintModalOpen(false);
    setTaskPanel(null);
    setTaskCreateError(null);
    setActiveComplaintTab('general');
    setComplaintTask((current) => ({
      ...current,
      taskTitle: '',
      taskDesciption: '',
      dueDate: '',
      priority: 'low',
    }));
  };
  const requestCloseComplaintModal = () => {
    requestDiscard(closeComplaintModal, complaintDraftIsDirty);
  };

  const giftAttachment = useMemo(
    () => visitDetail?.attachmentResponse?.find(
      (attachment) => String(attachment.tag || '').trim().toLowerCase() === 'gift'
    ),
    [visitDetail]
  );
  const hasSavedGift = Boolean(
    visitDetail?.hasGift ||
    visitDetail?.giftName?.trim() ||
    visitDetail?.giftQuantity != null ||
    visitDetail?.giftRemarks?.trim() ||
    giftAttachment
  );

  // Helper functions
  const getOutcomeStatus = (visit: VisitDetail | null): { emoji: React.ReactNode; status: string; color: string; isOngoing: boolean } => {
    if (visit?.checkinTime && visit?.checkoutTime) {
      return { emoji: '✅', status: 'Completed', color: 'bg-purple-100 text-purple-800', isOngoing: false };
    } else if (visit?.checkoutTime) {
      return { emoji: '⏱️', status: 'Checked Out', color: 'bg-orange-100 text-orange-800', isOngoing: false };
    } else if (visit?.checkinTime) {
      return { emoji: '🕰️', status: 'On Going', color: 'bg-green-100 text-green-800', isOngoing: true };
    }
    return { emoji: '📅', status: 'Assigned', color: 'bg-muted text-muted-foreground', isOngoing: false };
  };


  // Determine user role
  useEffect(() => {
    const checkUserRole = () => {
      // Check both userRole and currentUser authorities
      const isManagerRole = hasManagerPrivileges(userRole, currentUser);

      setIsManager(isManagerRole);
    };
    checkUserRole();
  }, [userRole, currentUser]);


  const getPriorityBadge = (priority: Priority) => {
    const priorityColors: { [key in Priority]: string } = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-red-100 text-red-800',
    };
    const colorClass = priorityColors[priority] || 'bg-gray-100 text-gray-800';

    return (
      <span className={`status-badge ${colorClass}`}>
        {priority}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const statusColors = {
      Assigned: 'bg-muted text-muted-foreground',
      'Work in Progress': 'bg-orange-100 text-orange-800',
      Complete: 'bg-green-100 text-green-800',
    } as const;

    type StatusColor = keyof typeof statusColors;

    const colorClass = (status in statusColors)
      ? statusColors[status as StatusColor]
      : 'bg-gray-100 text-gray-800';

    return (
      <span className={`status-badge ${colorClass}`}>
        {status}
      </span>
    );
  };

  // Documented: list VISIT_ACTIVITY files, download image assets. FileAssetDto has no
  // tag field, so gift vs check-in is partitioned by filename (/gift/i); rest are check-in.
  const fetchVisitImages = async (visitId: number) => {
    const authToken = localStorage.getItem('authToken');
    try {
      const assets = await listVisitFiles(visitId, authToken);
      const images = assets.filter(isImageAsset);
      const giftAssets = images.filter((a) => /gift/i.test(a.originalFileName));
      const checkinAssets = images.filter((a) => !/gift/i.test(a.originalFileName));

      const downloaded = await Promise.all(
        checkinAssets.map(async (asset) => {
          try {
            return await downloadFileAsset(asset.id);
          } catch (error) {
            console.error('Error fetching individual image:', error);
            return null;
          }
        })
      );
      setCheckinImages(downloaded.filter((url): url is string => url !== null));

      if (giftAssets.length > 0) {
        try {
          const url = await downloadFileAsset(giftAssets[0].id);
          setGiftImage(url);
          setGiftImageError(false);
        } catch (error) {
          console.error('Error fetching gift image:', error);
          setGiftImage(null);
          setGiftImageError(true);
        } finally {
          setIsGiftImageLoading(false);
        }
      } else {
        setGiftImage(null);
        setGiftImageError(false);
        setIsGiftImageLoading(false);
      }
    } catch (error) {
      console.error('Error fetching visit images:', error);
      setCheckinImages([]);
      setGiftImage(null);
      setGiftImageError(false);
      setIsGiftImageLoading(false);
    }
  };

  const fetchVisitDetail = useCallback(async (visitId: string) => {
    if (!token) {
      setError('Your session is unavailable. Please sign in again.');
      setIsLoading(false);
      return;
    }
    const cancelled = false;
    try {
      setIsLoading(true);
      setError(null);
      const { visitsApi, resolveVisitClient } = await import('@/lib/visits-api');
      const visitData = await visitsApi.getVisitById(token, Number(visitId));
      if (cancelled) return;
      const api = new API();
      const legacy = visitData as unknown as VisitDto & Record<string, unknown>;
      const client = resolveVisitClient(visitData);
      setVisitDetail({
        id: visitData.id,
        storeName: client.name,
        visitType: visitData.visitType,
        clientKind: client.kind,
        employeeName: visitData.assignedEmployeeName || (legacy.employeeName as string) || '',
        visit_date: visitData.scheduledVisitDate || (legacy.visit_date as string) || '',
        purpose: visitData.purpose || '',
        description: (visitData as Record<string, unknown>).description as string ?? null,
        priority: (legacy.priority as string) || 'low',
        outcome: visitData.outcome ?? null,
        feedback: (legacy.feedback as string) || visitData.discussionSummary || '',
        brandsInUse: [],
        brandProCons: [],
        createdAt: (legacy.createdAt as string) || '',
        updatedAt: (legacy.updatedAt as string) || visitData.actualCheckinAt || '',
        storeId: visitData.clientAccountId || (legacy.storeId as number) || 0,
        employeeId: visitData.assignedEmployeeId || (legacy.employeeId as number) || 0,
        checkinLatitude: (legacy.checkinLatitude as number) || undefined,
        checkinLongitude: (legacy.checkinLongitude as number) || undefined,
        checkinTime: visitData.actualCheckinAt ? new Date(visitData.actualCheckinAt).toISOString().split('T')[1]?.slice(0, 5) : (legacy.checkinTime as string) || undefined,
        checkinDate: visitData.actualCheckinAt ? visitData.actualCheckinAt.split('T')[0] : (legacy.checkinDate as string) || undefined,
        checkoutTime: visitData.actualCheckoutAt ? new Date(visitData.actualCheckoutAt).toISOString().split('T')[1]?.slice(0, 5) : (legacy.checkoutTime as string) || undefined,
        checkoutDate: visitData.actualCheckoutAt ? visitData.actualCheckoutAt.split('T')[0] : (legacy.checkoutDate as string) || undefined,
        hasGift: (legacy.hasGift as boolean) || false,
        giftName: (legacy.giftName as string) || null,
        giftQuantity: (legacy.giftQuantity as number) || null,
        giftRemarks: (legacy.giftRemarks as string) || null,
        attachmentResponse: (legacy.attachmentResponse as VisitAttachmentResponse[]) || [],
        // keep raw for downstream mapping
        ...(visitData as unknown as object),
      } as VisitDetail);

      const actualCheckinAt = (visitData as unknown as Record<string, unknown>).actualCheckinAt as string | undefined || (visitData as unknown as Record<string, unknown>).checkinDate as string | undefined;
      const actualCheckoutAt = (visitData as unknown as Record<string, unknown>).actualCheckoutAt as string | undefined || (visitData as unknown as Record<string, unknown>).checkoutDate as string | undefined;
      if (actualCheckinAt) {
        const cDate = actualCheckinAt.split('T')[0] || '';
        const cTime = actualCheckinAt.includes('T') ? actualCheckinAt.split('T')[1]?.slice(0, 5) || '' : '';
        const oDate = actualCheckoutAt ? actualCheckoutAt.split('T')[0] || '' : '';
        const oTime = actualCheckoutAt && actualCheckoutAt.includes('T') ? actualCheckoutAt.split('T')[1]?.slice(0, 5) || '' : '';
        calculateVisitDuration(cDate, cTime, oDate, oTime);
      }

      setIsLoading(false);

      // Tasks — GET /api/tasks?employeeId=&status=OPEN (TaskController.tasksForEmployee),
      // filtered client-side by visitActivityId + taskType (TaskDto has no visitId field)
      for (const type of ['requirement', 'complaint'] as const) {
        setTaskLoading(current => ({ ...current, [type]: true }));
        setTaskErrors(current => ({ ...current, [type]: null }));
        const taskTypeUpper = type === 'requirement' ? 'REQUIREMENT' : 'COMPLAINT';
        const fetchTasks = async () => {
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://ec2-18-211-58-135.compute-1.amazonaws.com:8081'}/api/tasks?employeeId=${visitData.assignedEmployeeId || 0}&status=OPEN&page=0&size=50`, {
            headers: token ? { Authorization: `Bearer ${token}`, Accept: 'application/json' } : { Accept: 'application/json' },
          });
          if (!res.ok) {
            const text = await res.text();
            throw new Error(text || `Tasks failed (${res.status})`);
          }
          const data = await res.json();
          const content = Array.isArray(data) ? data : Array.isArray((data as Record<string, unknown>).content) ? (data as Record<string, unknown>).content as Task[] : [];
          const filtered = content.filter((t: Task) => {
            const matchesVisit = (t as unknown as { visitId?: number }).visitId === Number(visitId) || (t as unknown as { visitActivityId?: number }).visitActivityId === Number(visitId);
            const typeVal = String((t as unknown as { taskType?: string; type?: string }).taskType || (t as unknown as { type?: string }).type || '');
            const matchesType = typeVal.toUpperCase() === taskTypeUpper;
            return matchesVisit && matchesType;
          });
          return filtered as Task[];
        };
        void fetchTasks()
          .then(tasks => { if (!cancelled) (type === 'requirement' ? setRequirements(tasks) : setComplaints(tasks)); })
          .catch((err) => {
            if (cancelled) return;
            const msg = err instanceof Error ? err.message : `Unable to load ${type}s.`;
            setTaskErrors(current => ({ ...current, [type]: msg }));
          })
          .finally(() => { if (!cancelled) setTaskLoading(current => ({ ...current, [type]: false })); });
      }
      (async () => {
        try {
          const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://ec2-18-211-58-135.compute-1.amazonaws.com:8081';
          const authHeaders: Record<string, string> = token
            ? { Authorization: `Bearer ${token}`, Accept: 'application/json' }
            : { Accept: 'application/json' };
          const notesPromise = (async () => {
            const tok2 = token;
            // visitActivityId is the documented relationship filter. parentId is not
            // a supported notes query parameter and can return unrelated notes.
            const url = `${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://ec2-18-211-58-135.compute-1.amazonaws.com:8081'}/api/common/notes?parentType=VISIT_ACTIVITY&visitActivityId=${visitId}&page=0&size=50`;
            try {
              const r = await fetch(url, { headers: tok2 ? { Authorization: `Bearer ${tok2}`, Accept: 'application/json' } : { Accept: 'application/json' } });
              if (r.ok) {
                const d = await r.json();
                const raw: unknown[] = Array.isArray(d) ? d : Array.isArray((d as Record<string, unknown>).content) ? (d as Record<string, unknown>).content as unknown[] : [];
                return notesLinkedToCurrentVisit(raw).map(toApiNote);
              }
            } catch {}
            return [] as ApiNote[];
          })();
          // Documented per-parent visit history — replaces legacy /visit/getByStore.
          // Endpoint is chosen by visitType (CommonDataController retail/institution/project visits).
          const parentVisitsPromise = (async (): Promise<VisitDto[]> => {
            try {
              const detail = visitData as unknown as Record<string, unknown>;
              let path: string | null = null;
              if (visitData.visitType === 'DEALER_VISIT' && visitData.clientAccountId) {
                path = `/api/common/retail-clients/${visitData.clientAccountId}/visits`;
              } else if (visitData.visitType === 'INSTITUTIONAL_VISIT' && visitData.institutionId) {
                path = `/api/common/institutions/${visitData.institutionId}/visits`;
              } else if (visitData.visitType === 'PROJECT_SITE_VISIT' && visitData.projectId) {
                path = `/api/common/projects/${visitData.projectId}/visits`;
              }
              if (!path) return [];
              const res = await fetch(`${baseUrl}${path}?page=0&size=50`, { headers: authHeaders });
              if (!res.ok) return [];
              const body = await res.json();
              const items: unknown[] = Array.isArray(body)
                ? body
                : Array.isArray((body as Record<string, unknown>).content)
                  ? (body as Record<string, unknown>).content as unknown[]
                  : [];
              const textOf = (v: unknown): string => (typeof v === 'string' ? v : '');
              const splitDate = (iso: string): string => (iso.includes('T') ? iso.split('T')[0] : iso);
              const splitTime = (iso: string): string => (iso.includes('T') ? iso.split('T')[1]?.slice(0, 5) ?? '' : iso);
              return items.flatMap((entry) => {
                const row = (entry ?? {}) as Record<string, unknown>;
                if (typeof row.id !== 'number' && typeof row.id !== 'string') return [];
                const checkin = textOf(row.actualCheckinAt);
                const checkout = textOf(row.actualCheckoutAt);
                const clientName = textOf(row.retailAccountName) || textOf(row.institutionName)
                  || textOf(row.projectName) || textOf(row.parentName) || textOf(row.storeName);
                return [{
                  ...(entry as object),
                  id: Number(row.id),
                  storeId: Number(row.clientAccountId ?? detail.clientAccountId ?? 0),
                  storeName: clientName,
                  employeeId: Number(row.assignedEmployeeId ?? 0),
                  employeeName: textOf(row.assignedEmployeeName),
                  visit_date: textOf(row.scheduledVisitDate),
                  purpose: textOf(row.purpose),
                  outcome: (row.outcome as string) ?? null,
                  checkinDate: checkin ? splitDate(checkin) : '',
                  checkinTime: checkin ? splitTime(checkin) : '',
                  checkoutDate: checkout ? splitDate(checkout) : '',
                  checkoutTime: checkout ? splitTime(checkout) : '',
                } as unknown as VisitDto];
              });
            } catch {
              return [];
            }
          })();
          // Store facts — documented GET /api/retail/accounts/{id} (+ contacts for phone).
          // Replaces inferring contact/city/address from a legacy visit row.
          const storeFactsPromise = (async (): Promise<{ contactNumber: string; city: string; address: string } | null> => {
            try {
              if (visitData.visitType === 'DEALER_VISIT' && visitData.clientAccountId) {
                const accountId = visitData.clientAccountId;
                const accountRes = await fetch(`${baseUrl}/api/retail/accounts/${accountId}`, { headers: authHeaders });
                if (!accountRes.ok) return null;
                const account = await accountRes.json() as Record<string, unknown>;
                const textOf = (v: unknown): string => (typeof v === 'string' && v.trim() ? v : '');
                const city = textOf(account.addressCity) || 'Not available';
                const address = [account.addressVillageArea, account.addressTaluka, account.addressDistrict, account.addressState]
                  .map((part) => textOf(part)).filter(Boolean).join(', ') || 'Not available';
                let contactNumber = 'Not available';
                try {
                  const contactsRes = await fetch(`${baseUrl}/api/retail/accounts/${accountId}/contacts?page=0&size=50`, { headers: authHeaders });
                  if (contactsRes.ok) {
                    const contactsBody = await contactsRes.json();
                    const contacts: Record<string, unknown>[] = Array.isArray(contactsBody)
                      ? contactsBody
                      : Array.isArray((contactsBody as Record<string, unknown>).content)
                        ? (contactsBody as Record<string, unknown>).content as Record<string, unknown>[]
                        : [];
                    const primary = contacts.find((c) => c.primaryContact === true) ?? contacts[0];
                    const masterId = primary != null ? Number(primary.contactInfluenceRegisterId) : NaN;
                    if (Number.isFinite(masterId)) {
                      const mastersRes = await fetch(`${baseUrl}/api/common/contacts?page=0&size=200`, { headers: authHeaders });
                      if (mastersRes.ok) {
                        const mastersBody = await mastersRes.json();
                        const masters: Record<string, unknown>[] = Array.isArray(mastersBody)
                          ? mastersBody
                          : Array.isArray((mastersBody as Record<string, unknown>).content)
                            ? (mastersBody as Record<string, unknown>).content as Record<string, unknown>[]
                            : [];
                        const master = masters.find((m) => Number(m.id) === masterId);
                        const mobile = master != null ? String(master.mobile ?? '').trim() : '';
                        if (mobile) contactNumber = mobile;
                      }
                    }
                  }
                } catch {}
                return { contactNumber, city, address };
              }
              const detail = visitData as unknown as Record<string, unknown>;
              const textOf = (v: unknown): string => (typeof v === 'string' && v.trim() ? v : '');
              return {
                contactNumber: 'Not available',
                city: textOf(detail.locationCity) || 'Not available',
                address: textOf(detail.locationText) || 'Not available',
              };
            } catch {
              return null;
            }
          })();
          const [
            notesData,
            storeVisitsData,
            storeFacts,
          ] = await Promise.all([
            notesPromise,
            parentVisitsPromise,
            storeFactsPromise,
          ]);

          setBrandProCons([]);
          setNotes(notesData || []);
          const sortedStoreVisits = (storeVisitsData || []).slice().sort((a: VisitDto, b: VisitDto) => {
            const da = new Date(a.visit_date as string).getTime();
            const db = new Date(b.visit_date as string).getTime();
            return db - da;
          });
          setStoreVisits(sortedStoreVisits);

          setIsGiftImageLoading(true);
          void fetchVisitImages(Number(visitId));

          if (storeFacts) {
            setStoreDetails(storeFacts);
          }
        } catch {}
      })();
    } catch (err) {
      setError((err as Error)?.message || 'Failed to load visit details');
      setIsLoading(false);
    }
  }, [token]);

  const calculateVisitDuration = (checkinDate: string, checkinTime: string, checkoutDate: string, checkoutTime: string) => {
    if (!checkinDate || !checkinTime || !checkoutDate || !checkoutTime) {
      setMetrics(prev => prev.filter(metric => metric.title !== 'Visit Duration'));
      return;
    }
    
    try {
      // Parse check-in datetime
      const checkinDateTimeStr = `${checkinDate}T${checkinTime}`;
      const checkinDateTime = new Date(checkinDateTimeStr);
      
      // Parse check-out datetime
      const checkoutDateTimeStr = `${checkoutDate}T${checkoutTime}`;
      const checkoutDateTime = new Date(checkoutDateTimeStr);
      
      // Calculate difference in milliseconds
      const diffMs = checkoutDateTime.getTime() - checkinDateTime.getTime();
      
      if (diffMs < 0) {
        setMetrics(prev => prev.filter(metric => metric.title !== 'Visit Duration'));
        return;
      }
      
      // Convert to hours, minutes, and seconds
      const totalSeconds = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      
      // Format duration in compact format (e.g., "1h 30m" or "3m")
      let visitDuration = '';
      if (hours > 0) {
        visitDuration = `${hours}h`;
        if (minutes > 0) {
          visitDuration += ` ${minutes}m`;
        }
      } else if (minutes > 0) {
        visitDuration = `${minutes}m`;
        if (seconds > 0 && minutes < 5) {
          // Only show seconds if less than 5 minutes for precision
          visitDuration += ` ${seconds}s`;
        }
      } else if (seconds > 0) {
        visitDuration = `${seconds}s`;
      } else {
        visitDuration = '0s';
      }

      setMetrics((prevMetrics) => {
        const updatedMetrics = prevMetrics.filter(metric => metric.title !== 'Visit Duration');
        return [
          ...updatedMetrics,
          { title: 'Visit Duration', value: visitDuration },
        ];
      });
    } catch (error) {
      console.error('Error calculating visit duration:', error);
      setMetrics(prev => prev.filter(metric => metric.title !== 'Visit Duration'));
    }
  };

  const fetchIntentLevel = async (visitId: string) => {
    try {
      const api = new API();
      const data = await api.getIntentAuditByVisit(Number(visitId));
      const recentIntent = data[data.length - 1]?.newIntentLevel || 'N/A';
      setMetrics((prevMetrics) => {
        const updatedMetrics = prevMetrics.filter(metric => metric.title !== 'Intent Level');
        return [
          ...updatedMetrics,
          { title: 'Intent Level', value: recentIntent.toString() },
        ];
      });
    } catch (error) {
      console.error('Error fetching intent level:', error);
    }
  };

  const fetchMonthlySales = async (visitId: string) => {
    try {
      const api = new API();
      const data = await api.getMonthlySaleByVisit(Number(visitId));
      const recentSales = data.length > 0 ? `${data[0].newMonthlySale.toLocaleString()} tons` : 'N/A';
      setMetrics((prevMetrics) => {
        const updatedMetrics = prevMetrics.filter(metric => metric.title !== 'Monthly Sales');
        return [
          ...updatedMetrics,
          { title: 'Monthly Sales', value: recentSales.toString() },
        ];
      });
    } catch (error) {
      console.error('Error fetching monthly sales:', error);
    }
  };

  useEffect(() => {
    if (visitId) {
      fetchVisitDetail(visitId);
    }
  }, [visitId, fetchVisitDetail]);

  // Photos are loaded via fetchVisitImages (GET /api/hr/files) inside fetchVisitDetail.
  // This effect only revokes blob URLs when the visit changes or the page unmounts.
  useEffect(() => {
    return () => {
      setCheckinImages((urls) => {
        urls.forEach((url) => URL.revokeObjectURL(url));
        return [];
      });
      setGiftImage((url) => {
        if (url) URL.revokeObjectURL(url);
        return null;
      });
    };
  }, [visitId]);

  // Handler functions
  const handleBack = () => {
    router.back();
  };

  const handleViewStore = () => {
    if (visitDetail && visitDetail.storeId) {
      router.push(`/dashboard/customers/${visitDetail.storeId}`);
    }
  };

  const hasCheckoutPermission = canRoleCheckoutVisit(userRole, currentUser);
  const canCheckoutVisit = Boolean(
    visitDetail?.checkinTime &&
      !visitDetail?.checkoutTime &&
      hasCheckoutPermission
  );

  const openCheckoutModal = () => {
    if (!visitDetail) return;

    setCheckoutOutcome(visitDetail.outcome || "Interested");
    setCheckoutFeedback(visitDetail.feedback || "");
    setCheckoutNextAction((visitDetail as unknown as { nextActionText?: string })?.nextActionText || '');
    setCheckoutNextActionDate((visitDetail as unknown as { nextActionDate?: string })?.nextActionDate || '');
    setCheckoutError(null);
    setCheckoutMessage(null);
    setIsCheckoutModalOpen(true);
  };

  const handleCheckoutVisit = async () => {
    if (!visitDetail || isCheckingOut) return;

    if (!hasCheckoutPermission) {
      setCheckoutError("You do not have permission to check out this visit.");
      return;
    }

    if (!visitDetail.checkinTime) {
      setCheckoutError("Visit must be checked in before checkout.");
      return;
    }

    if (visitDetail.checkoutTime) {
      setCheckoutError("This visit is already checked out.");
      return;
    }

    if (!checkoutOutcome.trim()) {
      setCheckoutError("Enter checkout outcome.");
      return;
    }

    if (!token) {
      setCheckoutError("Your session is unavailable. Please sign in again.");
      return;
    }

    try {
      setIsCheckingOut(true);
      setCheckoutError(null);
      setCheckoutMessage(null);

      const position = await getBrowserLocation();
      const { visitsApi } = await import('@/lib/visits-api');
      await visitsApi.checkOut(token, visitDetail.id, {
        checkOutLatitude: position.coords.latitude,
        checkOutLongitude: position.coords.longitude,
        outcome: checkoutOutcome.trim() as import('@/lib/visits-api').VisitOutcome,
        discussionSummary: checkoutFeedback.trim() || null,
        nextActionText: checkoutNextAction.trim() || null,
        nextActionDate: checkoutNextActionDate || null,
        expenseAmount: null,
      });

      setCheckoutMessage("Checked out successfully.");
      setIsCheckoutModalOpen(false);
      await fetchVisitDetail(String(visitDetail.id));
    } catch (error) {
      const message = error instanceof Error && error.message
        ? error.message
        : "Failed to check out this visit.";
      setCheckoutError(message);
    } finally {
      setIsCheckingOut(false);
    }
  };


  const handlePriorityChange = (value: string) => {
    setPriorityFilter(value);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const filteredVisits = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return storeVisits;
    return storeVisits.filter((visit) =>
      String(visit.purpose || "")
        .toLowerCase()
        .includes(query)
    );
  }, [storeVisits, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredVisits.length / pageSize));
  const indexOfLastVisit = currentPage * pageSize;
  const indexOfFirstVisit = indexOfLastVisit - pageSize;
  const currentVisits = filteredVisits.slice(indexOfFirstVisit, indexOfLastVisit);

  // Reset to first page when page size changes
  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize, searchQuery]);

  const visitStatus = getOutcomeStatus(visitDetail);

  const infoItems = [
    {
      icon: Calendar,
      label: "Date & Time",
      value: visitDetail ? `${format(new Date(visitDetail.visit_date), "MMM dd, yyyy")} at ${visitDetail.checkinTime || "N/A"}` : "N/A",
    },
    { icon: Clock, label: "Duration", value: metrics.find(m => m.title === 'Visit Duration')?.value || "N/A" },
    { icon: User, label: "Visited by", value: (visitDetail ? resolveEmployeeName(visitDetail.employeeName, visitDetail.employeeId) : '') || "N/A" },
    { icon: Phone, label: "Phone", value: storeDetails?.contactNumber || "N/A" },
    { icon: Mail, label: "Email", value: "N/A" },
    { icon: MapPin, label: "Address", value: storeDetails?.address || "N/A" },
  ];


  const handleOpenLocation = () => {
    if (visitDetail?.checkinLatitude && visitDetail?.checkinLongitude) {
      window.open(`https://www.google.com/maps?q=${visitDetail.checkinLatitude},${visitDetail.checkinLongitude}`, "_blank");
    }
  };

  const calculateDuration = (startTime: string, endTime: string): string => {
    try {
      const start = new Date(`2000-01-01T${startTime}`);
      const end = new Date(`2000-01-01T${endTime}`);
      const diffMs = end.getTime() - start.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      
      // Only show hours if > 0, otherwise just show minutes
      if (hours > 0) {
        return `${hours}h ${mins}m`;
      } else {
        return `${mins}m`;
      }
    } catch {
      return "N/A";
    }
  };

  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "N/A";
      return format(date, "MMM dd, yyyy");
    } catch {
      return "N/A";
    }
  };

  const handleImageClick = (image: string) => {
    setPreviewImage(image);
    setPreviewVisible(true);
  };

  // Notes — documented: GET /api/common/notes + parent list endpoints (guide 5.4)
  // For visit detail, use generic notes with parentType VISIT_ACTIVITY where applicable; avoid legacy /notes/getByVisit
  const refreshNotes = useCallback(async () => {
    if (!visitId) return;
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://ec2-18-211-58-135.compute-1.amazonaws.com:8081';
    const authToken = token || (typeof window !== 'undefined' ? localStorage.getItem('authToken') : null);
    // The notes API filters this relationship by visitActivityId (not parentId).
    const url = `${baseUrl}/api/common/notes?parentType=VISIT_ACTIVITY&visitActivityId=${visitId}&page=0&size=50`;
    try {
      const res = await fetch(url, { headers: authToken ? { Authorization: `Bearer ${authToken}`, Accept: 'application/json' } : { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`Notes fetch failed (${res.status})`);
      const data = await res.json();
      const raw = Array.isArray(data) ? data : Array.isArray((data as Record<string, unknown>).content) ? (data as Record<string, unknown>).content as unknown[] : [];
      setNotes(notesLinkedToCurrentVisit(raw).map(toApiNote));
    } catch (error) {
      console.error('Error refreshing notes:', error);
      setNotes([]);
    }
  }, [visitId, token]);

  const addNote = () => {
    setIsNoteEditMode(false);
    setNoteContent('');
    setIsNoteModalVisible(true);
  };

  const editNote = (note: ApiNote) => {
    setNoteContent(note.content);
    setIsNoteEditMode(true);
    setEditingNoteId(note.id);
    setEditingNoteDetails({ employeeId: note.employeeId, storeId: note.storeId });
    setIsNoteModalVisible(true);
  };

  const saveNote = async () => {
    if (!noteContent.trim() || !visitDetail || isNoteSaving) return;

    try {
      setIsNoteSaving(true);
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://ec2-18-211-58-135.compute-1.amazonaws.com:8081';
      const authToken = token || (typeof window !== 'undefined' ? localStorage.getItem('authToken') : null);
      if (isNoteEditMode && editingNoteId !== null) {
        // Documented: PUT /api/common/notes/{noteId}
        const res = await fetch(`${baseUrl}/api/common/notes/${editingNoteId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          },
          body: JSON.stringify({
            noteText: noteContent.trim(),
            parentType: 'VISIT_ACTIVITY',
            visitActivityId: Number(visitId),
          }),
        });
        if (!res.ok) throw new Error(`Failed to update note (${res.status})`);
        await refreshNotes();
      } else {
        // Documented: POST /api/common/notes
        const res = await fetch(`${baseUrl}/api/common/notes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          },
          body: JSON.stringify({
            noteText: noteContent.trim(),
            parentType: 'VISIT_ACTIVITY',
            visitActivityId: Number(visitId),
          }),
        });
        if (!res.ok) throw new Error(`Failed to create note (${res.status})`);
        await refreshNotes();
      }
      
      setIsNoteModalVisible(false);
      setNoteContent('');
      setIsNoteEditMode(false);
      setEditingNoteId(null);
    } catch (error) {
      console.error('Error saving note:', error);
    } finally {
      setIsNoteSaving(false);
    }
  };

  const deleteNote = async (id: number) => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://ec2-18-211-58-135.compute-1.amazonaws.com:8081';
      const authToken = token || (typeof window !== 'undefined' ? localStorage.getItem('authToken') : null);
      const res = await fetch(`${baseUrl}/api/common/notes/${id}`, {
        method: 'DELETE',
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
      });
      if (!res.ok) throw new Error(`Failed to delete note (${res.status})`);
      await refreshNotes();
    } catch (error) {
      console.error('Error deleting note:', error);
    } finally {
      setNotePendingDelete(null);
    }
  };

  // Brands functionality
  const handleAddBrandProCon = async (brandName: string, pros: string[], cons: string[]) => {
    try {
      const api = new API();
      await api.addBrandProCons(Number(visitId), [{
        brandName,
        pros,
        cons,
      }]);
      
      // Refresh brand data
      const updatedBrands = await api.getVisitProCons(Number(visitId));
      setBrandProCons(updatedBrands);
    } catch (error) {
      console.error('Error adding brand Pro/Con:', error);
    }
  };

  const handleDeleteBrandProCon = async (brandName: string) => {
    try {
      const api = new API();
      await api.deleteBrandProCons(Number(visitId), [{
        brandName,
      }]);
      
      // Refresh brand data
      const updatedBrands = await api.getVisitProCons(Number(visitId));
      setBrandProCons(updatedBrands);
    } catch (error) {
      console.error('Error deleting brand Pro/Con:', error);
    }
  };

  const openAddBrandModal = () => {
    setNewBrandName('');
    setNewPros([]);
    setNewCons([]);
    setCurrentPro('');
    setCurrentCon('');
    setIsAddBrandModalVisible(true);
  };

  const addPro = () => {
    if (currentPro.trim()) {
      setNewPros([...newPros, currentPro.trim()]);
      setCurrentPro('');
    }
  };

  const addCon = () => {
    if (currentCon.trim()) {
      setNewCons([...newCons, currentCon.trim()]);
      setCurrentCon('');
    }
  };

  const removePro = (index: number) => {
    setNewPros(newPros.filter((_, i) => i !== index));
  };

  const removeCon = (index: number) => {
    setNewCons(newCons.filter((_, i) => i !== index));
  };

  const saveBrand = async () => {
    if (!newBrandName.trim()) return;

    try {
      await handleAddBrandProCon(newBrandName.trim(), newPros, newCons);
      setIsAddBrandModalVisible(false);
    } catch (error) {
      console.error('Error saving brand:', error);
    }
  };

  const createTask = async (taskType: string) => {
    setIsCreatingTask(true);
    setTaskCreateError(null);
    try {
      if (!token) {
        throw new Error('Your session is unavailable. Please sign in again.');
      }
      if (!loggedInEmployeeId) {
        throw new Error('Unable to identify the logged-in employee. Please sign in again.');
      }

      const currentTask = taskType === 'requirement' ? newTask : complaintTask;
      // Backend contract: POST /api/tasks with TaskRequest (TaskController.saveTask).
      // assignedBy is derived server-side from the logged-in user; visit link via visitActivityId.
      const detail = (visitDetail ?? {}) as unknown as Record<string, unknown>;
      const numberOrNull = (value: unknown): number | null =>
        typeof value === 'number' && Number.isFinite(value) ? value : null;
      const priorityUpper = String(currentTask.priority || 'low').toUpperCase();
      const payload = {
        taskTitle: currentTask.taskTitle.trim(),
        taskDescription: currentTask.taskDesciption.trim() || null,
        taskType: taskType === 'requirement' ? 'REQUIREMENT' : 'COMPLAINT',
        status: 'OPEN',
        priority: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(priorityUpper) ? priorityUpper : 'LOW',
        dueDate: currentTask.dueDate || null,
        assignedToEmployeeId: visitDetail?.employeeId || loggedInEmployeeId,
        clientAccountId: numberOrNull(detail.clientAccountId),
        institutionId: numberOrNull(detail.institutionId),
        projectId: numberOrNull(detail.projectId),
        ncRegisterId: null,
        visitActivityId: Number(visitId),
      };
      const taskToCreate = {
        ...currentTask,
        assignedById: loggedInEmployeeId,
        taskType,
        storeId: visitDetail?.storeId ?? 0,
        assignedToId: visitDetail?.employeeId ?? 0,
        assignedToName: visitDetail?.employeeName ?? '',
        storeName: visitDetail?.storeName ?? '',
        visitId: Number(visitId),
      };

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://ec2-18-211-58-135.compute-1.amazonaws.com:8081'}/api/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Failed to create ${taskType} (${response.status})`);
      }

      const data = await response.json();

      const createdTask = normalizeVisitTask({ ...taskToCreate, ...data });

      if (taskType === 'requirement') {
        setRequirements(prevTasks => [createdTask, ...prevTasks]);
        // Reset requirement form
        setNewTask({
          id: 0,
          taskTitle: '',
          taskDesciption: '',
          dueDate: '',
          assignedToId: 0,
          assignedToName: '',
          assignedById: 0,
          assignedByName: '',
          storeId: 0,
          storeName: '',
          storeCity: '',
          visitId: Number(visitId),
          visitDate: '',
          status: 'Assigned',
          priority: 'low',
          taskType: 'requirement',
          attachment: [],
          attachmentResponse: [],
          createdAt: '',
          updatedAt: '',
          createdTime: '',
          updatedTime: '',
        });
        setIsRequirementModalOpen(false);
        setTaskPanel(null);
        setActiveRequirementTab('general');
      } else {
        setComplaints(prevTasks => [createdTask, ...prevTasks]);
        // Reset complaint form
        setComplaintTask({
          id: 0,
          taskTitle: '',
          taskDesciption: '',
          dueDate: '',
          assignedToId: 0,
          assignedToName: '',
          assignedById: 0,
          assignedByName: '',
          storeId: 0,
          storeName: '',
          storeCity: '',
          visitId: Number(visitId),
          visitDate: '',
          status: 'Assigned',
          priority: 'low',
          taskType: 'complaint',
          attachment: [],
          attachmentResponse: [],
          createdAt: '',
          updatedAt: '',
          createdTime: '',
          updatedTime: '',
        });
        setIsComplaintModalOpen(false);
        setTaskPanel(null);
        setActiveComplaintTab('general');
      }
    } catch (error) {
      console.error('Error creating task:', error);
      setTaskCreateError(error instanceof Error ? error.message : `Failed to create ${taskType}`);
    } finally {
      setIsCreatingTask(false);
    }
  };

  if (isLoading) return <DetailSkeleton />;

  const fmtTime = (time?: string | null) => {
    if (!time) return '';
    const parsed = parseISO(`1970-01-01T${time}`);
    return Number.isNaN(parsed.getTime()) ? time : format(parsed, 'h:mm a');
  };
  const employeeLabel = resolveEmployeeName(visitDetail?.employeeName, visitDetail?.employeeId) || 'Unknown employee';
  const statusTone: Tone = visitStatus.status === 'Completed' ? 'success' : visitStatus.status === 'On Going' ? 'info' : visitStatus.status === 'Checked Out' ? 'warning' : 'neutral';
  const statusLabel = visitStatus.status === 'On Going' ? 'In progress' : visitStatus.status === 'Assigned' ? 'Scheduled' : visitStatus.status;
  const clientKindLabel = visitDetail?.clientKind === 'RETAIL' ? 'Retail' : visitDetail?.clientKind === 'INSTITUTION' ? 'Institution' : visitDetail?.clientKind === 'PROJECT' ? 'Project' : null;
  const durationValue = metrics.find((m) => m.title === 'Visit Duration')?.value;
  const intentValue = metrics.find((m) => m.title === 'Intent Level')?.value;
  const monthlySaleValue = metrics.find((m) => m.title === 'Monthly Sales')?.value;
  const timeWindow = visitDetail?.checkinTime ? `${fmtTime(visitDetail.checkinTime)} → ${visitDetail.checkoutTime ? fmtTime(visitDetail.checkoutTime) : 'now'}` : 'Not checked in';
  const hasLocation = Boolean(visitDetail?.checkinLatitude && visitDetail?.checkinLongitude);
  const openTaskPanel = (kind: 'requirement' | 'complaint') => { setTaskCreateError(null); setTaskPanel(kind); };
  const photos = [
    ...checkinImages.map((src, index) => ({ src, label: `Check-in ${index + 1}` })),
    ...(giftImage ? [{ src: giftImage, label: 'Gift' }] : []),
  ];
  const nextStep: HeroNextStep | null = visitStatus.status === 'Completed'
    ? { done: true, text: visitDetail?.outcome || visitDetail?.feedback ? `Visit completed. Outcome: ${formatActivityValue(visitDetail?.outcome || visitDetail?.feedback)}.` : 'Visit completed.' }
    : visitStatus.status === 'On Going'
      ? { done: false, text: `In progress since ${fmtTime(visitDetail?.checkinTime)}.${canCheckoutVisit ? ' Check out when the visit ends.' : ' Waiting for check-out.'}`, action: canCheckoutVisit ? <Button size="sm" onClick={openCheckoutModal} disabled={isCheckingOut}><LogOut className="mr-1.5 h-3.5 w-3.5" />Check out</Button> : undefined }
      : visitStatus.status === 'Assigned'
        ? { done: false, text: 'Not checked in yet. The field employee checks in from the mobile app.' }
        : null;

  type TimelineItem =
    | { key: string; at: number; kind: 'scheduled' }
    | { key: string; at: number; kind: 'checkin' }
    | { key: string; at: number; kind: 'note'; note: ApiNote }
    | { key: string; at: number; kind: 'checkout' }
    | { key: string; at: number; kind: 'inprogress' };
  // Chronological timeline: scheduled → check-in → notes (by createdAt) → check-out.
  const timeline: TimelineItem[] = (() => {
    const timeOf = (date?: string, time?: string): number | null => {
      if (!date || !time) return null;
      const ms = new Date(`${date}T${time}`).getTime();
      return Number.isNaN(ms) ? null : ms;
    };
    const dayStartOf = (date?: string): number | null => {
      if (!date) return null;
      const ms = new Date(`${date}T00:00:00`).getTime();
      return Number.isNaN(ms) ? null : ms;
    };
    const items: TimelineItem[] = [{ key: 'scheduled', at: Number.MIN_SAFE_INTEGER, kind: 'scheduled' }];
    const checkinAt = timeOf(visitDetail?.checkinDate, visitDetail?.checkinTime);
    if (checkinAt != null) items.push({ key: 'checkin', at: checkinAt, kind: 'checkin' });
    const checkoutAt = timeOf(visitDetail?.checkoutDate, visitDetail?.checkoutTime);
    const scheduledAt = dayStartOf(visitDetail?.visit_date);
    for (const note of notes) {
      const created = typeof note.createdDate === 'string' && note.createdDate.trim() ? new Date(note.createdDate).getTime() : NaN;
      // Undated notes sort with the scheduled day, never above a completed visit.
      const at = Number.isNaN(created) ? (checkoutAt ?? scheduledAt ?? Number.MAX_SAFE_INTEGER) : created;
      items.push({ key: `activity-note-${note.id}`, at, kind: 'note', note });
    }
    if (checkoutAt != null) items.push({ key: 'checkout', at: checkoutAt, kind: 'checkout' });
    else items.push({ key: 'inprogress', at: Number.MAX_SAFE_INTEGER, kind: 'inprogress' });
    return items.sort((a, b) => a.at - b.at);
  })();
  const timelineDot = (tone: 'muted' | 'success' | 'primary', Icon: typeof Calendar) => (
    <span className={cn('relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-card', tone === 'success' && 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950', tone === 'primary' && 'border-primary/20 bg-primary/5')}>
      <Icon className={cn('h-3 w-3', tone === 'success' ? 'text-emerald-600 dark:text-emerald-400' : tone === 'primary' ? 'text-primary' : 'text-muted-foreground')} />
    </span>
  );

  return (
    <div className="detail-page space-y-4 font-poppins text-xs">
      <DetailHero
        name={visitDetail?.storeName || 'Unknown store'}
        onBack={handleBack}
        backLabel="Back"
        badges={<>
          <Pill tone={statusTone}>{statusLabel}</Pill>
          {clientKindLabel && <Pill>{clientKindLabel}</Pill>}
        </>}
        meta={[
          { icon: Calendar, label: formatDay(visitDetail?.visit_date), title: 'Visit date' },
          { icon: Clock, label: timeWindow, title: 'Check-in → check-out' },
          { icon: User, label: employeeLabel, title: 'Visited by' },
          ...(storeDetails?.city ? [{ icon: MapPin, label: formatCityLabel(storeDetails.city) }] : []),
          { icon: Hash, label: visitDetail?.id ?? visitId },
        ]}
        description={visitDetail?.purpose ? <><span className="font-medium text-foreground">{visitDetail.purpose}</span>{visitDetail.description ? ` · ${visitDetail.description}` : ''}</> : undefined}
        actions={<>
          {canCheckoutVisit && <Button size="sm" className="h-8" onClick={openCheckoutModal} disabled={isCheckingOut}>{isCheckingOut ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <LogOut className="mr-1.5 h-3.5 w-3.5" />}Check out</Button>}
          <Button variant="outline" size="sm" className="h-8" onClick={addNote}><MessageSquare className="mr-1.5 h-3.5 w-3.5" />Add note</Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8" aria-label="More actions"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onSelect={() => openTaskPanel('requirement')}><FileText />Create requirement</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => openTaskPanel('complaint')}><AlertCircle />Create complaint</DropdownMenuItem>
              <DropdownMenuSeparator />
              {visitDetail?.storeId ? <DropdownMenuItem onSelect={handleViewStore}><Store />Open account</DropdownMenuItem> : null}
              {hasLocation && <DropdownMenuItem onSelect={handleOpenLocation}><MapPin />Check-in location</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        </>}
        kpis={<>
          <KpiCell icon={Clock} label="Duration" value={durationValue || '—'} hint={visitStatus.isOngoing ? 'still in progress' : undefined} />
          <KpiCell icon={TrendingUp} label="Intent level" value={intentValue || '—'} />
          <KpiCell icon={Package} label="Monthly sale" value={monthlySaleValue || '—'} />
          <KpiCell icon={Calendar} label="Store visits" value={storeVisits.length} hint="all visits to this account" />
        </>}
        nextStep={nextStep}
      />

      {checkoutMessage && <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"><CheckCircle className="h-4 w-4 shrink-0" />{checkoutMessage}</div>}
      {(checkoutError || error) && <WarningBanner>{checkoutError || error}</WarningBanner>}

      <DetailShell
        defaultValue="overview"
        tabs={[
          {
            value: 'overview',
            label: 'Overview',
            content: (
              <div className="grid gap-4 lg:grid-cols-2">
                <Section icon={ListTodo} title="Activity" className="lg:row-span-2" bodyClassName="px-4 pb-3 pt-1" action={<Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={addNote}><Plus className="mr-1 h-3.5 w-3.5" />Note</Button>}>
                  <ol className="relative before:absolute before:bottom-3 before:left-[11px] before:top-3 before:w-px before:bg-border">
                    {timeline.map((item, index) => {
                      const spacing = index === timeline.length - 1 ? '' : 'pb-3';
                      if (item.kind === 'scheduled') return (
                        <li key={item.key} className={cn('relative flex gap-2.5', spacing)}>
                          {timelineDot('muted', Calendar)}
                          <div className="min-w-0 pt-0.5"><p className="text-xs font-semibold">Visit scheduled</p><p className="text-[11px] text-muted-foreground">{formatDay(visitDetail?.visit_date)}{visitDetail?.purpose ? ` · ${visitDetail.purpose}` : ''}</p></div>
                        </li>
                      );
                      if (item.kind === 'checkin') return (
                        <li key={item.key} className={cn('relative flex gap-2.5', spacing)}>
                          {timelineDot('success', LogIn)}
                          <div className="min-w-0 pt-0.5"><p className="text-xs font-semibold">Checked in</p><p className="text-[11px] text-muted-foreground">{formatDay(visitDetail?.checkinDate)} at {fmtTime(visitDetail?.checkinTime)}{hasLocation && <> · <button type="button" onClick={handleOpenLocation} className="text-foreground hover:underline">location</button></>}</p></div>
                        </li>
                      );
                      if (item.kind === 'note') {
                        const note = item.note;
                        const author = note.employeeName || resolveEmployeeName(null, (note as unknown as Record<string, unknown>).authorEmployeeId as number);
                        return (
                          <li key={item.key} className={cn('group relative flex gap-2.5', spacing)}>
                            {timelineDot('primary', MessageSquare)}
                            <div className="min-w-0 flex-1 pt-0.5">
                              <div className="flex items-start justify-between gap-2">
                                <p className="min-w-0 whitespace-pre-wrap break-words text-xs leading-5">{note.content}</p>
                                <div className="flex shrink-0 items-center md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                                  <Button variant="ghost" size="icon" onClick={() => editNote(note)} className="h-6 w-6 text-muted-foreground hover:text-foreground" aria-label="Edit note"><Edit className="h-3 w-3" /></Button>
                                  <Button variant="ghost" size="icon" onClick={() => setNotePendingDelete(note)} className="h-6 w-6 text-muted-foreground hover:text-destructive" aria-label="Delete note"><Trash2 className="h-3 w-3" /></Button>
                                </div>
                              </div>
                              <p className="text-[11px] text-muted-foreground">{['Note', formatNoteDate(note.createdDate), author].filter(Boolean).join(' · ')}</p>
                            </div>
                          </li>
                        );
                      }
                      if (item.kind === 'checkout') return (
                        <li key={item.key} className="relative flex gap-2.5">
                          {timelineDot('success', CheckCircle)}
                          <div className="min-w-0 pt-0.5">
                            <p className="text-xs font-semibold">Visit completed</p>
                            <p className="text-[11px] text-muted-foreground">{formatDay(visitDetail?.checkoutDate)} at {fmtTime(visitDetail?.checkoutTime)}{durationValue ? ` · ${durationValue}` : ''}</p>
                            {(visitDetail?.outcome || visitDetail?.feedback) && <p className="mt-0.5 text-xs leading-5"><span className="font-medium">Outcome:</span> <span className="text-muted-foreground">{formatActivityValue(visitDetail?.outcome || visitDetail?.feedback)}</span></p>}
                          </div>
                        </li>
                      );
                      return (
                        <li key={item.key} className="relative flex gap-2.5">
                          {timelineDot('muted', Clock)}
                          <div className="min-w-0 pt-0.5"><p className="text-xs font-semibold">{visitDetail?.checkinTime ? 'Visit in progress' : 'Awaiting check-in'}</p><p className="text-[11px] text-muted-foreground">{visitDetail?.checkinTime ? 'Waiting for check-out' : 'Not started yet'}</p></div>
                        </li>
                      );
                    })}
                  </ol>
                </Section>
                <Section icon={ClipboardList} title="Visit details">
                  <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                    <Info label="Check-in" value={visitDetail?.checkinDate ? `${formatDay(visitDetail.checkinDate)}, ${fmtTime(visitDetail.checkinTime)}` : 'Not checked in'} />
                    <Info label="Check-out" value={visitDetail?.checkoutDate ? `${formatDay(visitDetail.checkoutDate)}, ${fmtTime(visitDetail.checkoutTime)}` : 'Not checked out'} />
                    <Info label="Outcome" value={visitDetail?.outcome ? formatActivityValue(visitDetail.outcome) : 'Not recorded'} />
                    <Info label="Location" value={hasLocation ? <button type="button" onClick={handleOpenLocation} className="inline-flex items-center gap-1 hover:underline">View on map<ExternalLink className="h-3 w-3 text-muted-foreground" /></button> : 'Not recorded'} />
                    {visitDetail?.feedback && visitDetail.feedback !== visitDetail.outcome && <Info className="sm:col-span-2" label="Feedback" value={formatActivityValue(visitDetail.feedback)} />}
                    {hasSavedGift && <Info className="sm:col-span-2" label="Gift" value={<span className="inline-flex flex-wrap items-center gap-x-2"><Gift className="h-3.5 w-3.5 text-rose-500" />{visitDetail?.giftName?.trim() || 'Gift'}{visitDetail?.giftQuantity != null ? ` × ${visitDetail.giftQuantity}` : ''}{visitDetail?.giftRemarks?.trim() && <span className="font-normal text-muted-foreground">· {visitDetail.giftRemarks.trim()}</span>}</span>} />}
                  </dl>
                </Section>
                <Section icon={Store} title="Account" action={visitDetail?.storeId ? <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={handleViewStore}>Open<ChevronRight className="ml-0.5 h-3.5 w-3.5" /></Button> : undefined}>
                  <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                    <Info label="Contact" value={storeDetails?.contactNumber ? <a href={`tel:${storeDetails.contactNumber}`} className="hover:underline">{storeDetails.contactNumber}</a> : 'Not recorded'} />
                    <Info label="City" value={storeDetails?.city ? formatCityLabel(storeDetails.city) : 'Not recorded'} />
                    <Info className="sm:col-span-2" label="Address" value={storeDetails?.address ? <span>{storeDetails.address} <button type="button" onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${visitDetail?.storeName} ${storeDetails?.address}`)}`, '_blank')} className="ml-1 inline-flex items-center gap-1 font-normal text-muted-foreground hover:text-foreground hover:underline">Map<ExternalLink className="h-3 w-3" /></button></span> : 'Not recorded'} />
                  </dl>
                </Section>
                <Section icon={ImageIcon} title={`Photos · ${photos.length}`} className="lg:col-span-2" bodyClassName={photos.length ? 'p-3' : 'p-0'}>
                  {isGiftImageLoading && !photos.length ? <Skeleton className="h-24 w-full rounded-lg" /> : photos.length === 0 ? <EmptyState compact title={giftImageError ? 'Gift image could not be loaded. No check-in photos.' : 'No check-in or gift photos uploaded.'} /> : (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
                      {photos.map((photo) => (
                        <button key={photo.src} type="button" onClick={() => handleImageClick(photo.src)} className="group relative aspect-square overflow-hidden rounded-lg bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" title={`${photo.label} · view full size`}>
                          <Image src={photo.src} alt={photo.label} width={240} height={240} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                          <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-1.5 pb-1 pt-4 text-left text-[10px] font-medium text-white">{photo.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </Section>
              </div>
            ),
          },
          {
            value: 'visits',
            label: 'Store visits',
            count: storeVisits.length,
            content: (
              <Section
                description={searchQuery ? `${filteredVisits.length} of ${storeVisits.length} visits match` : `${storeVisits.length} visits to this account · newest first`}
                bodyClassName="p-0"
                action={storeVisits.length > 3 ? (
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search purpose…" className="h-7 w-44 pl-7 pr-7 text-xs" aria-label="Search visit purpose" />
                    {searchQuery && <button type="button" aria-label="Clear visit search" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => { setSearchQuery(''); setCurrentPage(1); }}><X className="h-3.5 w-3.5" /></button>}
                  </div>
                ) : undefined}
              >
                {currentVisits.length === 0 ? <EmptyState compact title={searchQuery ? 'No visits match this purpose.' : 'No other visits recorded for this account.'} /> : (
                  <ul className="divide-y">
                    {currentVisits.map((visit: VisitDto) => {
                      const done = Boolean(visit.checkinTime && visit.checkoutTime);
                      const started = Boolean(visit.checkinDate && visit.checkinTime);
                      const isCurrent = String(visit.id) === String(visitId);
                      return (
                        <li key={visit.id}>
                          <button type="button" disabled={isCurrent} onClick={() => router.push(`/dashboard/visits/${visit.id}`)} className="group grid w-full grid-cols-[80px_minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-2 text-left transition-colors enabled:hover:bg-muted/40 disabled:cursor-default disabled:bg-primary/[0.03]">
                            <div className="leading-tight">
                              <p className="text-sm font-medium tabular-nums">{started ? formatDay(visit.checkinDate) : 'Not started'}</p>
                              <p className="text-[11px] text-muted-foreground">{started ? fmtTime(visit.checkinTime) : '—'}</p>
                            </div>
                            <div className="min-w-0 leading-tight">
                              <p className="truncate text-sm font-medium">{visit.purpose || 'Visit'}</p>
                              <p className="truncate text-[11px] text-muted-foreground">{visit.employeeName || 'Employee unavailable'}{done && visit.checkinTime && visit.checkoutTime ? ` · ${calculateDuration(visit.checkinTime, visit.checkoutTime)}` : ''} · #{visit.id}</p>
                            </div>
                            <span className="flex items-center gap-1.5">
                              {isCurrent && <Pill tone="info">This visit</Pill>}
                              <Pill tone={done ? 'success' : started ? 'info' : 'warning'}>{done ? 'Completed' : started ? 'In progress' : 'Scheduled'}</Pill>
                              {!isCurrent && <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between gap-2 border-t px-4 py-2 text-xs text-muted-foreground">
                    <span>Page {currentPage} of {totalPages}</span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1}><ChevronLeft className="mr-0.5 h-3.5 w-3.5" />Previous</Button>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage >= totalPages}>Next<ChevronRight className="ml-0.5 h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                )}
              </Section>
            ),
          },
          {
            value: 'brands',
            label: 'Brands',
            count: brandProCons.length,
            content: (
              <BrandTab
                brands={brandProCons}
                setBrands={setBrandProCons}
                visitId={visitId}
                token={localStorage.getItem('authToken')}
                fetchVisitDetail={async () => { if (visitId) await fetchVisitDetail(visitId); }}
              />
            ),
          },
          {
            value: 'requirements',
            label: 'Requirements',
            count: requirements.length,
            content: <VisitTasksTab tasks={requirements} type="requirement" priority={priorityFilter} onPriorityChange={handlePriorityChange} loading={taskLoading.requirement} error={taskErrors.requirement} />,
          },
          {
            value: 'complaints',
            label: 'Complaints',
            count: complaints.length,
            content: <VisitTasksTab tasks={complaints} type="complaint" priority={priorityFilter} onPriorityChange={handlePriorityChange} loading={taskLoading.complaint} error={taskErrors.complaint} />,
          },
        ]}
      />

      <FormSheet
        open={isNoteModalVisible}
        onOpenChange={(open) => { if (!open) requestCloseNoteModal(); }}
        icon={MessageSquare}
        title={isNoteEditMode ? 'Edit note' : 'Add note'}
        description={`${visitDetail?.storeName || 'Visit'}${visitDetail?.visit_date ? ` · ${formatDay(visitDetail.visit_date)}` : ''}`}
        footerNote={isNoteEditMode ? 'Keeps the original author; the previous text is saved as a revision.' : 'Saved to this visit under your account.'}
        onSubmit={() => void saveNote()}
        submitLabel={isNoteEditMode ? 'Update note' : 'Add note'}
        submitting={isNoteSaving}
        submitDisabled={!noteContent.trim()}
      >
        <FormField label="Note" required><Textarea id="visitNoteContent" rows={8} autoFocus value={noteContent} onChange={(e) => setNoteContent(e.target.value)} placeholder="What happened on this visit…" /></FormField>
      </FormSheet>

      <Dialog open={notePendingDelete != null} onOpenChange={(open) => { if (!open) setNotePendingDelete(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete note?</DialogTitle>
            <DialogDescription>This note will be removed permanently from this visit.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">{notePendingDelete?.content || 'Note content unavailable'}</div>
            <div className="flex flex-col justify-end gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => setNotePendingDelete(null)} className="w-full sm:w-auto">Cancel</Button>
              <Button variant="destructive" onClick={() => notePendingDelete && deleteNote(notePendingDelete.id)} className="w-full sm:w-auto">Delete</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <FormSheet
        open={isCheckoutModalOpen}
        onOpenChange={(open) => { if (isCheckingOut) return; if (open) setIsCheckoutModalOpen(true); else requestCloseCheckoutModal(); }}
        icon={LogOut}
        title="Check out visit"
        description={`${visitDetail?.storeName || 'Visit'} · checked in at ${fmtTime(visitDetail?.checkinTime) || '—'}`}
        errors={checkoutError ? [checkoutError] : undefined}
        footerNote="Uses your current location; allow location access when prompted."
        onSubmit={() => void handleCheckoutVisit()}
        submitLabel="Check out"
        submitting={isCheckingOut}
        submitDisabled={!checkoutOutcome.trim()}
      >
        <FormGroup title="Outcome" description="Recorded on the visit only; it doesn't change the account's status or pipeline." columns={1}>
          <OptionCards
            value={checkoutOutcome as 'SUCCESS' | 'INTERESTED' | 'NO_PROGRESS' | 'FOLLOW_UP_REQUIRED'}
            onChange={setCheckoutOutcome}
            options={[
              { value: 'SUCCESS', label: 'Success', description: 'Order placed or objective achieved.' },
              { value: 'INTERESTED', label: 'Interested', description: 'Positive response, no commitment yet.' },
              { value: 'FOLLOW_UP_REQUIRED', label: 'Follow-up required', description: 'Needs another call or visit.' },
              { value: 'NO_PROGRESS', label: 'No progress', description: 'Nothing moved forward this time.' },
            ]}
          />
        </FormGroup>
        <FormGroup title="Next action">
          <FormField label="Next action"><Input id="checkoutNextAction" placeholder="e.g. Schedule follow-up" value={checkoutNextAction} onChange={(event) => setCheckoutNextAction(event.target.value)} disabled={isCheckingOut} /></FormField>
          <FormField label="Date"><Input id="checkoutNextActionDate" type="date" value={checkoutNextActionDate} onChange={(event) => setCheckoutNextActionDate(event.target.value)} disabled={isCheckingOut} /></FormField>
          <FormField label="Feedback" className="sm:col-span-2"><Textarea id="checkoutFeedback" rows={4} placeholder="e.g. Customer discussed a new requirement" value={checkoutFeedback} onChange={(event) => setCheckoutFeedback(event.target.value)} disabled={isCheckingOut} /></FormField>
        </FormGroup>
      </FormSheet>

      <FormSheet
        open={taskPanel != null}
        onOpenChange={(open) => { if (!open) { if (taskPanel === 'requirement') requestCloseRequirementModal(); else requestCloseComplaintModal(); } }}
        icon={taskPanel === 'complaint' ? AlertCircle : FileText}
        title={taskPanel === 'complaint' ? 'Create complaint' : 'Create requirement'}
        description={`${visitDetail?.storeName || 'Visit'} · assigned to ${employeeLabel}`}
        errors={taskCreateError ? [taskCreateError] : undefined}
        onSubmit={() => { if (taskPanel) void createTask(taskPanel); }}
        submitLabel={taskPanel === 'complaint' ? 'Create complaint' : 'Create requirement'}
        submitting={isCreatingTask}
      >
        {taskPanel && (() => {
          const draft = taskPanel === 'requirement' ? newTask : complaintTask;
          const update = (patch: Partial<NewTask>) => (taskPanel === 'requirement' ? setNewTask({ ...newTask, ...patch }) : setComplaintTask({ ...complaintTask, ...patch }));
          return (
            <FormGroup>
              <FormField label="Title" required className="sm:col-span-2"><Input id="taskPanelTitle" placeholder={taskPanel === 'requirement' ? 'e.g. Needs 12mm TMT quote' : 'e.g. Delayed delivery'} value={draft.taskTitle} onChange={(e) => update({ taskTitle: e.target.value })} /></FormField>
              <FormField label="Description" className="sm:col-span-2"><Textarea id="taskPanelDescription" rows={4} placeholder="Details the team needs to act on" value={draft.taskDesciption} onChange={(e) => update({ taskDesciption: e.target.value })} /></FormField>
              <FormField label="Due date"><Input id="taskPanelDueDate" type="date" value={draft.dueDate} onChange={(e) => update({ dueDate: e.target.value })} /></FormField>
              <FormField label="Priority"><Select value={draft.priority} onValueChange={(value) => update({ priority: value as Priority })}><SelectTrigger id="taskPanelPriority"><SelectValue placeholder="Select" /></SelectTrigger><SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem></SelectContent></Select></FormField>
            </FormGroup>
          );
        })()}
      </FormSheet>

      <Dialog open={previewVisible && Boolean(previewImage)} onOpenChange={setPreviewVisible}>
        <DialogContent className="max-w-4xl border-0 bg-transparent p-0 shadow-none">
          <DialogTitle className="sr-only">Image preview</DialogTitle>
          {previewImage && <Image src={previewImage} alt="Preview" width={1200} height={900} className="max-h-[85vh] w-full rounded-lg object-contain" />}
        </DialogContent>
      </Dialog>
    </div>
  );
};
