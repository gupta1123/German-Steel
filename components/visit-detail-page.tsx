"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Building, 
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
  ArrowLeft,
  Store,
  CheckCircle,
  Loader2,
  ExternalLink,
  ClipboardList,
  ListTodo,
  MapPin as MapMarker,
  LogIn,
  LogOut,
  ChevronLeft,
  ChevronRight,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { Heading, Text } from "@/components/ui/typography";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { API, BrandProCon, IntentAuditLog, MonthlySaleChange, Task, Note as ApiNote, VisitDto } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { hasManagerPrivileges } from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";
import Image from 'next/image';
import BrandTab from './BrandTab';

type Priority = 'low' | 'medium' | 'high';

type Metric = {
  title: string;
  value: string;
};

type VisitDetail = {
  id: number;
  storeName: string;
  employeeName: string;
  visit_date: string;
  purpose: string;
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

const normalizeVisitRole = (value?: string | null) =>
  String(value || "")
    .replace(/^ROLE[\s_]+/i, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

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
  const router = useRouter();
  const params = useParams();
  const visitId = params?.id as string;
  const { userRole, userData, currentUser } = useAuth();
  
  const [visitDetail, setVisitDetail] = useState<VisitDetail | null>(null);
  const [activeTab, setActiveTab] = useState("metrics");
  const [activeInfoTab, setActiveInfoTab] = useState("visit-info");
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
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(3);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [filteredRequirements, setFilteredRequirements] = useState<Task[]>([]);
  const [filteredComplaints, setFilteredComplaints] = useState<Task[]>([]);
  const [isRequirementModalOpen, setIsRequirementModalOpen] = useState(false);
  const [isComplaintModalOpen, setIsComplaintModalOpen] = useState(false);
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
    assignedById: 97,
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
    assignedById: 97,
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
    if (typeof window !== "undefined") {
      const stored = Number(localStorage.getItem("employeeId"));
      if (!Number.isNaN(stored) && stored > 0) {
        return stored;
      }
    }
    return userData?.employeeId ?? 0;
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

  const getInitials = (name: string) => {
    const nameParts = name.split(' ');
    const initials = nameParts.map((part) => part[0]).join('');
    return initials.toUpperCase().slice(0, 2);
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

  const getStatusIcon = (status: 'Assigned' | 'On Going' | 'Checked Out' | 'Completed') => {
    switch (status) {
      case 'Assigned':
        return <Clock className="w-4 h-4" />;
      case 'On Going':
        return <Loader2 className="w-4 h-4" />;
      case 'Checked Out':
        return <CheckCircle className="w-4 h-4" />;
      case 'Completed':
        return <CheckCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

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

  const fetchCheckinImages = async (visitId: number, attachments: Array<Record<string, unknown>>) => {
    try {
      const api = new API();
      const checkinImageUrls = await Promise.all(
        attachments
          .filter((attachment: Record<string, unknown>) => attachment.tag === 'check-in')
          .map(async (attachment: Record<string, unknown>) => {
            try{
           
              const response = await fetch(`/api/proxy/visit/downloadFile/${visitId}/check-in/${attachment.fileName}`, {
                headers: {
                  'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                },
              });
              
              if (!response.ok) {
                throw new Error('Failed to fetch image');
              }
              
              const blob = await response.blob();
              return URL.createObjectURL(blob);
            } catch (error) {
              console.error('Error fetching individual image:', error);
              return null;
            }
          })
      );
      

      setCheckinImages(checkinImageUrls.filter(url => url !== null) as string[]);
    } catch (error) {
      console.error('Error fetching check-in images:', error);
      setCheckinImages([]);
    }
  };

  const fetchVisitDetail = useCallback(async (visitId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const api = new API();

      // Fetch minimal data first for fast initial render
      const visitData = await api.getVisitById(Number(visitId));
      setVisitDetail({
        ...visitData,
        purpose: visitData.purpose || '',
        priority: visitData.priority || 'low',
        outcome: visitData.outcome || null,
        feedback: visitData.feedback || '',
        brandsInUse: (visitData.brandsInUse as unknown as string[]) || [],
        brandProCons: (visitData.brandProCons as unknown as BrandProCon[]) || [],
        createdAt: visitData.createdAt || '',
        updatedAt: visitData.updatedAt || '',
        storeId: visitData.storeId || 0,
        employeeId: visitData.employeeId || 0,
      });

      // Basic metric available from visit data
      calculateVisitDuration(
        visitData.checkinDate || '', 
        visitData.checkinTime || '', 
        visitData.checkoutDate || '', 
        visitData.checkoutTime || ''
      );

      // Allow page to render while loading the rest
      setIsLoading(false);

      // Load remaining data in parallel without blocking UI
      (async () => {
        try {
          const [
            proConsData,
            intentAuditData,
            monthlySaleData,
            requirementsData,
            complaintsData,
            notesData,
            storeVisitsData,
          ] = await Promise.all([
            api.getVisitProCons(Number(visitId)),
            api.getIntentAuditByVisit(Number(visitId)),
            api.getMonthlySaleByVisit(Number(visitId)),
            api.getTasksByVisit('requirement', Number(visitId)),
            api.getTasksByVisit('complaint', Number(visitId)),
            api.getNotesByVisit(Number(visitId)),
            api.getVisitsByStore(visitData.storeId || 0),
          ]);

          setBrandProCons(proConsData || []);
          setIntentAuditLogs(intentAuditData || []);
          setMonthlySaleChanges(monthlySaleData || []);
          setRequirements(requirementsData || []);
          setComplaints(complaintsData || []);
          setNotes(notesData || []);
          // Sort latest to oldest by visit_date
          const sortedStoreVisits = (storeVisitsData || []).slice().sort((a: VisitDto, b: VisitDto) => {
            const da = new Date(a.visit_date as string).getTime();
            const db = new Date(b.visit_date as string).getTime();
            return db - da;
          });
          setStoreVisits(sortedStoreVisits);

          // Derive metrics from fetched data
          if (intentAuditData && intentAuditData.length > 0) {
            const recentIntent = intentAuditData[intentAuditData.length - 1]?.newIntentLevel ?? 'N/A';
            setMetrics((prev) => {
              const filtered = prev.filter((m) => m.title !== 'Intent Level');
              return [...filtered, { title: 'Intent Level', value: String(recentIntent) }];
            });
          }

          if (monthlySaleData && monthlySaleData.length > 0) {
            const recentSales = `${monthlySaleData[0].newMonthlySale.toLocaleString()} tons`;
            setMetrics((prev) => {
              const filtered = prev.filter((m) => m.title !== 'Monthly Sales');
              return [...filtered, { title: 'Monthly Sales', value: recentSales }];
            });
          }

          // Fetch check-in images in background
          if (visitData.attachmentResponse && visitData.attachmentResponse.length > 0) {
            fetchCheckinImages(Number(visitId), visitData.attachmentResponse);
          }

          // Store details
          if (storeVisitsData && storeVisitsData.length > 0) {
            const firstVisit = storeVisitsData[0];
            setStoreDetails({
              contactNumber: firstVisit.storePrimaryContact?.toString() || 'Not available',
              city: firstVisit.city || 'Not available',
              address:
                `${firstVisit.subDistrict || ''}, ${firstVisit.district || ''}, ${firstVisit.state || ''}`
                  .replace(/^[, ]+|[, ]+$/g, '') || 'Not available',
            });
          }
        } catch (innerErr) {
          console.error('Error loading visit auxiliary data:', innerErr);
        }
      })();
    } catch (err) {
      setError((err as Error)?.message || 'Failed to load visit details');
      console.error('Error fetching visit details:', err);
      setIsLoading(false);
    }
  }, []);

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

    try {
      setIsCheckingOut(true);
      setCheckoutError(null);
      setCheckoutMessage(null);

      const position = await getBrowserLocation();
      const api = new API();
      const response = await api.checkoutVisit(visitDetail.id, {
        checkoutLatitude: position.coords.latitude,
        checkoutLongitude: position.coords.longitude,
        feedback: checkoutFeedback.trim(),
        outcome: checkoutOutcome.trim(),
      });

      if (response.toLowerCase().includes("error checking out")) {
        throw new Error(response);
      }

      setCheckoutMessage(response || "Checked out successfully.");
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

  const filterTasks = useCallback(() => {
    const filterByPriority = (tasks: Task[]) => {
      if (priorityFilter === 'all') return tasks;
      return tasks.filter(task => task.priority === priorityFilter);
    };

    setFilteredRequirements(filterByPriority(requirements));
    setFilteredComplaints(filterByPriority(complaints));
  }, [priorityFilter, requirements, complaints]);

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

  useEffect(() => {
    filterTasks();
  }, [requirements, complaints, priorityFilter, filterTasks]);

  const visitStatus = getOutcomeStatus(visitDetail);

  const infoItems = [
    {
      icon: Calendar,
      label: "Date & Time",
      value: visitDetail ? `${format(new Date(visitDetail.visit_date), "MMM d, yyyy")} at ${visitDetail.checkinTime || "N/A"}` : "N/A",
    },
    { icon: Clock, label: "Duration", value: metrics.find(m => m.title === 'Visit Duration')?.value || "N/A" },
    { icon: User, label: "Visited by", value: visitDetail?.employeeName || "N/A" },
    { icon: Phone, label: "Phone", value: storeDetails?.contactNumber || "N/A" },
    { icon: Mail, label: "Email", value: "N/A" },
    { icon: MapPin, label: "Address", value: storeDetails?.address || "N/A" },
  ];

  const displayMetrics = [
    { label: "Total Visits", value: storeVisits.length },
    { label: "Visit Duration", value: metrics.find(m => m.title === 'Visit Duration')?.value || "N/A" },
    { label: "Intent Level", value: metrics.find(m => m.title === 'Intent Level')?.value || "N/A" },
    { label: "Monthly Sale", value: metrics.find(m => m.title === 'Monthly Sales')?.value || "N/A" },
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
      return format(date, "MMM d, yyyy");
    } catch {
      return "N/A";
    }
  };

  const handleImageClick = (image: string) => {
    setPreviewImage(image);
    setPreviewVisible(true);
  };

  // Notes API functions
  const refreshNotes = useCallback(async () => {
    if (!visitId) return;
    try {
      const api = new API();
      const updatedNotes = await api.getNotesByVisit(Number(visitId));
      setNotes(updatedNotes);
    } catch (error) {
      console.error('Error refreshing notes:', error);
    }
  }, [visitId]);

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
      if (isNoteEditMode && editingNoteId !== null) {
        const response = await fetch(
          `/api/proxy/notes/edit?id=${editingNoteId}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
            },
            body: JSON.stringify({
              content: noteContent,
              employeeId: loggedInEmployeeId || visitDetail.employeeId || 0,
              storeId: visitDetail.storeId || 0,
            }),
          }
        );
        
        if (!response.ok) {
          throw new Error('Failed to update note');
        }

        await refreshNotes();
      } else {
        const response = await fetch(
          '/api/proxy/notes/create',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
            },
            body: JSON.stringify({
              content: noteContent,
              employeeId: loggedInEmployeeId || visitDetail.employeeId || 0,
              storeId: visitDetail.storeId || 0,
              visitId: Number(visitId),
            }),
          }
        );
        
        if (!response.ok) {
          throw new Error('Failed to create note');
        }

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
      const response = await fetch(
        `/api/proxy/notes/delete?id=${id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          },
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to delete note');
      }

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
    try {
      const currentTask = taskType === 'requirement' ? newTask : complaintTask;
      const taskToCreate = {
        ...currentTask,
        taskType,
        storeId: visitDetail?.storeId ?? 0,
        assignedToId: visitDetail?.employeeId ?? 0,
        assignedToName: visitDetail?.employeeName ?? '',
        storeName: visitDetail?.storeName ?? '',
        visitId: Number(visitId),
      };

      const response = await fetch('/api/proxy/task/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify(taskToCreate),
      });

      if (!response.ok) {
        throw new Error('Failed to create task');
      }

      const data = await response.json();

      const createdTask: Task = {
        id: data.id,
        title: taskToCreate.taskTitle,
        description: taskToCreate.taskDesciption,
        type: taskToCreate.taskType,
        status: taskToCreate.status,
        priority: taskToCreate.priority,
        assignedTo: taskToCreate.assignedToName,
        dueDate: taskToCreate.dueDate,
        visitId: taskToCreate.visitId,
      };

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
          assignedById: 97,
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
          assignedById: 97,
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
        setActiveComplaintTab('general');
      }
    } catch (error) {
      console.error('Error creating task:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="mx-auto max-w-[1200px] space-y-6">
          {/* Header skeleton */}
          <div className="flex flex-wrap justify-between gap-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div>
                <Skeleton className="h-4 w-36 mb-2" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-24" />
            </div>
          </div>

          {/* Metrics skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, idx) => (
              <div key={idx} className="rounded-xl border p-4 bg-muted/20 space-y-3">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-2 w-20" />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left column skeleton */}
            <div className="space-y-4">
              <div className="rounded-xl border p-5 space-y-4 bg-card">
                <Skeleton className="h-4 w-32" />
                {[...Array(4)].map((_, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3 w-28" />
                      <Skeleton className="h-2 w-20" />
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border p-5 bg-card space-y-3">
                <Skeleton className="h-4 w-28" />
                {[...Array(5)].map((_, idx) => (
                  <div key={idx} className="space-y-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-2 w-20" />
                  </div>
                ))}
              </div>
            </div>

            {/* Main content skeleton */}
            <div className="lg:col-span-2 space-y-6">
              {[...Array(3)].map((_, idx) => (
                <div key={idx} className="rounded-xl border bg-card">
                  <div className="border-b p-5">
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <div className="p-5 space-y-4">
                    {[...Array(2)].map((_, rowIdx) => (
                      <div key={rowIdx} className="flex flex-wrap gap-4">
                        <Skeleton className="h-3 w-32" />
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-3 w-28" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Tabbed sections */}
              <div className="rounded-xl border bg-card">
                <div className="p-5 border-b flex gap-4 overflow-x-auto">
                  {[...Array(5)].map((_, idx) => (
                    <Skeleton key={idx} className="h-8 w-24 rounded-full" />
                  ))}
                </div>
                <div className="p-5 space-y-4">
                  {[...Array(3)].map((_, idx) => (
                    <div key={idx} className="rounded-lg border p-4 space-y-2">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-3 w-1/2" />
                      <Skeleton className="h-3 w-3/4" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

                  return (
    <div>
      <div className="visit-details grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 items-start">
        {/* Left Panel */}
        <aside className="lg:col-span-3 space-y-3 md:space-y-4">
          <div className="back-button-container flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div className="back-button flex items-center cursor-pointer text-foreground hover:text-muted-foreground" onClick={handleBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="flex items-center gap-2 px-3 py-1 text-sm font-medium">
                {getStatusIcon(visitStatus.status as 'Assigned' | 'On Going' | 'Checked Out' | 'Completed')}
                <span>{visitStatus.status}</span>
              </Badge>
              {userRole && (
                <Badge variant={isManager ? "secondary" : "default"} className="text-xs">
                  {isManager ? "Manager View" : "Admin View"}
                </Badge>
              )}
            </div>
          </div>

          <Card className="bg-transparent border-0 shadow-none">
            <CardContent className="p-4 md:p-6">
              <div className="profile text-center mb-4 md:mb-6">
                <div className="avatar w-12 h-12 md:w-16 md:h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                  <span className="text-lg md:text-xl font-semibold text-foreground">
                    {getInitials(visitDetail?.storeName || '')}
                  </span>
                </div>
                <div className="mb-2">
                  <h2 className="text-lg md:text-xl font-semibold break-words">
                    <span className="text-xs md:text-sm font-normal text-muted-foreground">Store: </span>
                    {visitDetail?.storeName}
                  </h2>
                </div>
                <div>
                  <p className="text-sm md:text-base text-gray-600 break-words">
                    <span className="text-xs md:text-sm text-muted-foreground">Employee: </span>
                    {visitDetail?.employeeName}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4 mb-3 md:mb-4">
                <div className="relative group">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-full"
                    onClick={handleViewStore}
                  >
                    <Store className="h-4 w-4" />
                  </Button>
                  <span className="pointer-events-none absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-popover px-2 py-1 text-xs text-popover-foreground opacity-0 shadow transition group-hover:opacity-100">
                    View Store
                  </span>
                </div>
                <div className="relative group">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-full"
                    onClick={() => setIsRequirementModalOpen(true)}
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                  <span className="pointer-events-none absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-popover px-2 py-1 text-xs text-popover-foreground opacity-0 shadow transition group-hover:opacity-100">
                    Add Requirement
                  </span>
                </div>
                <div className="relative group">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-full"
                    onClick={() => setIsComplaintModalOpen(true)}
                  >
                    <AlertCircle className="h-4 w-4" />
                  </Button>
                  <span className="pointer-events-none absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-popover px-2 py-1 text-xs text-popover-foreground opacity-0 shadow transition group-hover:opacity-100">
                    Add Complaint
                  </span>
                </div>
                {canCheckoutVisit && (
                  <div className="relative group">
                    <Button
                      variant="default"
                      size="icon"
                      className="h-10 w-10 rounded-full"
                      onClick={openCheckoutModal}
                      disabled={isCheckingOut}
                    >
                      {isCheckingOut ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <LogOut className="h-4 w-4" />
                      )}
                    </Button>
                    <span className="pointer-events-none absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-popover px-2 py-1 text-xs text-popover-foreground opacity-0 shadow transition group-hover:opacity-100">
                      Check Out
                    </span>
                  </div>
                )}
              </div>

              {(checkoutMessage || checkoutError || error) && (
                <div className="space-y-2">
                  {checkoutMessage && (
                    <div className="rounded-md border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-700">
                      {checkoutMessage}
                    </div>
                  )}
                  {(checkoutError || error) && (
                    <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                      {checkoutError || error}
                    </div>
                  )}
                </div>
              )}

            </CardContent>
          </Card>

          {/* Visit Information Card */}
          <Card className="w-full border border-border bg-card shadow-sm lg:-mt-10 xl:-mt-12 transition-all">
            <CardHeader className="pt-3 pb-4">
              <CardTitle className="text-base font-semibold text-foreground text-center">
                Visit Information
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {/* Tabs Navigation */}
              <div className="flex border-b border-border">
                <button
                  className={`flex-1 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeInfoTab === 'visit-info' 
                      ? 'border-border text-card-foreground bg-card shadow-sm' 
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                  onClick={() => setActiveInfoTab('visit-info')}
                >
                  <div className="flex items-center justify-center gap-2">
                    <ClipboardList className="h-4 w-4" />
                    <span>Visit Info</span>
                  </div>
                </button>
                <button
                  className={`flex-1 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeInfoTab === 'store-info' 
                      ? 'border-border text-card-foreground bg-card shadow-sm' 
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                  onClick={() => setActiveInfoTab('store-info')}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Store className="h-4 w-4" />
                    <span>Store Info</span>
                  </div>
                </button>
              </div>

              {/* Tab Content */}
              <div className="p-4">
                {/* Visit Info Content */}
                {activeInfoTab === 'visit-info' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-purple-100 dark:bg-purple-900">
                          <ListTodo className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">Purpose</p>
                          <p className="text-sm text-muted-foreground break-words">{visitDetail?.purpose || 'N/A'}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-yellow-100 dark:bg-yellow-900">
                          <MapMarker className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">Location</p>
                          <div className="text-sm text-muted-foreground">
                            {visitDetail?.checkinLatitude && visitDetail?.checkinLongitude ? (
                              <button
                                onClick={handleOpenLocation}
                                className="text-foreground hover:text-muted-foreground transition-colors flex items-center gap-1"
                              >
                                <ExternalLink className="w-4 h-4" />
                                View Location
                              </button>
                            ) : (
                              <span>Location not available</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-green-100 dark:bg-green-900">
                          <LogIn className="h-4 w-4 text-green-600 dark:text-green-400" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">Check-in</p>
                          <div className="text-sm text-muted-foreground">
                            {visitDetail?.checkinDate && visitDetail?.checkinTime ? (
                              <div className="flex flex-col">
                                <span>{format(new Date(visitDetail.checkinDate), "dd MMM yyyy")}</span>
                                <span className="text-xs">
                                  {format(parseISO(`1970-01-01T${visitDetail.checkinTime}`), 'h:mm a')}
                                </span>
                              </div>
                            ) : (
                              <span>Check-in not available</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-red-100 dark:bg-red-900">
                          <LogOut className="h-4 w-4 text-red-600 dark:text-red-400" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">Check-out</p>
                          <div className="text-sm text-muted-foreground">
                            {visitDetail?.checkoutDate && visitDetail?.checkoutTime ? (
                              <div className="flex flex-col">
                                <span>{format(new Date(visitDetail.checkoutDate), "dd MMM yyyy")}</span>
                                <span className="text-xs">
                                  {format(parseISO(`1970-01-01T${visitDetail.checkoutTime}`), 'h:mm a')}
                                </span>
                              </div>
                            ) : (
                              <span>Check-out not available</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Visit Duration Display */}
                    {visitDetail?.checkinDate && visitDetail?.checkinTime && visitDetail?.checkoutDate && visitDetail?.checkoutTime && (
                      <div className="mt-4 p-4 bg-muted/30 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-100 dark:bg-blue-900">
                            <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">Visit Duration</p>
                            <p className="text-lg font-semibold text-foreground mt-1">
                              {metrics.find(m => m.title === 'Visit Duration')?.value || 'Calculating...'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Store Info Content */}
                {activeInfoTab === 'store-info' && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 mb-4 p-4 bg-muted/30 rounded-lg">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                        <Store className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground text-base break-words">{visitDetail?.storeName}</h3>
                        <p className="text-sm text-muted-foreground">{storeDetails?.city}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">Contact</p>
                          {storeDetails?.contactNumber ? (
                            <a 
                              href={`tel:${storeDetails.contactNumber}`}
                              className="text-sm text-foreground hover:text-muted-foreground transition-colors break-words"
                            >
                              {storeDetails.contactNumber}
                            </a>
                          ) : (
                            <span className="text-sm text-muted-foreground">No contact available</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-green-100 dark:bg-green-900">
                          <MapMarker className="h-4 w-4 text-green-600 dark:text-green-400" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">Location</p>
                          <div className="text-sm text-muted-foreground">
                            <p className="break-words">{storeDetails?.address || 'Address not available'}</p>
                            {storeDetails?.city && (
                              <button
                                onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${visitDetail?.storeName} ${storeDetails?.address}`)}`, "_blank")}
                                className="text-foreground hover:text-muted-foreground transition-colors mt-1 inline-flex items-center gap-1 text-xs"
                              >
                                <ExternalLink className="w-4 h-4" />
                                View on Maps
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </aside>

        {/* Main Content */}
        <section className="lg:col-span-6">
          <div className="tabs border-b mb-4 md:mb-6">
            <div className="md:hidden mb-3">
              <Select value={activeTab} onValueChange={setActiveTab}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select section" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="metrics">Visit Metrics</SelectItem>
                  <SelectItem value="visits">Recent Visits</SelectItem>
                  <SelectItem value="brands">Brands</SelectItem>
                  <SelectItem value="requirements">Requirements</SelectItem>
                  <SelectItem value="complaints">Complaints</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="hidden md:flex md:gap-2 md:overflow-x-auto md:flex-nowrap">
              <button
                className={`tab py-2 px-3 border-b-2 font-medium text-sm rounded transition-colors whitespace-nowrap ${
                  activeTab === 'metrics' 
                    ? 'border-border text-card-foreground bg-card shadow-sm' 
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
                onClick={() => setActiveTab('metrics')}
              >
                <TrendingUp className="w-4 h-4 mr-2 inline" />
                <span>Metrics</span>
              </button>
              <button
                className={`tab py-2 px-3 border-b-2 font-medium text-sm rounded transition-colors whitespace-nowrap ${
                  activeTab === 'visits' 
                    ? 'border-border text-card-foreground bg-card shadow-sm' 
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
                onClick={() => setActiveTab('visits')}
              >
                <Calendar className="w-4 h-4 mr-2 inline" />
                <span>Visits</span>
              </button>
              <button
                className={`tab py-2 px-3 border-b-2 font-medium text-sm rounded transition-colors whitespace-nowrap ${
                  activeTab === 'brands' 
                    ? 'border-border text-card-foreground bg-card shadow-sm' 
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
                onClick={() => setActiveTab('brands')}
              >
                <Building className="w-4 h-4 mr-2 inline" />
                <span>Brands</span>
              </button>
              <button
                className={`tab py-2 px-3 border-b-2 font-medium text-sm rounded transition-colors whitespace-nowrap ${
                  activeTab === 'requirements' 
                    ? 'border-border text-card-foreground bg-card shadow-sm' 
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
                onClick={() => setActiveTab('requirements')}
              >
                <FileText className="w-4 h-4 mr-2 inline" />
                <span>Requirements</span>
              </button>
              <button
                className={`tab py-2 px-3 border-b-2 font-medium text-sm rounded transition-colors whitespace-nowrap ${
                  activeTab === 'complaints' 
                    ? 'border-border text-card-foreground bg-card shadow-sm' 
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
                onClick={() => setActiveTab('complaints')}
              >
                <AlertCircle className="w-4 h-4 mr-2 inline" />
                <span>Complaints</span>
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="tab-content">
            {activeTab === 'metrics' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-foreground">Visit Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                    {displayMetrics.map((metric, index) => (
                      <div key={index} className="text-center p-3 md:p-4 bg-muted/30 rounded-lg">
                        <Text size="sm" tone="muted" weight="medium" className="mb-2">
                          {metric.label}
                        </Text>
                        <Heading size="lg" weight="semibold" className="text-foreground break-words">
                          {metric.value}
                        </Heading>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === 'visits' && (
              <div>
                <div className="filter-bar mb-4 w-full md:w-64">
                  <div className="relative">
                    <Input
                      placeholder="Search by Visit Purpose"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pr-10"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setSearchQuery('');
                          setCurrentPage(1);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="visits-list space-y-3">
                  {currentVisits.map((visit: VisitDto) => {
                    // Determine visit status
                    const getVisitStatus = () => {
                      if (visit.checkinDate && visit.checkinTime && visit.checkoutDate && visit.checkoutTime) {
                        return { status: 'Completed', color: 'bg-green-100 text-green-800', icon: '✅' };
                      } else if (visit.checkinDate && visit.checkinTime) {
                        return { status: 'In Progress', color: 'bg-blue-100 text-blue-800', icon: '🕐' };
                      } else {
                        return { status: 'Scheduled', color: 'bg-yellow-100 text-yellow-800', icon: '📅' };
                      }
                    };

                    const visitStatus = getVisitStatus();

                    return (
                      <Card key={visit.id} className="w-full hover:shadow-sm transition-all duration-200 border-l-2 border-l-primary/30 hover:border-l-primary">
                        <CardContent className="p-3">
                          {/* Header Section */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
                                <Calendar className="h-3 w-3 text-primary" />
                              </div>
                              <div>
                                <h3 className="font-medium text-sm text-foreground">{visit.purpose}</h3>
                                <p className="text-xs text-muted-foreground">ID: {visit.id}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={`${visitStatus.color} text-xs px-2 py-1`}>
                                <span className="mr-1">{visitStatus.icon}</span>
                                {visitStatus.status}
                              </Badge>
                              <div className="text-right">
                                <p className="text-xs font-medium text-foreground">
                            {visit.checkinDate && visit.checkinTime
                                    ? format(new Date(visit.checkinDate), "dd MMM ''yy")
                                    : 'TBD'}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {visit.checkinDate && visit.checkinTime
                                    ? format(parseISO(`1970-01-01T${visit.checkinTime}`), 'h:mm a')
                                    : 'TBD'}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Details Section */}
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-1">
                                <User className="h-3 w-3 text-muted-foreground" />
                                <span className="text-muted-foreground font-medium">Store:</span>
                                <span className="text-muted-foreground">{visit.storeName}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Store className="h-3 w-3 text-muted-foreground" />
                                <span className="text-muted-foreground font-medium">Employee:</span>
                                <span className="text-muted-foreground truncate max-w-32">{visit.employeeName}</span>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                <span>
                                  {visit.checkinDate && visit.checkinTime && visit.checkoutDate && visit.checkoutTime
                                    ? calculateDuration(visit.checkinTime, visit.checkoutTime)
                                    : 'TBD'}
                          </span>
                        </div>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => router.push(`/dashboard/visits/${visit.id}`)}
                                className="text-xs h-6 px-2"
                              >
                                View
                              </Button>
                            </div>
                        </div>
                      </CardContent>
                    </Card>
                    );
                  })}
                </div>
                {storeVisits.length > pageSize && (
                  <div className="mt-4">
                    <Button onClick={() => setShowAll(!showAll)}>
                      {showAll ? 'Show Less' : 'Show More'}
                              </Button>
                    {showAll && (
                      <div className="flex items-center justify-between mt-4">
                        <div className="flex items-center space-x-2">
                          <Label htmlFor="pageSize">Rows per page:</Label>
                          <Select value={pageSize.toString()} onValueChange={(value) => setPageSize(parseInt(value))}>
                            <SelectTrigger className="w-20">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="3">3</SelectItem>
                              <SelectItem value="5">5</SelectItem>
                              <SelectItem value="10">10</SelectItem>
                              <SelectItem value="25">25</SelectItem>
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
                    )}
                        </div>
                      )}
                    </div>
                  )}

            {activeTab === 'brands' && (
              <BrandTab
                brands={brandProCons}
                setBrands={setBrandProCons}
                visitId={visitId}
                token={localStorage.getItem('authToken')}
                fetchVisitDetail={async () => {
                  if (visitId) {
                    await fetchVisitDetail(visitId);
                  }
                }}
              />
            )}

            {activeTab === 'requirements' && (
              <div>
                <div className="filter-bar mb-4">
                  <Select value={priorityFilter} onValueChange={handlePriorityChange}>
                    <SelectTrigger className="w-full md:w-48">
                      <SelectValue placeholder="Filter by Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Priorities</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="requirements-list space-y-3 md:space-y-4">
                  {filteredRequirements.map((req, index) => (
                    <Card key={index}>
                      <CardContent className="p-3 md:p-4">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-3">
                          <span className="font-medium text-foreground text-sm md:text-base break-words">{req.title}</span>
                          <div className="flex flex-wrap gap-2">
                            {getPriorityBadge(req.priority as Priority)}
                            {getStatusBadge(req.status)}
                          </div>
                        </div>
                        <div className="text-xs md:text-sm text-gray-600 space-y-2">
                          <p>Due: {format(new Date(req.dueDate), "MMM d, yyyy")}</p>
                          <div className="flex items-center">
                            <div className="avatar w-5 h-5 md:w-6 md:h-6 rounded-full bg-gray-200 flex items-center justify-center mr-2">
                              <span className="text-xs">{getInitials(req.assignedTo || 'Unknown')}</span>
                            </div>
                            <span className="break-words">Assigned to {req.assignedTo || 'Unknown'}</span>
                          </div>
                          <p className="break-words">{req.description}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'complaints' && (
              <div>
                <div className="filter-bar mb-4">
                  <Select value={priorityFilter} onValueChange={handlePriorityChange}>
                    <SelectTrigger className="w-full md:w-48">
                      <SelectValue placeholder="Filter by Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Priorities</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="complaints-list space-y-3 md:space-y-4">
                  {filteredComplaints.map((complaint, index) => (
                    <Card key={index}>
                      <CardContent className="p-3 md:p-4">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-3">
                          <span className="font-medium text-foreground text-sm md:text-base break-words">{complaint.title}</span>
                          <div className="flex flex-wrap gap-2">
                            {getPriorityBadge(complaint.priority as Priority)}
                            {getStatusBadge(complaint.status)}
                          </div>
                        </div>
                        <div className="text-xs md:text-sm text-gray-600 space-y-2">
                          <p>Reported: {format(new Date(complaint.dueDate), "MMM d, yyyy")}</p>
                          <div className="flex items-center">
                            <div className="avatar w-5 h-5 md:w-6 md:h-6 rounded-full bg-gray-200 flex items-center justify-center mr-2">
                              <span className="text-xs">{getInitials(complaint.assignedTo || 'Unknown')}</span>
                            </div>
                            <span className="break-words">Handled by {complaint.assignedTo || 'Unknown'}</span>
                          </div>
                          <p className="break-words">{complaint.description}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>

        </section>

        {/* Right Panel */}
        <aside className="lg:col-span-3 space-y-4 md:space-y-6">
          <Card>
            <CardHeader className="pb-3 md:pb-4">
              <Heading as="h3" size="lg" weight="semibold" className="text-base md:text-lg">
                Check-in Images
              </Heading>
            </CardHeader>
            <CardContent className="p-3 md:p-6 space-y-4 md:space-y-6">
              {/* Check-in Location */}
              {visitDetail?.checkinLatitude && visitDetail?.checkinLongitude && (
                <div className="flex items-center gap-2 pb-2 border-b">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2"
                    onClick={handleOpenLocation}
                  >
                    <MapPin className="h-4 w-4 mr-1.5" />
                    <span className="text-sm">Check-in Location</span>
                  </Button>
                </div>
              )}

              {/* Check-in Images */}
              {checkinImages.length > 0 ? (
                <div className="space-y-3 md:space-y-4">
                  {checkinImages.map((image, index) => (
                    <div key={index} className="rounded-lg border overflow-hidden">
                      <div className="relative w-full h-32 md:h-40 bg-gray-100">
                        <Image
                          src={image}
                          alt={`Check-in image ${index + 1}`}
                          width={300}
                          height={200}
                          className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => handleImageClick(image)}
                        />
                      </div>
                      <div className="p-2 md:p-3">
                        <Heading as="h4" size="sm" weight="semibold" className="text-sm md:text-base">
                          Check-in Image {index + 1}
                        </Heading>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="mt-2 w-full text-xs md:text-sm"
                          onClick={() => handleImageClick(image)}
                        >
                          View Full Size
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 md:py-8">
                  <ImageIcon className="h-8 w-8 md:h-12 md:w-12 text-gray-400 mx-auto mb-3 md:mb-4" />
                  <Text tone="muted" className="text-sm md:text-base">No images available for this visit</Text>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3 md:pb-4">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                <Heading as="h3" size="lg" weight="semibold" className="text-base md:text-lg">
                  Notes
                </Heading>
                <Button onClick={addNote} size="sm" className="text-xs md:text-sm">
                  <Plus className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                  Add Note
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-3 md:p-6">
              <div className="notes-list space-y-3">
                {notes.map((note) => (
                  <div key={note.id} className="rounded-lg border bg-card p-3 md:p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                      <span className="text-xs text-muted-foreground">{format(new Date(note.createdDate), "MMM d, yyyy")}</span>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => editNote(note)} className="h-7 w-7">
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setNotePendingDelete(note)} className="h-7 w-7">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                    </div>
                    <div className="text-xs md:text-sm text-foreground break-words">{note.content}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      {/* Modals */}
      {/* Notes Modal */}
      <Dialog open={isNoteModalVisible} onOpenChange={(open) => {
        if (!open) {
          setIsNoteModalVisible(false);
          setNoteContent('');
          setIsNoteEditMode(false);
          setEditingNoteId(null);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isNoteEditMode ? 'Edit Note' : 'Add Note'}</DialogTitle>
            <DialogDescription>
              {isNoteEditMode ? 'Update the existing note.' : 'Add a quick note for this visit.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <textarea
              placeholder="Enter note content"
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            />
            <div className="flex flex-col sm:flex-row justify-end gap-2">
              <Button variant="outline" onClick={() => setIsNoteModalVisible(false)} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button onClick={saveNote} className="w-full sm:w-auto" disabled={isNoteSaving || !noteContent.trim()}>
                {isNoteSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isNoteEditMode ? 'Updating…' : 'Adding…'}
                  </>
                ) : (
                  isNoteEditMode ? 'Update' : 'Add'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={notePendingDelete != null} onOpenChange={(open) => {
        if (!open) {
          setNotePendingDelete(null);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Note?</DialogTitle>
            <DialogDescription>
              This note will be removed permanently for this visit.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
              {notePendingDelete?.content || 'Note content unavailable'}
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-2">
              <Button variant="outline" onClick={() => setNotePendingDelete(null)} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => notePendingDelete && deleteNote(notePendingDelete.id)} className="w-full sm:w-auto">
                Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isCheckoutModalOpen} onOpenChange={(open) => {
        if (!isCheckingOut) {
          setIsCheckoutModalOpen(open);
          if (!open) {
            setCheckoutError(null);
          }
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Check Out Visit</DialogTitle>
            <DialogDescription>
              Checkout will use your current location and the backend will set the checkout date and time.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="checkoutOutcome">Outcome</Label>
              <Input
                id="checkoutOutcome"
                placeholder="Interested"
                value={checkoutOutcome}
                onChange={(event) => setCheckoutOutcome(event.target.value)}
                disabled={isCheckingOut}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="checkoutFeedback">Feedback</Label>
              <textarea
                id="checkoutFeedback"
                placeholder="Customer discussed new requirement"
                value={checkoutFeedback}
                onChange={(event) => setCheckoutFeedback(event.target.value)}
                rows={4}
                disabled={isCheckingOut}
                className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
              Allow browser location access when prompted. Checkout latitude and longitude will be sent with this request.
            </div>
            {checkoutError && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {checkoutError}
              </div>
            )}
            <div className="flex flex-col justify-end gap-2 sm:flex-row">
              <Button
                variant="outline"
                onClick={() => setIsCheckoutModalOpen(false)}
                disabled={isCheckingOut}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCheckoutVisit}
                disabled={isCheckingOut || !checkoutOutcome.trim()}
                className="w-full sm:w-auto"
              >
                {isCheckingOut ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Checking out…
                  </>
                ) : (
                  <>
                    <LogOut className="mr-2 h-4 w-4" />
                    Check Out
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Requirement Modal */}
      {isRequirementModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-2xl border-0 shadow-lg max-h-[90vh] overflow-y-auto">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg md:text-xl font-semibold text-foreground">Create Requirement</CardTitle>
              <p className="text-xs md:text-sm text-muted-foreground">Fill in the requirement details</p>
            </CardHeader>
            <CardContent>
              <Tabs value={activeRequirementTab} onValueChange={setActiveRequirementTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="general">General</TabsTrigger>
                  <TabsTrigger value="details">Details</TabsTrigger>
                </TabsList>
                
                <TabsContent value="general">
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="requirementTitle">Requirement Title</Label>
                      <Input
                        id="requirementTitle"
                        placeholder="Enter requirement title"
                        value={newTask.taskTitle}
                        onChange={(e) => setNewTask({ ...newTask, taskTitle: e.target.value })}
                        className="w-full"
                />
              </div>
                    <div className="space-y-2">
                      <Label htmlFor="requirementDescription">Requirement Description</Label>
                      <Input
                        id="requirementDescription"
                        placeholder="Enter requirement description"
                        value={newTask.taskDesciption}
                        onChange={(e) => setNewTask({ ...newTask, taskDesciption: e.target.value })}
                        className="w-full"
                      />
                </div>
                    <div className="space-y-2">
                      <Label htmlFor="requirementCategory">Category</Label>
                      <Select value="requirement" disabled>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Requirement" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="requirement">Requirement</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="requirementStoreName">Store</Label>
                      <Input
                        id="requirementStoreName"
                        value={visitDetail ? `${visitDetail.storeName}` : 'Loading...'}
                        disabled
                        className="w-full bg-gray-100 text-foreground font-medium cursor-not-allowed"
                      />
                    </div>
                    <div className="flex flex-col sm:flex-row justify-between gap-2 mt-4">
                      <Button variant="outline" onClick={() => setIsRequirementModalOpen(false)} className="w-full sm:w-auto">Cancel</Button>
                      <Button onClick={() => setActiveRequirementTab('details')} className="w-full sm:w-auto">Next</Button>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="details">
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="requirementDueDate">Due Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={`w-full justify-start text-left font-normal ${!newTask.dueDate && 'text-muted-foreground'}`}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {newTask.dueDate ? format(new Date(newTask.dueDate), 'PPP') : <span>Pick a date</span>}
                      </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <CalendarComponent
                            mode="single"
                            selected={newTask.dueDate ? new Date(newTask.dueDate) : undefined}
                            onSelect={(date) => setNewTask({ ...newTask, dueDate: date ? date.toISOString().split('T')[0] : '' })}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="requirementAssignedTo">Assigned To</Label>
                      <Input
                        id="requirementAssignedTo"
                        value={visitDetail ? `${visitDetail.employeeName}` : ''}
                        disabled
                        className="w-full bg-gray-100 text-foreground font-medium cursor-not-allowed"
                      />
                </div>
                    <div className="space-y-2">
                      <Label htmlFor="requirementPriority">Priority</Label>
                      <Select value={newTask.priority} onValueChange={(value) => setNewTask({ ...newTask, priority: value as Priority })}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a priority" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
              </div>
                    <div className="flex flex-col sm:flex-row justify-between gap-2 mt-4">
                      <Button variant="outline" onClick={() => setActiveRequirementTab('general')} className="w-full sm:w-auto">Back</Button>
                      <Button onClick={() => createTask('requirement')} className="w-full sm:w-auto">Create Requirement</Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Complaint Modal */}
      {isComplaintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-2xl border-0 shadow-lg max-h-[90vh] overflow-y-auto">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg md:text-xl font-semibold text-foreground">Create Complaint</CardTitle>
              <p className="text-xs md:text-sm text-muted-foreground">Fill in the complaint details</p>
            </CardHeader>
            <CardContent>
              <Tabs value={activeComplaintTab} onValueChange={setActiveComplaintTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="general">General</TabsTrigger>
                  <TabsTrigger value="details">Details</TabsTrigger>
                </TabsList>
                
                <TabsContent value="general">
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="complaintTitle">Complaint Title</Label>
                      <Input
                        id="complaintTitle"
                        placeholder="Enter complaint title"
                        value={complaintTask.taskTitle}
                        onChange={(e) => setComplaintTask({ ...complaintTask, taskTitle: e.target.value })}
                        className="w-full"
                      />
                </div>
                    <div className="space-y-2">
                      <Label htmlFor="complaintDescription">Complaint Description</Label>
                      <Input
                        id="complaintDescription"
                        placeholder="Enter complaint description"
                        value={complaintTask.taskDesciption}
                        onChange={(e) => setComplaintTask({ ...complaintTask, taskDesciption: e.target.value })}
                        className="w-full"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="complaintCategory">Category</Label>
                      <Select value="complaint" disabled>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Complaint" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="complaint">Complaint</SelectItem>
                        </SelectContent>
                      </Select>
                </div>
                    <div className="space-y-2">
                      <Label htmlFor="complaintStoreName">Store</Label>
                      <Input
                        id="complaintStoreName"
                        value={visitDetail ? `${visitDetail.storeName}` : 'Loading...'}
                        disabled
                        className="w-full bg-gray-100 text-foreground font-medium cursor-not-allowed"
                      />
              </div>
                    <div className="flex flex-col sm:flex-row justify-between gap-2 mt-4">
                      <Button variant="outline" onClick={() => setIsComplaintModalOpen(false)} className="w-full sm:w-auto">Cancel</Button>
                      <Button onClick={() => setActiveComplaintTab('details')} className="w-full sm:w-auto">Next</Button>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="details">
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="complaintDueDate">Due Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
              <Button 
                variant="outline"
                            className={`w-full justify-start text-left font-normal ${!complaintTask.dueDate && 'text-muted-foreground'}`}
              >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {complaintTask.dueDate ? format(new Date(complaintTask.dueDate), 'PPP') : <span>Pick a date</span>}
              </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <CalendarComponent
                            mode="single"
                            selected={complaintTask.dueDate ? new Date(complaintTask.dueDate) : undefined}
                            onSelect={(date) => setComplaintTask({ ...complaintTask, dueDate: date ? date.toISOString().split('T')[0] : '' })}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
            </div>
                    <div className="space-y-2">
                      <Label htmlFor="complaintAssignedTo">Assigned To</Label>
                      <Input
                        id="complaintAssignedTo"
                        value={visitDetail ? `${visitDetail.employeeName}` : ''}
                        disabled
                        className="w-full bg-gray-100 text-foreground font-medium cursor-not-allowed"
                      />
          </div>
                    <div className="space-y-2">
                      <Label htmlFor="complaintPriority">Priority</Label>
                      <Select value={complaintTask.priority} onValueChange={(value) => setComplaintTask({ ...complaintTask, priority: value as Priority })}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a priority" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col sm:flex-row justify-between gap-2 mt-4">
                      <Button variant="outline" onClick={() => setActiveComplaintTab('general')} className="w-full sm:w-auto">Back</Button>
                      <Button onClick={() => createTask('complaint')} className="w-full sm:w-auto">Create Complaint</Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewVisible && previewImage && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" onClick={() => setPreviewVisible(false)}>
          <div className="relative max-w-4xl max-h-4xl p-4">
            <Image 
              src={previewImage} 
              alt="Preview Image" 
              width={800}
              height={600}
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              className="absolute top-2 right-2 bg-white rounded-full p-2 hover:bg-gray-100"
              onClick={() => setPreviewVisible(false)}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
