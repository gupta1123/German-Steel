"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Download,
  Filter,
  FileText,
  Gift,
  IndianRupee,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  Save,
  Send,
  UserCheck,
  XCircle,
} from "lucide-react";
import { endOfMonth, format, startOfMonth } from "date-fns";

import { useAuth } from "@/components/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  ATTENDEE_CATEGORIES,
  AttendancePayload,
  CorrectionStage,
  EXPENSE_HEADS,
  FinalReportPayload,
  formatMeetingStatus,
  getMeetingStageLabel,
  getMeetingStatusLabel,
  hasMeetingAction,
  isMeetingTabEnabled,
  Meeting,
  MeetingAuditHistory,
  MeetingAttendee,
  MeetingConfigItem,
  MeetingExpense,
  MeetingFilters,
  MeetingGift,
  MeetingTabs,
  MEETING_TYPES,
  meetingsApi,
} from "@/lib/meetings-api";
import { hasAdminSetupPrivileges } from "@/lib/auth";
import { formatTimeTo12Hour } from "@/lib/utils";

type WorkflowTab = keyof MeetingTabs;
type AdminReviewTab = "details" | "attendees" | "gifts" | "expenses" | "finalReport" | "history";
type AdminMeetingTone = "neutral" | "warning" | "success" | "danger";
type AdminMeetingPresentation = {
  tabs: Array<{ key: AdminReviewTab; label: string }>;
  defaultTab: AdminReviewTab;
  isPostMeeting: boolean;
  giftComparisonReady: boolean;
  expenseComparisonReady: boolean;
  showFinalReportContent: boolean;
  showFinalReportAwaiting: boolean;
  notice: { title: string; detail: string; tone: AdminMeetingTone };
};
type ApprovalDecision = "approve" | "correction" | "reject";
type FinalReviewDecision = "approveClose" | "correction";

type ReportFilterState = {
  start: string;
  end: string;
  status: string;
  meetingType: string;
  city: string;
  state: string;
};

type ReportView =
  | "summary"
  | "expenses"
  | "gifts"
  | "dealer"
  | "city"
  | "officer"
  | "market";

type RequestForm = {
  meetingType: string;
  meetingDate: string;
  meetingTime: string;
  city: string;
  state: string;
  location: string;
  customerReference: string;
  expectedAttendees: string;
  expectedBudget: string;
  companyContribution: string;
  allowWalkInAttendees: boolean;
};

type ExecutionForm = {
  actualMeetingDate: string;
  actualMeetingTime: string;
  actualLocation: string;
  executionRemarks: string;
};

const WORKFLOW_TABS: Array<{ key: WorkflowTab; label: string }> = [
  { key: "request", label: "Request" },
  { key: "attendees", label: "Attendees" },
  { key: "execution", label: "Attendance" },
  { key: "gifts", label: "Gifts" },
  { key: "expenses", label: "Expenses" },
  { key: "finalReport", label: "Report" },
];

const REPORT_ALL_VALUE = "all";
const REPORT_STATUS_OPTIONS = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "EXECUTED",
  "EXPENSE_SUBMITTED",
  "REPORT_SUBMITTED",
  "CLOSED",
  "CORRECTION_REQUIRED",
  "REJECTED",
  "CANCELLED",
];

const REPORT_VIEW_OPTIONS: Array<{ key: ReportView; label: string }> = [
  { key: "summary", label: "Meeting Summary" },
  { key: "expenses", label: "Planned vs Actual Expenses" },
  { key: "gifts", label: "Planned vs Issued Gifts" },
  { key: "dealer", label: "Dealer Performance" },
  { key: "city", label: "City Performance" },
  { key: "officer", label: "Field Officer Performance" },
  { key: "market", label: "Market Database" },
];

const CORRECTION_STAGE_OPTIONS: Array<{ value: CorrectionStage; label: string }> = [
  { value: "REQUEST", label: "Request plan" },
  { value: "ATTENDEES", label: "Attendees" },
  { value: "ATTENDANCE", label: "Attendance data" },
  { value: "GIFTS", label: "Gifts" },
  { value: "EXPENSES", label: "Expenses" },
  { value: "LEADS", label: "Leads" },
  { value: "FINAL_REPORT", label: "Final Report" },
];

const formatCurrency = (amount?: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(amount || 0));

const formatSignedCurrency = (amount?: number) => {
  const value = Number(amount || 0);
  return `${value > 0 ? "+" : ""}${formatCurrency(value)}`;
};

const formatSignedNumber = (amount?: number) => {
  const value = Number(amount || 0);
  return `${value > 0 ? "+" : ""}${value}`;
};

const formatDate = (value?: string) => {
  if (!value) return "-";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return format(parsed, "dd MMM yyyy");
};

const timeForInput = (value?: string) => (value ? value.slice(0, 5) : "");
const timeForApi = (value: string) => (value.length === 5 ? `${value}:00` : value);
const formatMeetingTime = (value?: string) => (value ? formatTimeTo12Hour(value) || value : "-");
const cleanMobile = (value?: string) => String(value || "").replace(/\D/g, "");

const emptyReportFilters = (): ReportFilterState => ({
  start: "",
  end: "",
  status: REPORT_ALL_VALUE,
  meetingType: REPORT_ALL_VALUE,
  city: "",
  state: "",
});

const reportFiltersFromMeeting = (meeting: Meeting): ReportFilterState => {
  const filters = emptyReportFilters();
  if (meeting.meetingDate) {
    const parsed = new Date(`${meeting.meetingDate}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      filters.start = format(startOfMonth(parsed), "yyyy-MM-dd");
      filters.end = format(endOfMonth(parsed), "yyyy-MM-dd");
    }
  }
  return filters;
};

const currentMeetingReportFilters = (meeting: Meeting): ReportFilterState => ({
  start: meeting.meetingDate || "",
  end: meeting.meetingDate || "",
  status: meeting.status || REPORT_ALL_VALUE,
  meetingType: meeting.meetingType || REPORT_ALL_VALUE,
  city: meeting.city || "",
  state: meeting.state || "",
});

const reportFiltersForApi = (filters: ReportFilterState): MeetingFilters => ({
  start: filters.start || undefined,
  end: filters.end || undefined,
  status: filters.status === REPORT_ALL_VALUE ? undefined : filters.status,
  meetingType: filters.meetingType === REPORT_ALL_VALUE ? undefined : filters.meetingType,
  city: filters.city.trim() || undefined,
  state: filters.state.trim() || undefined,
});

const statusBadgeClass = (status?: string) => {
  switch (status) {
    case "APPROVED":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "PENDING_APPROVAL":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "EXECUTED":
    case "EXPENSE_SUBMITTED":
    case "REPORT_SUBMITTED":
      return "border-purple-200 bg-purple-50 text-purple-700";
    case "CLOSED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "REJECTED":
    case "CANCELLED":
      return "border-red-200 bg-red-50 text-red-700";
    case "CORRECTION_REQUIRED":
      return "border-orange-200 bg-orange-50 text-orange-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
};

const POST_MEETING_STATUSES = new Set(["EXECUTED", "EXPENSE_SUBMITTED", "REPORT_SUBMITTED", "CLOSED"]);
const POST_MEETING_CORRECTION_STAGES = new Set(["ATTENDANCE", "GIFTS", "EXPENSES", "LEADS", "FINAL_REPORT"]);
const FINAL_REPORT_STATUSES = new Set(["REPORT_SUBMITTED", "CLOSED"]);

const ADMIN_TAB_LABELS: Record<AdminReviewTab, string> = {
  details: "Request",
  attendees: "Attendees",
  gifts: "Gifts",
  expenses: "Expenses",
  finalReport: "Report",
  history: "History",
};

const correctionStageLabel = (stage?: string | null) => {
  const labels: Record<string, string> = {
    REQUEST: "Request Plan",
    ATTENDEES: "Named Attendees",
    ATTENDANCE: "Attendance",
    GIFTS: "Gifts",
    EXPENSES: "Expenses",
    LEADS: "Leads",
    FINAL_REPORT: "Final Report",
  };
  return labels[String(stage || "")] || "Meeting details";
};

const correctionStageTab = (stage?: string | null): AdminReviewTab => {
  switch (stage) {
    case "ATTENDEES":
    case "ATTENDANCE":
      return "attendees";
    case "GIFTS":
      return "gifts";
    case "EXPENSES":
      return "expenses";
    case "LEADS":
    case "FINAL_REPORT":
      return "finalReport";
    default:
      return "details";
  }
};

const getAdminMeetingPresentation = (meeting: Meeting): AdminMeetingPresentation => {
  const status = String(meeting.status || "");
  const correctionReturnStatus = String(meeting.correctionReturnStatus || "");
  const isCorrection = status === "CORRECTION_REQUIRED";
  const isPostMeetingCorrection =
    isCorrection &&
    (POST_MEETING_STATUSES.has(correctionReturnStatus) || POST_MEETING_CORRECTION_STAGES.has(String(meeting.correctionStage || "")));
  const isPostMeeting = POST_MEETING_STATUSES.has(status) || isPostMeetingCorrection;
  const giftComparisonReady = meeting.giftsCompleted === true || meeting.noGifts === true;
  const expenseComparisonReady = meeting.expensesCompleted === true || meeting.noExpenses === true;
  const showFinalReportContent =
    FINAL_REPORT_STATUSES.has(status) ||
    (isPostMeetingCorrection && hasFinalReportContent(meeting));
  const showFinalReportAwaiting =
    status === "EXPENSE_SUBMITTED" ||
    (isPostMeetingCorrection && correctionReturnStatus === "EXPENSE_SUBMITTED" && !showFinalReportContent);

  const tabKeys: AdminReviewTab[] = ["details", "attendees"];
  if (isPostMeeting) tabKeys.push("gifts", "expenses");
  if (showFinalReportContent || showFinalReportAwaiting) tabKeys.push("finalReport");
  tabKeys.push("history");

  let defaultTab: AdminReviewTab = "details";
  if (status === "EXECUTED") defaultTab = "attendees";
  if (status === "EXPENSE_SUBMITTED") defaultTab = "expenses";
  if (status === "REPORT_SUBMITTED" || status === "CLOSED") defaultTab = "finalReport";
  if (isCorrection) defaultTab = correctionStageTab(meeting.correctionStage);
  if (!tabKeys.includes(defaultTab)) defaultTab = "details";

  let notice: AdminMeetingPresentation["notice"];
  switch (status) {
    case "DRAFT":
      notice = { title: "Draft request", detail: "The field team is still preparing this plan. No admin decision is required yet.", tone: "neutral" };
      break;
    case "PENDING_APPROVAL":
      notice = { title: "Ready for approval", detail: "Review the complete request plan, expected people, named attendees, planned gifts, expenses, and contribution before deciding.", tone: "warning" };
      break;
    case "APPROVED":
      notice = { title: "Scheduled for execution", detail: "The request is approved. Attendance, gifts, and actual expenses will appear after the field team conducts the meeting.", tone: "success" };
      break;
    case "EXECUTED":
      notice = { title: "Meeting conducted", detail: "Attendance is available. Gift and expense differences will become final only after those sections are completed.", tone: "neutral" };
      break;
    case "EXPENSE_SUBMITTED":
      {
        const incompleteSections = [
          meeting.attendanceFinalized !== true ? "attendance" : "",
          !giftComparisonReady ? "gifts" : "",
          !expenseComparisonReady ? "expenses" : "",
        ].filter(Boolean);
        notice = incompleteSections.length
          ? {
              title: "Final report pending with incomplete sections",
              detail: `The workflow is waiting for the final report, but ${incompleteSections.join(", ")} ${incompleteSections.length === 1 ? "is" : "are"} not marked complete by the backend.`,
              tone: "warning",
            }
          : {
              title: "Post-meeting sections complete",
              detail: "Attendance, gifts, and expenses are finalized. The final report is now awaited from the field team.",
              tone: "neutral",
            };
      }
      break;
    case "REPORT_SUBMITTED":
      notice = { title: "Ready for final review", detail: "Compare the approved plan with the actual outcome, then approve and close or request a section correction.", tone: "warning" };
      break;
    case "CLOSED":
      {
        const missingCompletionFlags = [
          meeting.attendanceFinalized !== true ? "attendance" : "",
          !giftComparisonReady ? "gifts" : "",
          !expenseComparisonReady ? "expenses" : "",
        ].filter(Boolean);
        notice = missingCompletionFlags.length
          ? {
              title: "Closed record with missing completion data",
              detail:
                missingCompletionFlags.length === 1
                  ? `This meeting is read-only, but the ${missingCompletionFlags[0]} completion flag is not recorded. Saved actual values are shown without final variance conclusions.`
                  : `This meeting is read-only, but completion flags for ${missingCompletionFlags.join(", ")} are not recorded. Saved actual values are shown without final variance conclusions.`,
              tone: "warning",
            }
          : {
              title: "Meeting closed",
              detail: "This is the final read-only meeting record. Review the final report, comparisons, and history as needed.",
              tone: "success",
            };
      }
      break;
    case "CORRECTION_REQUIRED":
      notice = {
        title: `${correctionStageLabel(meeting.correctionStage)} correction requested`,
        detail: meeting.correctionRemarks || "The field team must correct this section and resubmit it before the workflow can continue.",
        tone: "warning",
      };
      break;
    case "REJECTED":
      notice = { title: "Meeting rejected", detail: meeting.rejectionReason || meeting.approvalRemarks || "This request will not move forward.", tone: "danger" };
      break;
    case "CANCELLED":
      notice = { title: "Meeting cancelled", detail: meeting.cancellationReason || meeting.cancellationRemarks || "This meeting will not move forward.", tone: "danger" };
      break;
    default:
      notice = { title: getMeetingStatusLabel(meeting), detail: "Review the available meeting information and history for the current stage.", tone: "neutral" };
  }

  return {
    tabs: tabKeys.map((key) => ({ key, label: key === "attendees" && isPostMeeting ? "Attendance" : ADMIN_TAB_LABELS[key] })),
    defaultTab,
    isPostMeeting,
    giftComparisonReady,
    expenseComparisonReady,
    showFinalReportContent,
    showFinalReportAwaiting,
    notice,
  };
};

const isPostMeetingStatus = (status?: string) => POST_MEETING_STATUSES.has(String(status || ""));

const getActualAttendanceCount = (meeting: Meeting) =>
  meeting.actualAttendeeCount ?? (meeting.attendees || []).filter((attendee) => attendee.present).length;

const hasFinalReportContent = (meeting: Meeting) =>
  Boolean(
    meeting.meetingSummary ||
      meeting.keyDiscussionPoints ||
      meeting.leadsGenerated ||
      meeting.leadCount ||
      meeting.leadDetails ||
      meeting.interestedCustomers ||
      meeting.competitorInformation ||
      meeting.actualBusinessOutcome ||
      meeting.finalReportApprovalRemarks
  );

const normalizeConfigNames = (items: MeetingConfigItem[] | string[] | undefined, fallback: readonly string[]) => {
  if (!items?.length) return [...fallback];
  const names = items
    .map((item) => (typeof item === "string" ? item : item.active === false ? "" : item.name))
    .map((name) => name.trim())
    .filter(Boolean);
  return names.length ? Array.from(new Set(names)) : [...fallback];
};

const withCurrentOption = (options: string[], current?: string | null) => {
  const trimmed = String(current || "").trim();
  if (!trimmed || options.includes(trimmed)) return options;
  return [...options, trimmed];
};

const parsePlanArray = <T,>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
};

const splitPlainPlanItems = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    JSON.parse(value);
    return [];
  } catch {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
};

const normalizeGroupKey = (value?: string | null) => String(value || "Other").trim() || "Other";

const getPlannedExpenses = (meeting: Meeting): MeetingExpense[] =>
  parsePlanArray<MeetingExpense>(meeting.plan?.plannedExpenseDetails);

const getPlannedGifts = (meeting: Meeting): MeetingGift[] => {
  const detailed = parsePlanArray<MeetingGift>(meeting.plan?.plannedGiftDetails);
  if (detailed.length) return detailed;

  const expected = parsePlanArray<MeetingGift>(meeting.plan?.expectedGiftsMaterials);
  if (expected.length) return expected;

  const directExpected = parsePlanArray<MeetingGift>(meeting.expectedGiftsMaterials);
  if (directExpected.length) return directExpected;

  return splitPlainPlanItems(meeting.expectedGiftsMaterials || meeting.plan?.expectedGiftsMaterials).map((giftItem) => ({
    giftItem,
    quantity: 0,
  }));
};

const getExpenseComparisonRows = (meeting: Meeting) => {
  const rowMap = new Map<
    string,
    { head: string; planned: number; actual: number; company: number; dealer: number; difference: number }
  >();

  getPlannedExpenses(meeting).forEach((expense) => {
    const head = normalizeGroupKey(expense.expenseHead);
    const row = rowMap.get(head) || { head, planned: 0, actual: 0, company: 0, dealer: 0, difference: 0 };
    row.planned += Number(expense.amount || 0);
    rowMap.set(head, row);
  });

  (meeting.expenses || []).forEach((expense) => {
    const head = normalizeGroupKey(expense.expenseHead);
    const row = rowMap.get(head) || { head, planned: 0, actual: 0, company: 0, dealer: 0, difference: 0 };
    const amount = Number(expense.amount || 0);
    row.actual += amount;
    row.company += Number(expense.companyAmount ?? (expense.paidBy === "COMPANY" ? amount : 0) ?? 0);
    row.dealer += Number(expense.dealerAmount ?? (expense.paidBy === "DEALER" ? amount : 0) ?? 0);
    rowMap.set(head, row);
  });

  return Array.from(rowMap.values())
    .map((row) => ({ ...row, difference: row.actual - row.planned }))
    .sort((a, b) => a.head.localeCompare(b.head));
};

const getGiftComparisonRows = (meeting: Meeting) => {
  const rowMap = new Map<string, { item: string; planned: number; issued: number; difference: number; estimatedAmount: number }>();

  getPlannedGifts(meeting).forEach((gift) => {
    const item = normalizeGroupKey(gift.giftItem);
    const row = rowMap.get(item) || { item, planned: 0, issued: 0, difference: 0, estimatedAmount: 0 };
    row.planned += Number(gift.quantity || 0);
    row.estimatedAmount += Number(gift.estimatedAmount || 0);
    rowMap.set(item, row);
  });

  (meeting.gifts || []).forEach((gift) => {
    const item = normalizeGroupKey(gift.giftItem);
    const row = rowMap.get(item) || { item, planned: 0, issued: 0, difference: 0, estimatedAmount: 0 };
    row.issued += Number(gift.quantity || 0);
    rowMap.set(item, row);
  });

  return Array.from(rowMap.values())
    .map((row) => ({ ...row, difference: row.issued - row.planned }))
    .sort((a, b) => a.item.localeCompare(b.item));
};

const isGiftExpenseHead = (value?: string | null) => normalizeGroupKey(value).toLowerCase() === "gifts";

const getCalculatedGiftExpenseTotal = (meeting: Meeting) => {
  const issuedByItem = new Map<string, number>();
  (meeting.gifts || []).forEach((gift) => {
    const item = normalizeGroupKey(gift.giftItem).toLowerCase();
    issuedByItem.set(item, (issuedByItem.get(item) || 0) + Number(gift.quantity || 0));
  });

  return getPlannedGifts(meeting).reduce((total, gift) => {
    const plannedQuantity = Number(gift.quantity || 0);
    const estimatedTotal = Number(gift.estimatedAmount || 0);
    if (plannedQuantity <= 0 || estimatedTotal <= 0) return total;
    const issuedQuantity = issuedByItem.get(normalizeGroupKey(gift.giftItem).toLowerCase()) || 0;
    return total + (estimatedTotal / plannedQuantity) * issuedQuantity;
  }, 0);
};

const getMeetingActualExpenseTotal = (meeting: Meeting) =>
  (meeting.expenses || []).reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

const getMeetingCompanyPaidTotal = (meeting: Meeting) =>
  (meeting.expenses || []).reduce((sum, expense) => {
    const fallbackAmount = expense.paidBy === "COMPANY" ? expense.amount : 0;
    return sum + Number(expense.companyAmount ?? fallbackAmount ?? 0);
  }, 0);

const getMeetingDealerPaidTotal = (meeting: Meeting) =>
  (meeting.expenses || []).reduce((sum, expense) => {
    const fallbackAmount = expense.paidBy === "DEALER" ? expense.amount : 0;
    return sum + Number(expense.dealerAmount ?? fallbackAmount ?? 0);
  }, 0);

const getMeetingIssuedGiftQuantity = (meeting: Meeting) =>
  (meeting.gifts || []).reduce((sum, gift) => sum + Number(gift.quantity || 0), 0);

const getMeetingDealerLabel = (meeting: Meeting) =>
  meeting.storeName || meeting.dealerName || meeting.customerReference || "Unassigned";

const getReportExpenseRows = (meetings: Meeting[]) => {
  const rowMap = new Map<
    string,
    { head: string; planned: number; actual: number; company: number; dealer: number; difference: number }
  >();

  meetings.forEach((meeting) => {
    getExpenseComparisonRows(meeting).forEach((expense) => {
      const row = rowMap.get(expense.head) || {
        head: expense.head,
        planned: 0,
        actual: 0,
        company: 0,
        dealer: 0,
        difference: 0,
      };
      row.planned += expense.planned;
      row.actual += expense.actual;
      row.company += expense.company;
      row.dealer += expense.dealer;
      rowMap.set(expense.head, row);
    });
  });

  return Array.from(rowMap.values())
    .map((row) => ({ ...row, difference: row.actual - row.planned }))
    .sort((a, b) => b.actual - a.actual);
};

const getReportGiftRows = (meetings: Meeting[]) => {
  const rowMap = new Map<string, { item: string; planned: number; issued: number; difference: number; estimatedAmount: number }>();

  meetings.forEach((meeting) => {
    getGiftComparisonRows(meeting).forEach((gift) => {
      const row = rowMap.get(gift.item) || {
        item: gift.item,
        planned: 0,
        issued: 0,
        difference: 0,
        estimatedAmount: 0,
      };
      row.planned += gift.planned;
      row.issued += gift.issued;
      row.estimatedAmount += gift.estimatedAmount;
      rowMap.set(gift.item, row);
    });
  });

  return Array.from(rowMap.values())
    .map((row) => ({ ...row, difference: row.issued - row.planned }))
    .sort((a, b) => b.issued - a.issued);
};

const getReportPerformanceRows = (meetings: Meeting[], groupBy: (meeting: Meeting) => string) => {
  const rowMap = new Map<
    string,
    {
      label: string;
      meetings: number;
      expectedBudget: number;
      actualExpenses: number;
      expectedTurnout: number;
      actualAttendance: number;
      giftsIssued: number;
      leads: number;
    }
  >();

  meetings.forEach((meeting) => {
    const label = groupBy(meeting) || "Unassigned";
    const row = rowMap.get(label) || {
      label,
      meetings: 0,
      expectedBudget: 0,
      actualExpenses: 0,
      expectedTurnout: 0,
      actualAttendance: 0,
      giftsIssued: 0,
      leads: 0,
    };
    row.meetings += 1;
    row.expectedBudget += Number(meeting.expectedBudget || 0);
    row.actualExpenses += getMeetingActualExpenseTotal(meeting);
    row.expectedTurnout += Number(meeting.expectedAttendees || meeting.attendees?.length || 0);
    row.actualAttendance += getActualAttendanceCount(meeting);
    row.giftsIssued += getMeetingIssuedGiftQuantity(meeting);
    row.leads += Number(meeting.leadCount || 0);
    rowMap.set(label, row);
  });

  return Array.from(rowMap.values()).sort((a, b) => b.meetings - a.meetings || a.label.localeCompare(b.label));
};

const getMarketDatabaseRows = (meetings: Meeting[]) => {
  const rowMap = new Map<
    string,
    {
      name: string;
      mobile: string;
      category: string;
      cityArea: string;
      companyShopProject: string;
      meetingType: string;
      dealer: string;
      status: string;
    }
  >();

  meetings.forEach((meeting) => {
    (meeting.attendees || []).forEach((attendee) => {
      const mobile = cleanMobile(attendee.mobileNumber);
      const key = mobile || `${meeting.id}-${attendee.name}-${attendee.category}`;
      if (rowMap.has(key)) return;
      rowMap.set(key, {
        name: attendee.name || "-",
        mobile: mobile || "-",
        category: attendee.category || "-",
        cityArea: attendee.cityArea || meeting.city || "-",
        companyShopProject: attendee.companyShopProject || "-",
        meetingType: meeting.meetingType || "-",
        dealer: getMeetingDealerLabel(meeting),
        status: attendee.present ? "Present" : attendee.expected === false ? "Walk-in" : "Expected",
      });
    });
  });

  return Array.from(rowMap.values()).sort((a, b) => a.name.localeCompare(b.name));
};

const getDraftMissingItems = (meeting: Meeting) => {
  const missing: string[] = [];
  if (!meeting.meetingType) missing.push("meeting type");
  if (!meeting.meetingDate) missing.push("date");
  if (!meeting.meetingTime) missing.push("time");
  if (!meeting.city) missing.push("city");
  if (!meeting.state) missing.push("state");
  if (!meeting.location) missing.push("location");
  if (meeting.expectedBudget == null) missing.push("expected budget");
  if (!meeting.attendees?.length) missing.push("named attendees");
  return missing;
};

const requestFormFromMeeting = (meeting: Meeting): RequestForm => ({
  meetingType: meeting.meetingType || "Dealer",
  meetingDate: meeting.meetingDate || "",
  meetingTime: timeForInput(meeting.meetingTime),
  city: meeting.city || "",
  state: meeting.state || "",
  location: meeting.location || "",
  customerReference: meeting.customerReference || "",
  expectedAttendees: meeting.expectedAttendees == null ? "" : String(meeting.expectedAttendees),
  expectedBudget: meeting.expectedBudget == null ? "" : String(meeting.expectedBudget),
  companyContribution: meeting.plan?.companyContribution == null ? "" : String(meeting.plan.companyContribution),
  allowWalkInAttendees: meeting.allowWalkInAttendees !== false,
});

const attendeeDraft = (): MeetingAttendee => ({
  name: "",
  mobileNumber: "",
  email: "",
  category: "mason",
  cityArea: "",
  companyShopProject: "",
  expected: true,
  categoryDetails: "",
  remarks: "",
});

const expenseDraft = (date?: string): MeetingExpense => ({
  expenseHead: "food/snacks",
  amount: 0,
  expenseDate: date || "",
});

const giftDraft = (meetingAttendeeId?: number): MeetingGift => ({
  meetingAttendeeId,
  giftItem: "",
  quantity: 1,
});

const getDuplicateMobileError = (attendees: MeetingAttendee[]) => {
  const seen = new Set<string>();
  for (const attendee of attendees) {
    const mobile = cleanMobile(attendee.mobileNumber);
    if (!mobile) continue;
    if (seen.has(mobile)) return `Mobile number ${mobile} is duplicated in this meeting.`;
    seen.add(mobile);
  }
  return null;
};

const normaliseAttendees = (attendees: MeetingAttendee[]) =>
  attendees
    .map((attendee) => ({
      ...attendee,
      name: attendee.name.trim(),
      mobileNumber: cleanMobile(attendee.mobileNumber),
      email: attendee.email?.trim() || undefined,
      cityArea: attendee.cityArea?.trim() || undefined,
      companyShopProject: attendee.companyShopProject?.trim() || undefined,
      categoryDetails: attendee.categoryDetails?.trim() || undefined,
      remarks: attendee.remarks?.trim() || undefined,
      expected: attendee.expected !== false,
    }))
    .filter((attendee) => attendee.name || attendee.mobileNumber);

function ReadOnlyField({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 break-words text-sm font-medium">{value ?? "-"}</div>
    </div>
  );
}

function LockedPanel({ label }: { label: string }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center text-muted-foreground">
      <Lock className="h-6 w-6" />
      <div className="text-sm">{label}</div>
    </div>
  );
}

function MeetingDetailCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="gap-0 rounded-lg border-border/80 py-0 shadow-sm transition-colors hover:border-border hover:bg-muted/10">
      <CardHeader className="px-8 pb-0 pt-8">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="text-primary">{icon}</span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-8 pb-8 pt-5">{children}</CardContent>
    </Card>
  );
}

function MeetingDataRow({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div className="grid items-center gap-2 border-b border-border/50 py-3 last:border-b-0 sm:grid-cols-[160px_1fr]">
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="break-words text-sm font-semibold text-foreground">{value ?? "-"}</dd>
    </div>
  );
}

function MeetingNoteBlock({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="whitespace-pre-wrap break-words text-sm font-semibold leading-6 text-foreground">{value ?? "-"}</dd>
    </div>
  );
}

const getInitials = (name?: string) => {
  const words = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "-";
  return words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join("");
};

function GiftAttendeeCell({
  name,
  isWalkIn,
}: {
  name?: string;
  isWalkIn?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
        isWalkIn
          ? "border-primary/25 bg-primary/10 text-primary"
          : "border-border bg-muted text-foreground"
      }`}>
        {getInitials(name)}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-foreground">{name || "-"}</span>
          {isWalkIn && (
            <Badge variant="outline" className="border-primary/25 bg-primary/10 text-primary">
              Walk-in
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

function QuantityChip({ value }: { value?: number }) {
  return (
    <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-md border bg-muted px-2 text-sm font-bold text-foreground">
      {Number(value || 0)}
    </span>
  );
}

function AdminStageNotice({ notice }: { notice: AdminMeetingPresentation["notice"] }) {
  const toneClass: Record<AdminMeetingTone, string> = {
    neutral: "border-border bg-muted/30 text-foreground",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    danger: "border-red-200 bg-red-50 text-red-900",
  };

  return (
    <div className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${toneClass[notice.tone]}`}>
      {notice.tone === "danger" || notice.tone === "warning" ? (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      ) : notice.tone === "success" ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <FileText className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      <div className="space-y-1">
        <div className="font-bold">{notice.title}</div>
        <div className="text-xs leading-5 opacity-90">{notice.detail}</div>
      </div>
    </div>
  );
}

type AdminSummaryMetric = {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  valueClassName?: string;
};

function AdminSummaryStrip({ metrics }: { metrics: AdminSummaryMetric[] }) {
  return (
    <div className="grid overflow-hidden rounded-lg border border-border/70 bg-card/40 sm:grid-cols-3">
      {metrics.map((metric, index) => (
        <div
          key={metric.label}
          className={`min-w-0 px-4 py-3 ${index < metrics.length - 1 ? "border-b sm:border-b-0 sm:border-r" : ""}`}
        >
          <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{metric.label}</div>
          <div className={`mt-1 truncate text-lg font-extrabold text-foreground ${metric.valueClassName || ""}`}>
            {metric.value}
          </div>
          {metric.detail != null && <div className="mt-1 text-xs text-muted-foreground">{metric.detail}</div>}
        </div>
      ))}
    </div>
  );
}

function ProgressiveSection({
  title,
  summary,
  children,
  defaultOpen = false,
}: {
  title: string;
  summary?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section className="overflow-hidden rounded-lg border border-border/70 bg-card/30">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/30"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
      >
        <div className="min-w-0">
          <div className="text-sm font-bold text-foreground">{title}</div>
          {summary != null && <div className="mt-1 text-xs leading-5 text-muted-foreground">{summary}</div>}
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && <div className="border-t border-border/60 p-5">{children}</div>}
    </section>
  );
}

type MeetingKpiSubMetric = {
  label: string;
  value: ReactNode;
  valueClassName?: string;
};

type MeetingKpiGridProps = {
  status?: string;
  statusValue: ReactNode;
  secondaryLabel: string;
  secondaryValue: ReactNode;
  secondaryClassName?: string;
  financialLabel: string;
  financialValue: ReactNode;
  financialSubMetrics: MeetingKpiSubMetric[];
  attendanceLabel: string;
  attendanceValue: ReactNode;
  attendanceSubMetrics: MeetingKpiSubMetric[];
};

const statusDotClass = (status?: string) => {
  switch (status) {
    case "APPROVED":
      return "bg-blue-500 shadow-blue-500/30";
    case "PENDING_APPROVAL":
    case "DRAFT":
      return "bg-amber-500 shadow-amber-500/30";
    case "EXECUTED":
    case "EXPENSE_SUBMITTED":
    case "REPORT_SUBMITTED":
      return "bg-purple-500 shadow-purple-500/30";
    case "CLOSED":
      return "bg-emerald-500 shadow-emerald-500/30";
    case "REJECTED":
    case "CANCELLED":
      return "bg-red-500 shadow-red-500/30";
    case "CORRECTION_REQUIRED":
      return "bg-orange-500 shadow-orange-500/30";
    default:
      return "bg-muted-foreground shadow-muted-foreground/20";
  }
};

function KpiSubMetrics({ metrics }: { metrics: MeetingKpiSubMetric[] }) {
  return (
    <div className={`grid border-t bg-muted/20 ${metrics.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
      {metrics.map((metric, index) => (
        <div key={metric.label} className={`px-5 py-3 ${index > 0 ? "border-l" : ""}`}>
          <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{metric.label}</div>
          <div className={`mt-1 text-sm font-bold text-foreground ${metric.valueClassName || ""}`}>{metric.value ?? "-"}</div>
        </div>
      ))}
    </div>
  );
}

function MeetingKpiGrid({
  status,
  statusValue,
  secondaryLabel,
  secondaryValue,
  secondaryClassName = "",
  financialLabel,
  financialValue,
  financialSubMetrics,
  attendanceLabel,
  attendanceValue,
  attendanceSubMetrics,
}: MeetingKpiGridProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {/* Status Card */}
      <Card className="rounded-xl border border-border/30 bg-card/40 backdrop-blur-md p-4 shadow-sm hover:border-border/60 transition-all">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Status</span>
          <Badge variant="outline" className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${statusBadgeClass(status)}`}>
            {statusValue}
          </Badge>
        </div>
        <div className="mt-2.5 flex items-center justify-between text-xs">
          <span className="text-muted-foreground font-semibold">{secondaryLabel}</span>
          <span className="font-extrabold text-foreground">{secondaryValue}</span>
        </div>
      </Card>

      {/* Financial Card */}
      <Card className="rounded-xl border border-border/30 bg-card/40 backdrop-blur-md p-4 shadow-sm hover:border-border/60 transition-all">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{financialLabel}</div>
            <div className="mt-0.5 text-xl font-extrabold text-foreground tracking-tight whitespace-nowrap">{financialValue}</div>
          </div>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-600">
            <IndianRupee className="h-4.5 w-4.5" />
          </div>
        </div>
        {financialSubMetrics && financialSubMetrics.length > 0 && (
          <div className="mt-2 flex items-center justify-between text-[11px] border-t border-border/20 pt-1.5">
            <span className="text-muted-foreground">{financialSubMetrics[0].label}: <strong className="text-foreground">{financialSubMetrics[0].value}</strong></span>
            {financialSubMetrics[1] && (
              <span className="text-muted-foreground">{financialSubMetrics[1].label}: <strong className="text-foreground">{financialSubMetrics[1].value}</strong></span>
            )}
          </div>
        )}
      </Card>

      {/* Attendance Card */}
      <Card className="rounded-xl border border-border/30 bg-card/40 backdrop-blur-md p-4 shadow-sm hover:border-border/60 transition-all">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{attendanceLabel}</div>
            <div className="mt-0.5 text-xl font-extrabold text-foreground tracking-tight whitespace-nowrap">{attendanceValue}</div>
          </div>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
            <UserCheck className="h-4.5 w-4.5" />
          </div>
        </div>
        {attendanceSubMetrics && attendanceSubMetrics.length > 0 && (
          <div className="mt-2 flex items-center justify-between text-[11px] border-t border-border/20 pt-1.5">
            <span className="text-muted-foreground">{attendanceSubMetrics[0].label}: <strong className="text-foreground">{attendanceSubMetrics[0].value}</strong></span>
          </div>
        )}
      </Card>

      {/* Gifts Card */}
      <Card className="rounded-xl border border-border/30 bg-card/40 backdrop-blur-md p-4 shadow-sm hover:border-border/60 transition-all">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{secondaryLabel}</div>
            <div className="mt-0.5 text-xl font-extrabold text-foreground tracking-tight whitespace-nowrap">{secondaryValue}</div>
          </div>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-600">
            <Gift className="h-4.5 w-4.5" />
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] border-t border-border/20 pt-1.5">
          <span className="text-muted-foreground">Allocation Progress</span>
        </div>
      </Card>
    </div>
  );
}

const getExpenseIndicatorClass = (head?: string) => {
  const normalized = String(head || "").toLowerCase();
  if (normalized.includes("food") || normalized.includes("snack")) return "bg-amber-500";
  if (normalized.includes("gift")) return "bg-primary";
  if (normalized.includes("travel")) return "bg-sky-500";
  if (normalized.includes("venue")) return "bg-emerald-500";
  if (normalized.includes("print") || normalized.includes("material")) return "bg-violet-500";
  return "bg-muted-foreground";
};

function ExpenseHeadChip({ head }: { head?: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-sm font-semibold text-foreground">
      <span className={`h-1.5 w-1.5 rounded-full ${getExpenseIndicatorClass(head)}`} />
      {head || "-"}
    </span>
  );
}

function ReportSectionCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border">
      <div className="border-b bg-muted/20 px-5 py-4">
        <h4 className="text-base font-bold">{title}</h4>
      </div>
      <div className="p-0">{children}</div>
    </section>
  );
}

function ReportEmptyState({ label }: { label: string }) {
  return <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">{label}</div>;
}

function ReportPerformanceTable({
  rows,
  labelHeader,
}: {
  rows: Array<{
    label: string;
    meetings: number;
    expectedBudget: number;
    actualExpenses: number;
    expectedTurnout: number;
    actualAttendance: number;
    giftsIssued: number;
    leads: number;
  }>;
  labelHeader: string;
}) {
  if (!rows.length) return <ReportEmptyState label="No report rows found." />;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{labelHeader}</TableHead>
          <TableHead>Meetings</TableHead>
          <TableHead>Budget</TableHead>
          <TableHead>Actual Expense</TableHead>
          <TableHead>Attendance</TableHead>
          <TableHead>Gifts</TableHead>
          <TableHead>Leads</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.label}>
            <TableCell className="font-medium">{row.label}</TableCell>
            <TableCell>{row.meetings}</TableCell>
            <TableCell>{formatCurrency(row.expectedBudget)}</TableCell>
            <TableCell>{formatCurrency(row.actualExpenses)}</TableCell>
            <TableCell>
              {row.actualAttendance}/{row.expectedTurnout}
            </TableCell>
            <TableCell>{row.giftsIssued}</TableCell>
            <TableCell>{row.leads}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function MeetingDetail({ meetingId }: { meetingId: number }) {
  const router = useRouter();
  const { userRole, currentUser } = useAuth();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [activeTab, setActiveTab] = useState<WorkflowTab>("request");
  const [adminTab, setAdminTab] = useState<AdminReviewTab>("details");
  const [activeReportView, setActiveReportView] = useState<ReportView>("summary");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [meetingTypes, setMeetingTypes] = useState<string[]>([...MEETING_TYPES]);
  const [giftItemOptions, setGiftItemOptions] = useState<string[]>([]);
  const [expenseHeadOptions, setExpenseHeadOptions] = useState<string[]>([...EXPENSE_HEADS]);

  const [requestForm, setRequestForm] = useState<RequestForm | null>(null);
  const [attendees, setAttendees] = useState<MeetingAttendee[]>([]);
  const [approvalDecision, setApprovalDecision] = useState<ApprovalDecision>("approve");
  const [approvalRemarks, setApprovalRemarks] = useState("");
  const [correctionStage, setCorrectionStage] = useState<CorrectionStage>("REQUEST");
  const [finalCorrectionStage, setFinalCorrectionStage] = useState<CorrectionStage>("FINAL_REPORT");
  const [auditHistory, setAuditHistory] = useState<MeetingAuditHistory[]>([]);
  const [executionForm, setExecutionForm] = useState<ExecutionForm>({
    actualMeetingDate: "",
    actualMeetingTime: "",
    actualLocation: "",
    executionRemarks: "",
  });
  const [attendance, setAttendance] = useState<Record<number, { present: boolean; remarks: string }>>({});
  const [walkIn, setWalkIn] = useState<MeetingAttendee>(attendeeDraft());
  const [gifts, setGifts] = useState<MeetingGift[]>([]);
  const [expenses, setExpenses] = useState<MeetingExpense[]>([]);
  const [finalReport, setFinalReport] = useState<FinalReportPayload>({
    meetingSummary: "",
    keyDiscussionPoints: "",
    leadsGenerated: "",
    leadCount: undefined,
    leadDetails: "",
    interestedCustomers: "",
    competitorInformation: "",
    actualBusinessOutcome: "",
  });
  const [finalReviewDecision, setFinalReviewDecision] = useState<FinalReviewDecision>("approveClose");
  const [finalApprovalRemarks, setFinalApprovalRemarks] = useState("");
  const [cancelRemarks, setCancelRemarks] = useState("");
  const [isApprovalDecisionOpen, setIsApprovalDecisionOpen] = useState(false);
  const [isFinalReviewDecisionOpen, setIsFinalReviewDecisionOpen] = useState(false);
  const [isCancelMeetingOpen, setIsCancelMeetingOpen] = useState(false);
  const [isExportingReport, setIsExportingReport] = useState(false);
  const [isReportFiltersOpen, setIsReportFiltersOpen] = useState(false);
  const [reportFilters, setReportFilters] = useState<ReportFilterState>(emptyReportFilters);
  const [reportMeetings, setReportMeetings] = useState<Meeting[]>([]);

  const loadConfig = async () => {
    meetingsApi
      .getMeetingTypes()
      .then((items) => setMeetingTypes(normalizeConfigNames(items, MEETING_TYPES)))
      .catch(() => setMeetingTypes([...MEETING_TYPES]));

    meetingsApi
      .getGiftItems()
      .then((items) => setGiftItemOptions(normalizeConfigNames(items, [])))
      .catch(() => setGiftItemOptions([]));

    meetingsApi
      .getExpenseHeads()
      .then((items) => setExpenseHeadOptions(normalizeConfigNames(items, EXPENSE_HEADS)))
      .catch(() => setExpenseHeadOptions([...EXPENSE_HEADS]));
  };

  const loadMeeting = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await meetingsApi.getMeetingById(meetingId);
      setMeeting(data);
      setAdminTab(getAdminMeetingPresentation(data).defaultTab);
      setRequestForm(requestFormFromMeeting(data));
      setAttendees(data.attendees?.length ? data.attendees.map((attendee) => ({ ...attendee })) : [attendeeDraft()]);
      setExecutionForm({
        actualMeetingDate: data.actualMeetingDate || data.meetingDate || "",
        actualMeetingTime: timeForInput(data.actualMeetingTime || data.meetingTime),
        actualLocation: data.actualLocation || data.location || "",
        executionRemarks: data.executionRemarks || "",
      });
      setAttendance(
        (data.attendees || []).reduce<Record<number, { present: boolean; remarks: string }>>((acc, attendee) => {
          if (attendee.id != null) {
            acc[attendee.id] = {
              present: attendee.present === true,
              remarks: attendee.remarks || "",
            };
          }
          return acc;
        }, {})
      );
      setGifts(data.gifts?.length ? data.gifts.map((gift) => ({ ...gift })) : [giftDraft()]);
      const editableExpenses = (data.expenses || []).filter((expense) => !isGiftExpenseHead(expense.expenseHead));
      setExpenses(editableExpenses.length ? editableExpenses.map((expense) => ({ ...expense })) : [expenseDraft(data.actualMeetingDate || data.meetingDate)]);
      setFinalReport({
        meetingSummary: data.meetingSummary || "",
        keyDiscussionPoints: data.keyDiscussionPoints || "",
        leadsGenerated: data.leadsGenerated || "",
        leadCount: data.leadCount,
        leadDetails: data.leadDetails || "",
        interestedCustomers: data.interestedCustomers || "",
        competitorInformation: data.competitorInformation || "",
        actualBusinessOutcome: data.actualBusinessOutcome || "",
      });
      setFinalApprovalRemarks(data.finalReportApprovalRemarks || "");
      setAuditHistory(data.auditHistory || []);
      setReportFilters(currentMeetingReportFilters(data));
      try {
        const reportData = await meetingsApi.getReportById(meetingId);
        setReportMeetings([reportData]);
      } catch {
        setReportMeetings([data]);
      }
      if (!data.auditHistory?.length) {
        meetingsApi.getMeetingAudit(meetingId).then(setAuditHistory).catch(() => setAuditHistory([]));
      }

      const currentTabEnabled = isMeetingTabEnabled(data, activeTab);
      if (!currentTabEnabled) {
        const nextTab = WORKFLOW_TABS.find((tab) => isMeetingTabEnabled(data, tab.key))?.key || "request";
        setActiveTab(nextTab);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load meeting.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
    loadMeeting();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId]);

  const presentAttendees = useMemo(
    () => (meeting?.attendees || []).filter((attendee) => attendee.present === true && attendee.id != null),
    [meeting]
  );

  const totalExpenses = useMemo(
    () => expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
    [expenses]
  );

  const actualExpenseTotal = useMemo(
    () => {
      const detailTotal = (meeting?.expenses || []).reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
      return meeting?.expenses?.length ? detailTotal : Number(meeting?.actualExpenseTotal || 0);
    },
    [meeting]
  );

  const companyPaidTotal = useMemo(
    () =>
      (meeting?.expenses || []).reduce((sum, expense) => {
        const fallbackAmount = expense.paidBy === "COMPANY" ? expense.amount : 0;
        return sum + Number(expense.companyAmount ?? fallbackAmount ?? 0);
      }, 0),
    [meeting]
  );

  const dealerPaidTotal = useMemo(
    () =>
      (meeting?.expenses || []).reduce((sum, expense) => {
        const fallbackAmount = expense.paidBy === "DEALER" ? expense.amount : 0;
        return sum + Number(expense.dealerAmount ?? fallbackAmount ?? 0);
      }, 0),
    [meeting]
  );

  const plannedExpenses = useMemo(() => (meeting ? getPlannedExpenses(meeting) : []), [meeting]);
  const plannedGifts = useMemo(() => (meeting ? getPlannedGifts(meeting) : []), [meeting]);
  const expenseComparisonRows = useMemo(() => (meeting ? getExpenseComparisonRows(meeting) : []), [meeting]);
  const giftComparisonRows = useMemo(() => (meeting ? getGiftComparisonRows(meeting) : []), [meeting]);
  const plannedExpenseTotal = useMemo(
    () => {
      const detailTotal = plannedExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
      return plannedExpenses.length ? detailTotal : Number(meeting?.plannedExpenseTotal || 0);
    },
    [meeting?.plannedExpenseTotal, plannedExpenses]
  );
  const plannedCompanyContribution = Number(meeting?.plan?.companyContribution || 0);
  const plannedDealerContribution = Number(
    meeting?.plan?.dealerContribution ?? Math.max(Number(meeting?.expectedBudget || 0) - plannedCompanyContribution, 0)
  );
  const calculatedGiftExpenseTotal = useMemo(
    () => (meeting ? getCalculatedGiftExpenseTotal(meeting) : 0),
    [meeting]
  );
  const savedGiftExpenseTotal = useMemo(
    () =>
      (meeting?.expenses || [])
        .filter((expense) => isGiftExpenseHead(expense.expenseHead))
        .reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
    [meeting]
  );
  const giftExpenseTotal = calculatedGiftExpenseTotal > 0 ? calculatedGiftExpenseTotal : savedGiftExpenseTotal;
  const expenseSubmissionTotal = totalExpenses + giftExpenseTotal;
  const plannedGiftQuantity = useMemo(
    () => plannedGifts.reduce((sum, gift) => sum + Number(gift.quantity || 0), 0),
    [plannedGifts]
  );
  const issuedGiftQuantity = useMemo(
    () =>
      meeting?.gifts?.length
        ? getMeetingIssuedGiftQuantity(meeting)
        : Number(meeting?.actualGiftQuantity || 0),
    [meeting]
  );
  const reportExpenseRows = useMemo(() => getReportExpenseRows(reportMeetings), [reportMeetings]);
  const reportGiftRows = useMemo(() => getReportGiftRows(reportMeetings), [reportMeetings]);
  const dealerPerformanceRows = useMemo(
    () => getReportPerformanceRows(reportMeetings, getMeetingDealerLabel),
    [reportMeetings]
  );
  const cityPerformanceRows = useMemo(
    () => getReportPerformanceRows(reportMeetings, (item) => [item.city, item.state].filter(Boolean).join(", ") || "Unassigned"),
    [reportMeetings]
  );
  const fieldOfficerPerformanceRows = useMemo(
    () => getReportPerformanceRows(reportMeetings, (item) => item.creatorName || (item.creatorId ? `Employee #${item.creatorId}` : "Unassigned")),
    [reportMeetings]
  );
  const marketDatabaseRows = useMemo(() => getMarketDatabaseRows(reportMeetings), [reportMeetings]);
  const reportMeetingTypeOptions = useMemo(
    () => withCurrentOption(meetingTypes, reportFilters.meetingType === REPORT_ALL_VALUE ? undefined : reportFilters.meetingType),
    [meetingTypes, reportFilters.meetingType]
  );
  const activeReportMeta = useMemo(
    () => REPORT_VIEW_OPTIONS.find((option) => option.key === activeReportView) || REPORT_VIEW_OPTIONS[0],
    [activeReportView]
  );
  const activeReportCount = useMemo(() => {
    switch (activeReportView) {
      case "summary":
        return reportMeetings.length;
      case "expenses":
        return reportExpenseRows.length;
      case "gifts":
        return reportGiftRows.length;
      case "dealer":
        return dealerPerformanceRows.length;
      case "city":
        return cityPerformanceRows.length;
      case "officer":
        return fieldOfficerPerformanceRows.length;
      case "market":
        return marketDatabaseRows.length;
      default:
        return 0;
    }
  }, [
    activeReportView,
    cityPerformanceRows.length,
    dealerPerformanceRows.length,
    fieldOfficerPerformanceRows.length,
    marketDatabaseRows.length,
    reportExpenseRows.length,
    reportGiftRows.length,
    reportMeetings.length,
  ]);
  const typeOptions = useMemo(() => withCurrentOption(meetingTypes, requestForm?.meetingType), [meetingTypes, requestForm?.meetingType]);
  const currentGiftOptions = useMemo(
    () => gifts.reduce((options, gift) => withCurrentOption(options, gift.giftItem), giftItemOptions),
    [giftItemOptions, gifts]
  );
  const currentExpenseHeadOptions = useMemo(
    () => expenses.reduce((options, expense) => withCurrentOption(options, expense.expenseHead), expenseHeadOptions),
    [expenseHeadOptions, expenses]
  );

  const isAdmin = hasAdminSetupPrivileges(userRole, currentUser);
  const hasBackendActionContract = Array.isArray(meeting?.allowedActions);
  const isActionAllowed = (action: Parameters<typeof hasMeetingAction>[1], legacyFallback: boolean) =>
    Boolean(meeting && (hasMeetingAction(meeting, action) || (!hasBackendActionContract && legacyFallback)));

  const canEditRequest = isActionAllowed("EDIT_REQUEST", Boolean(meeting && ["DRAFT", "CORRECTION_REQUIRED"].includes(meeting.status)));
  const canSubmit = Boolean(!isAdmin && isActionAllowed("SUBMIT", Boolean(meeting && ["DRAFT", "CORRECTION_REQUIRED"].includes(meeting.status))));
  const canApprove = isActionAllowed("APPROVE", meeting?.status === "PENDING_APPROVAL");
  const canReject = isActionAllowed("REJECT", meeting?.status === "PENDING_APPROVAL");
  const canRequestCorrection = isActionAllowed("REQUEST_CORRECTION", meeting?.status === "PENDING_APPROVAL");
  const canExecute = isActionAllowed("EXECUTE", meeting?.status === "APPROVED");
  const canMarkAttendance = isActionAllowed("MARK_ATTENDANCE", Boolean(meeting && ["APPROVED", "EXECUTED"].includes(meeting.status)));
  const canIssueGifts = Boolean(
    meeting &&
      isMeetingTabEnabled(meeting, "gifts") &&
      meeting.attendanceFinalized === true &&
      ["EXECUTED", "EXPENSE_SUBMITTED", "REPORT_SUBMITTED"].includes(meeting.status)
  );
  const canSubmitExpenses = isActionAllowed("SUBMIT_EXPENSES", meeting?.status === "EXECUTED");
  const canSubmitFinalReport = isActionAllowed("SUBMIT_FINAL_REPORT", meeting?.status === "EXPENSE_SUBMITTED");
  const canApproveFinalReport = isActionAllowed("APPROVE_FINAL_REPORT", meeting?.status === "REPORT_SUBMITTED");
  const canClose =
    isActionAllowed("APPROVE_AND_CLOSE", false) || isActionAllowed("CLOSE", meeting?.status === "REPORT_SUBMITTED");
  const canCancel = isActionAllowed("CANCEL", Boolean(meeting && ["DRAFT", "PENDING_APPROVAL", "APPROVED"].includes(meeting.status)));

  const runAction = async (callback: () => Promise<unknown>, successMessage: string) => {
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      await callback();
      setMessage(successMessage);
      await loadMeeting();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const updateRequestForm = <K extends keyof RequestForm>(key: K, value: RequestForm[K]) => {
    setRequestForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const saveRequest = async () => {
    if (!meeting || !requestForm) return;
    if (!requestForm.meetingDate || !requestForm.meetingTime || !requestForm.city.trim() || !requestForm.state.trim()) {
      setError("Meeting date, time, city, and state are required.");
      return;
    }
    const namedAttendeeCount = normaliseAttendees(attendees).length;
    const expectedPeople = Number(requestForm.expectedAttendees || namedAttendeeCount);
    if (!Number.isFinite(expectedPeople) || expectedPeople < namedAttendeeCount) {
      setError("Expected people cannot be lower than named attendees.");
      return;
    }
    const expectedBudget = Number(requestForm.expectedBudget || 0);
    const companyContribution = Number(requestForm.companyContribution || 0);
    if (!Number.isFinite(companyContribution) || companyContribution < 0 || companyContribution > expectedBudget) {
      setError("Company contribution must be between 0 and the expected budget.");
      return;
    }
    const dealerContribution = Math.max(expectedBudget - companyContribution, 0);

    await runAction(
      () =>
        meetingsApi.editMeetingRequest(meeting.id, {
          meetingType: requestForm.meetingType,
          meetingDate: requestForm.meetingDate,
          meetingTime: timeForApi(requestForm.meetingTime),
          city: requestForm.city.trim(),
          state: requestForm.state.trim(),
          location: requestForm.location.trim(),
          customerReference: requestForm.customerReference.trim() || undefined,
          expectedAttendees: expectedPeople,
          expectedBudget,
          allowWalkInAttendees: requestForm.allowWalkInAttendees,
          plan: {
            expectedBudget,
            companyContribution,
            dealerContribution,
            plannedExpenseDetails: meeting.plan?.plannedExpenseDetails,
            plannedGiftDetails: meeting.plan?.plannedGiftDetails,
          },
        }),
      "Meeting request updated."
    );
  };

  const saveAttendees = async () => {
    if (!meeting) return;
    const cleaned = normaliseAttendees(attendees);
    const duplicateError = getDuplicateMobileError(cleaned);
    if (duplicateError) {
      setError(duplicateError);
      return;
    }
    const incomplete = cleaned.find((attendee) => !attendee.name || !attendee.mobileNumber || !attendee.category);
    if (incomplete) {
      setError("Every attendee needs a name, mobile number, and category.");
      return;
    }
    await runAction(() => meetingsApi.saveExpectedAttendees(meeting.id, cleaned), "Expected attendees saved.");
  };

  const submitForApproval = async () => {
    if (!meeting) return;
    const attendeeCount = normaliseAttendees(attendees).length || meeting.attendees?.length || 0;
    if (attendeeCount === 0) {
      setError("Add named attendees before submitting for approval.");
      setActiveTab("attendees");
      return;
    }
    await runAction(() => meetingsApi.submitForApproval(meeting.id), "Meeting submitted for approval.");
  };

  const approvalAction = async (action: "approve" | "reject" | "correction") => {
    if (!meeting) return false;
    if (action === "correction" && !correctionStage) {
      setError("Select the section that needs correction.");
      return false;
    }
    const selectedCorrectionLabel =
      CORRECTION_STAGE_OPTIONS.find((option) => option.value === correctionStage)?.label || "selected section";
    const trimmedRemarks = approvalRemarks.trim();
    const payload = {
      approvalRemarks:
        trimmedRemarks ||
        (action === "reject"
          ? "Rejected by approver."
          : action === "correction"
            ? `Correction requested for ${selectedCorrectionLabel}.`
            : ""),
    };
    let ok = false;
    if (action === "approve") {
      ok = await runAction(() => meetingsApi.approveMeeting(meeting.id, payload), "Meeting approved.");
    } else if (action === "reject") {
      ok = await runAction(() => meetingsApi.rejectMeeting(meeting.id, payload), "Meeting rejected.");
    } else {
      ok = await runAction(
        () =>
          meetingsApi.requestCorrection(meeting.id, {
            ...payload,
            correctionStage,
            correctionRemarks: trimmedRemarks || `Correction requested for ${selectedCorrectionLabel}.`,
          }),
        "Meeting sent for correction."
      );
    }
    if (ok) {
      setApprovalRemarks("");
      setApprovalDecision("approve");
    }
    return ok;
  };

  const executeMeeting = async () => {
    if (!meeting) return;
    if (!executionForm.actualMeetingDate || !executionForm.actualMeetingTime || !executionForm.actualLocation.trim()) {
      setError("Actual meeting date, time, and location are required.");
      return;
    }
    await runAction(
      () =>
        meetingsApi.executeMeeting(meeting.id, {
          actualMeetingDate: executionForm.actualMeetingDate,
          actualMeetingTime: timeForApi(executionForm.actualMeetingTime),
          actualLocation: executionForm.actualLocation.trim(),
          executionRemarks: executionForm.executionRemarks.trim() || undefined,
        }),
      "Meeting execution started."
    );
  };

  const saveAttendance = async () => {
    if (!meeting) return;
    const payload: AttendancePayload[] = (meeting.attendees || [])
      .filter((attendee) => attendee.id != null)
      .map((attendee) => ({
        id: attendee.id as number,
        present: attendance[attendee.id as number]?.present === true,
        attendanceSource: "MANUAL",
        remarks: attendance[attendee.id as number]?.remarks || "",
      }));

    await runAction(
      () =>
        meetingsApi.finaliseAttendance(meeting.id, {
          actualMeetingDate: executionForm.actualMeetingDate || meeting.actualMeetingDate || meeting.meetingDate || "",
          actualMeetingTime: timeForApi(executionForm.actualMeetingTime || timeForInput(meeting.actualMeetingTime || meeting.meetingTime)),
          actualLocation: executionForm.actualLocation.trim() || meeting.actualLocation || meeting.location || "",
          executionRemarks: executionForm.executionRemarks.trim() || undefined,
          attendees: payload.map((attendee) => ({
            ...attendee,
            attendanceSource: "FINAL_MANUAL",
          })),
        }),
      "Attendance finalised."
    );
  };

  const addWalkIn = async () => {
    if (!meeting) return;
    const cleaned = normaliseAttendees([walkIn])[0];
    if (!cleaned?.name || !cleaned.mobileNumber || !cleaned.category) {
      setError("Walk-in attendee needs a name, mobile number, and category.");
      return;
    }
    const existingMobiles = new Set((meeting.attendees || []).map((attendee) => cleanMobile(attendee.mobileNumber)));
    if (existingMobiles.has(cleaned.mobileNumber)) {
      setError("This mobile number already exists in this meeting.");
      return;
    }
    await runAction(() => meetingsApi.addWalkInAttendee(meeting.id, cleaned), "Walk-in attendee added and marked present.");
    setWalkIn(attendeeDraft());
  };

  const saveGifts = async () => {
    if (!meeting) return;
    const presentIds = new Set(presentAttendees.map((attendee) => attendee.id));
    const cleaned = gifts
      .map((gift) => ({
        ...gift,
        meetingAttendeeId: Number(gift.meetingAttendeeId),
        giftItem: gift.giftItem.trim(),
        quantity: Number(gift.quantity || 0),
      }))
      .filter((gift) => gift.meetingAttendeeId && gift.giftItem && gift.quantity > 0);

    const invalidGift = cleaned.find((gift) => !presentIds.has(gift.meetingAttendeeId));
    if (invalidGift) {
      setError("Gifts can be issued only to attendees marked present.");
      return;
    }

    if (cleaned.length === 0) {
      setError("Add at least one valid gift row.");
      return;
    }

    const issuedPairs = new Set<string>();
    for (const gift of cleaned) {
      const key = `${gift.meetingAttendeeId}:${gift.giftItem.toLowerCase()}`;
      if (issuedPairs.has(key)) {
        setError("The same attendee cannot receive the same gift item twice.");
        return;
      }
      issuedPairs.add(key);
    }

    await runAction(() => meetingsApi.saveGifts(meeting.id, cleaned), "Gifts saved.");
  };

  const removeGift = async (index: number) => {
    if (!meeting) return;
    const gift = gifts[index];
    if (gift?.id) {
      await runAction(() => meetingsApi.deleteGift(meeting.id, gift.id as number), "Gift removed.");
      return;
    }
    setGifts((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
  };

  const markNoGifts = async () => {
    if (!meeting) return;
    await runAction(() => meetingsApi.markNoGifts(meeting.id), "Marked as no gifts distributed.");
  };

  const submitExpenses = async () => {
    if (!meeting) return;
    const cleaned = expenses
      .filter((expense) => !isGiftExpenseHead(expense.expenseHead))
      .map((expense) => ({
        ...expense,
        amount: Number(expense.amount || 0),
        paidBy: expense.paidBy || "COMPANY",
        companyAmount:
          expense.paidBy === "SHARED"
            ? Number(expense.companyAmount || 0)
            : expense.paidBy === "DEALER"
              ? 0
              : Number(expense.amount || 0),
        dealerAmount:
          expense.paidBy === "SHARED"
            ? Number(expense.dealerAmount || 0)
            : expense.paidBy === "DEALER"
              ? Number(expense.amount || 0)
              : 0,
        expenseDate: expense.expenseDate || executionForm.actualMeetingDate || meeting.meetingDate,
      }))
      .filter((expense) => expense.expenseHead && expense.amount > 0);

    if (giftExpenseTotal > 0) {
      cleaned.push({
        expenseHead: "gifts",
        amount: giftExpenseTotal,
        paidBy: "COMPANY",
        companyAmount: giftExpenseTotal,
        dealerAmount: 0,
        expenseDate: executionForm.actualMeetingDate || meeting.meetingDate,
      });
    }

    if (cleaned.length === 0) {
      setError("Add at least one expense row.");
      return;
    }

    const invalidSharedExpense = cleaned.find(
      (expense) =>
        expense.paidBy === "SHARED" &&
        Math.abs(Number(expense.companyAmount || 0) + Number(expense.dealerAmount || 0) - Number(expense.amount || 0)) > 0.01
    );
    if (invalidSharedExpense) {
      setError("For shared expenses, company amount and dealer amount must match the expense total.");
      return;
    }

    await runAction(
      () => meetingsApi.submitExpenses(meeting.id, { expenses: cleaned }),
      "Expenses submitted."
    );
  };

  const recordPlannedExpense = (plannedExpense: MeetingExpense) => {
    const nextExpense: MeetingExpense = {
      expenseHead: plannedExpense.expenseHead,
      amount: Number(plannedExpense.amount || 0),
      paidBy: "COMPANY",
      companyAmount: Number(plannedExpense.amount || 0),
      dealerAmount: 0,
      expenseDate: executionForm.actualMeetingDate || meeting?.meetingDate || "",
    };
    setExpenses((prev) => {
      const blankIndex = prev.findIndex((expense) => !expense.id && Number(expense.amount || 0) === 0);
      if (blankIndex === -1) return [...prev, nextExpense];
      return prev.map((expense, index) => (index === blankIndex ? nextExpense : expense));
    });
  };

  const removeExpense = async (index: number) => {
    if (!meeting) return;
    const expense = expenses[index];
    if (expense?.id) {
      await runAction(() => meetingsApi.deleteExpense(meeting.id, expense.id as number), "Expense removed.");
      return;
    }
    setExpenses((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
  };

  const markNoExpenses = async () => {
    if (!meeting) return;
    if (giftExpenseTotal > 0) {
      setError("Gift distribution has created an actual gift expense, so this meeting cannot be marked as no expenses.");
      return;
    }
    await runAction(() => meetingsApi.markNoExpenses(meeting.id), "Marked as no expenses incurred.");
  };

  const submitFinalReport = async () => {
    if (!meeting) return;
    if (!finalReport.meetingSummary.trim()) {
      setError("Meeting summary is required for final report.");
      return;
    }
    if (!finalReport.actualBusinessOutcome?.trim()) {
      setError("Actual business outcome is required for final report.");
      return;
    }
    await runAction(() => meetingsApi.submitFinalReport(meeting.id, finalReport), "Final report submitted.");
  };

  const approveAndCloseMeeting = async () => {
    if (!meeting) return false;
    const remarks = finalApprovalRemarks.trim() || "Approved and closed by final reviewer.";
    return runAction(
      () =>
        meetingsApi.approveAndCloseFinalReport(meeting.id, {
          finalReportApprovalRemarks: finalApprovalRemarks.trim() || remarks,
          finalRemarks: remarks,
        }),
      "Meeting approved and closed."
    );
  };

  const requestFinalReviewCorrection = async () => {
    if (!meeting) return false;
    if (!finalCorrectionStage) {
      setError("Select the section that needs correction.");
      return false;
    }
    const selectedCorrectionLabel =
      CORRECTION_STAGE_OPTIONS.find((option) => option.value === finalCorrectionStage)?.label || "selected section";
    const remarks = finalApprovalRemarks.trim() || `Correction requested for ${selectedCorrectionLabel}.`;
    const ok = await runAction(
      () =>
        meetingsApi.requestFinalReportCorrection(meeting.id, {
          approvalRemarks: remarks,
          correctionStage: finalCorrectionStage,
          correctionRemarks: remarks,
        }),
      "Meeting sent back for correction."
    );
    if (ok) {
      setFinalApprovalRemarks("");
      setFinalReviewDecision("approveClose");
    }
    return ok;
  };

  const cancelMeeting = async () => {
    if (!meeting) return false;
    if (!cancelRemarks.trim()) {
      setError("Cancellation remarks are required.");
      return false;
    }
    return runAction(() => meetingsApi.cancelMeeting(meeting.id, { remarks: cancelRemarks.trim() }), "Meeting cancelled.");
  };

  const handleApprovalDecision = async (action: "approve" | "reject" | "correction") => {
    const ok = await approvalAction(action);
    if (ok) setIsApprovalDecisionOpen(false);
  };

  const handleApproveAndClose = async () => {
    const ok = await approveAndCloseMeeting();
    if (ok) {
      setFinalReviewDecision("approveClose");
      setIsFinalReviewDecisionOpen(false);
    }
  };

  const handleFinalReviewCorrection = async () => {
    const ok = await requestFinalReviewCorrection();
    if (ok) setIsFinalReviewDecisionOpen(false);
  };

  const handleCancelMeeting = async () => {
    const ok = await cancelMeeting();
    if (ok) setIsCancelMeetingOpen(false);
  };

  const resetReportToMonth = () => {
    if (!meeting) return;
    setReportFilters(reportFiltersFromMeeting(meeting));
  };

  const useCurrentMeetingReportFilters = () => {
    if (!meeting) return;
    setReportFilters(currentMeetingReportFilters(meeting));
  };

  const exportMeetingReport = async (filters = reportFilters) => {
    if (!meeting) return;
    setIsExportingReport(true);
    setError(null);
    setMessage(null);
    try {
      const blob = await meetingsApi.exportReport(reportFiltersForApi(filters));
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "meeting-report.csv";
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export meeting report.");
    } finally {
      setIsExportingReport(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-96 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading meeting
      </div>
    );
  }

  if (!meeting || !requestForm) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => router.push("/dashboard/meetings")}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error || "Meeting not found."}
        </div>
      </div>
    );
  }

  const actualAttendanceCount = getActualAttendanceCount(meeting);
  const namedAttendeeCount = meeting.attendees?.length || 0;
  const expectedTurnout = meeting.expectedAttendees || namedAttendeeCount;
  const requestExpectedBudget = Number(requestForm.expectedBudget || 0);
  const requestCompanyContribution = Math.min(
    Math.max(Number(requestForm.companyContribution || 0), 0),
    requestExpectedBudget
  );
  const requestDealerContribution = Math.max(requestExpectedBudget - requestCompanyContribution, 0);
  const adminPresentation = getAdminMeetingPresentation(meeting);
  const showActualSummary = isAdmin ? adminPresentation.isPostMeeting : isPostMeetingStatus(meeting.status);
  const budgetDifference = actualExpenseTotal - Number(meeting.expectedBudget || 0);
  const plannedGiftDisplay = plannedGiftQuantity ? `${plannedGiftQuantity} planned` : meeting.expectedGiftsMaterials ? "Added" : "-";
  const issuedGiftDisplay = issuedGiftQuantity ? String(issuedGiftQuantity) : meeting.noGifts ? "No Gifts" : "-";
  const requestCorrectionOptions = CORRECTION_STAGE_OPTIONS.filter((option) => ["REQUEST", "ATTENDEES"].includes(option.value));
  const finalCorrectionOptions = CORRECTION_STAGE_OPTIONS.filter((option) =>
    ["ATTENDANCE", "GIFTS", "EXPENSES", "LEADS", "FINAL_REPORT"].includes(option.value)
  );
  const approvalDecisionOptions: Array<{ value: ApprovalDecision; label: string }> = [
    ...(canApprove ? [{ value: "approve" as const, label: "Approve" }] : []),
    ...(canRequestCorrection ? [{ value: "correction" as const, label: "Request Correction" }] : []),
    ...(canReject ? [{ value: "reject" as const, label: "Reject" }] : []),
  ];
  const selectedApprovalDecision = approvalDecisionOptions.some((option) => option.value === approvalDecision)
    ? approvalDecision
    : approvalDecisionOptions[0]?.value || "approve";
  const selectedApprovalDecisionLabel =
    approvalDecisionOptions.find((option) => option.value === selectedApprovalDecision)?.label || "Apply Decision";
  const finalReviewDecisionOptions: Array<{ value: FinalReviewDecision; label: string }> = [
    { value: "approveClose", label: "Approve and Close" },
    { value: "correction", label: "Request Correction" },
  ];
  const selectedFinalReviewDecision = finalReviewDecisionOptions.some((option) => option.value === finalReviewDecision)
    ? finalReviewDecision
    : "approveClose";
  const selectedFinalReviewDecisionLabel =
    finalReviewDecisionOptions.find((option) => option.value === selectedFinalReviewDecision)?.label || "Apply Decision";
  const approvalDecisionDialog = (
    <Dialog
      open={isApprovalDecisionOpen}
      onOpenChange={(open) => {
        setIsApprovalDecisionOpen(open);
        if (open) {
          setApprovalDecision(selectedApprovalDecision);
        } else {
          setApprovalRemarks("");
        }
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Review Decision</DialogTitle>
          <DialogDescription>Approve this request, reject it, or send it back for correction.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Decision</Label>
            <Select value={selectedApprovalDecision} onValueChange={(value) => setApprovalDecision(value as ApprovalDecision)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {approvalDecisionOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedApprovalDecision === "correction" && (
            <div className="space-y-2">
              <Label>Correction section</Label>
              <Select value={correctionStage} onValueChange={(value) => setCorrectionStage(value as CorrectionStage)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {requestCorrectionOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {selectedApprovalDecision !== "approve" && (
            <div className="space-y-2">
              <Label>
                Decision note <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                value={approvalRemarks}
                onChange={(event) => setApprovalRemarks(event.target.value)}
                placeholder={
                  selectedApprovalDecision === "correction"
                    ? "Add what the field team should correct."
                    : "Add rejection note if needed."
                }
              />
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => setIsApprovalDecisionOpen(false)}>
            Close
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedApprovalDecision === "reject" ? "destructive" : selectedApprovalDecision === "correction" ? "outline" : "default"}
              onClick={() => handleApprovalDecision(selectedApprovalDecision)}
              disabled={isSaving || approvalDecisionOptions.length === 0}
            >
              {selectedApprovalDecision === "approve" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : selectedApprovalDecision === "reject" ? (
                <XCircle className="h-4 w-4" />
              ) : null}
              {selectedApprovalDecisionLabel}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
  const finalReviewDecisionDialog = (
    <Dialog
      open={isFinalReviewDecisionOpen}
      onOpenChange={(open) => {
        setIsFinalReviewDecisionOpen(open);
        if (open) {
          setFinalReviewDecision(selectedFinalReviewDecision);
        } else {
          setFinalApprovalRemarks("");
        }
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Final Review Decision</DialogTitle>
          <DialogDescription>Close the completed meeting or send a specific section back for correction.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Decision</Label>
            <Select value={selectedFinalReviewDecision} onValueChange={(value) => setFinalReviewDecision(value as FinalReviewDecision)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {finalReviewDecisionOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedFinalReviewDecision === "correction" && (
            <div className="space-y-2">
              <Label>Correction section</Label>
              <Select value={finalCorrectionStage} onValueChange={(value) => setFinalCorrectionStage(value as CorrectionStage)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {finalCorrectionOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>
              Decision note <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              value={finalApprovalRemarks}
              onChange={(event) => setFinalApprovalRemarks(event.target.value)}
              placeholder={
                selectedFinalReviewDecision === "correction"
                  ? "Add what the field team should correct."
                  : "Add final approval note if needed."
              }
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => setIsFinalReviewDecisionOpen(false)}>
            Close
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedFinalReviewDecision === "correction" ? "outline" : "default"}
              onClick={selectedFinalReviewDecision === "correction" ? handleFinalReviewCorrection : handleApproveAndClose}
              disabled={isSaving}
            >
              {selectedFinalReviewDecision === "approveClose" && <CheckCircle2 className="h-4 w-4" />}
              {selectedFinalReviewDecisionLabel}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
  const cancelMeetingDialog = (
    <Dialog open={isCancelMeetingOpen} onOpenChange={setIsCancelMeetingOpen}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Cancel Meeting</DialogTitle>
          <DialogDescription>Add the cancellation reason before cancelling this meeting.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Cancellation remarks</Label>
          <Textarea value={cancelRemarks} onChange={(event) => setCancelRemarks(event.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsCancelMeetingOpen(false)}>
            Close
          </Button>
          <Button variant="destructive" onClick={handleCancelMeeting} disabled={isSaving || !cancelRemarks.trim()}>
            Cancel Meeting
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (isAdmin) {
    const adminTabs = adminPresentation.tabs;
    const draftMissingItems = getDraftMissingItems(meeting);
    const reportReadiness = [
      { label: "Attendance", ready: meeting.attendanceFinalized === true, pendingLabel: meeting.status === "CLOSED" ? "Not recorded" : "Pending" },
      { label: "Gifts", ready: meeting.giftsCompleted === true || meeting.noGifts === true, pendingLabel: meeting.status === "CLOSED" ? "Not recorded" : "Pending" },
      { label: "Expenses", ready: meeting.expensesCompleted === true || meeting.noExpenses === true, pendingLabel: meeting.status === "CLOSED" ? "Not recorded" : "Pending" },
      { label: "Final Report", ready: hasFinalReportContent(meeting), pendingLabel: meeting.status === "CLOSED" ? "Not recorded" : "Pending" },
    ];
    const showAttendanceResults = adminPresentation.isPostMeeting;
    const showApprovalDecision = meeting.status === "PENDING_APPROVAL" && (canApprove || canReject || canRequestCorrection);
    const showFinalReviewDecision =
      meeting.status === "REPORT_SUBMITTED" && (canApproveFinalReport || canClose || canRequestCorrection);
    const attendanceDelta = actualAttendanceCount - Number(expectedTurnout || 0);
    const expenseDelta = actualExpenseTotal - Number(meeting.expectedBudget || 0);
    const expensePlanDelta = actualExpenseTotal - plannedExpenseTotal;
    const giftDelta = issuedGiftQuantity - plannedGiftQuantity;
    const showStageNotice = adminPresentation.notice.tone === "warning" || adminPresentation.notice.tone === "danger";
    const adminSummaryMetrics: AdminSummaryMetric[] = showActualSummary
      ? [
          {
            label: "Actual attendance",
            value: String(actualAttendanceCount),
            detail: `${expectedTurnout || 0} expected people · ${namedAttendeeCount} named`,
          },
          {
            label: adminPresentation.expenseComparisonReady ? "Actual expenses" : "Expenses recorded",
            value: formatCurrency(actualExpenseTotal),
            detail: adminPresentation.expenseComparisonReady
              ? `${formatSignedCurrency(expenseDelta)} against budget`
              : "Final difference is not available yet",
            valueClassName: adminPresentation.expenseComparisonReady && expenseDelta > 0 ? "text-amber-600" : "",
          },
          {
            label: adminPresentation.giftComparisonReady ? "Gifts issued" : "Gifts recorded",
            value: String(issuedGiftQuantity || 0),
            detail: adminPresentation.giftComparisonReady
              ? `${plannedGiftQuantity || 0} planned · ${formatSignedNumber(giftDelta)} difference`
              : `${plannedGiftQuantity || 0} planned · completion pending`,
          },
        ]
      : [
          {
            label: "Expected budget",
            value: formatCurrency(meeting.expectedBudget),
            detail: `Company ${formatCurrency(plannedCompanyContribution)} · Dealer ${formatCurrency(plannedDealerContribution)}`,
          },
          {
            label: "Expected people",
            value: String(expectedTurnout || 0),
            detail: `${namedAttendeeCount} named attendees`,
          },
          {
            label: "Planned allocation",
            value: `${plannedGiftQuantity || 0} gifts`,
            detail: `${plannedExpenses.length} expense ${plannedExpenses.length === 1 ? "category" : "categories"}`,
          },
        ];

    return (
      <>
      <div className="flex min-w-0 flex-col gap-4 lg:h-[calc(100vh-6.5rem)] lg:overflow-hidden">
        <div className="flex shrink-0 flex-col gap-3 border-b border-border/70 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl font-extrabold text-foreground">{meeting.meetingType} Meeting</h1>
              <Badge variant="outline" className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${statusBadgeClass(meeting.status)}`}>
                {getMeetingStatusLabel(meeting)}
              </Badge>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-muted-foreground">
              <span>{formatDate(meeting.meetingDate)} at {formatMeetingTime(meeting.meetingTime)}</span>
              <span aria-hidden="true">·</span>
              <span>{[meeting.city, meeting.state].filter(Boolean).join(", ") || "No location set"}</span>
              {(meeting.storeName || meeting.dealerName) && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{meeting.storeName || meeting.dealerName}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {showApprovalDecision && (
              <Button size="sm" className="h-9 font-bold" onClick={() => setIsApprovalDecisionOpen(true)}>
                <CheckCircle2 className="mr-1.5 h-4 w-4" />
                Review Decision
              </Button>
            )}
            {showFinalReviewDecision && (
              <Button size="sm" className="h-9 font-bold" onClick={() => setIsFinalReviewDecisionOpen(true)}>
                <CheckCircle2 className="mr-1.5 h-4 w-4" />
                Final Review Decision
              </Button>
            )}
            {canCancel && (
              <Button variant="outline" size="sm" className="h-9 text-destructive hover:text-destructive" onClick={() => setIsCancelMeetingOpen(true)}>
                <XCircle className="mr-1.5 h-4 w-4" />
                Cancel
              </Button>
            )}
          </div>
        </div>

        {showStageNotice && <AdminStageNotice notice={adminPresentation.notice} />}
        <div className="shrink-0"><AdminSummaryStrip metrics={adminSummaryMetrics} /></div>
        {message && <div className="rounded-xl border border-emerald-200/30 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-600 shrink-0">{message}</div>}
        {error && <div className="rounded-xl border border-red-200/30 bg-red-500/10 p-3 text-xs font-semibold text-red-600 shrink-0">{error}</div>}

        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[176px_minmax(0,1fr)]">
        <div role="tablist" aria-label="Meeting review sections" className="flex gap-1.5 overflow-x-auto rounded-xl border border-border/30 bg-muted/40 p-1.5 scrollbar-none lg:self-start lg:flex-col lg:overflow-visible">
          {adminTabs.map((tab) => (
            <Button
              key={tab.key}
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setAdminTab(tab.key)}
              className={`shrink-0 justify-start rounded-lg text-xs font-bold transition-all px-4 py-2 ${
                adminTab === tab.key
                  ? "bg-background text-foreground shadow-md font-extrabold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
              role="tab"
              aria-selected={adminTab === tab.key}
              aria-controls={`meeting-admin-panel-${tab.key}`}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        <div className="min-w-0 lg:overflow-y-auto pb-4 pr-1 scrollbar-thin space-y-5">
          {adminTab === "details" && (
            <div id="meeting-admin-panel-details" role="tabpanel" className="space-y-5">
              {meeting.status === "DRAFT" && draftMissingItems.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs font-semibold text-amber-800">
                  Draft plan is incomplete. Missing items: {draftMissingItems.join(", ")}.
                </div>
              )}

              <Card className="rounded-lg border-border/70 bg-card/40 shadow-sm">
                <CardContent className="p-5">
                  <div className="mb-4 flex items-center gap-2 text-sm font-bold text-foreground">
                    <FileText className="h-4 w-4 text-primary" />
                    Request at a glance
                  </div>
                  <dl className={`grid gap-5 ${showActualSummary ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
                    <MeetingNoteBlock label="Dealer / shop" value={meeting.storeName || meeting.dealerName || meeting.customerReference} />
                    <MeetingNoteBlock label="Expected people" value={expectedTurnout || 0} />
                    {showActualSummary && (
                      <MeetingNoteBlock label="Actual business outcome" value={meeting.actualBusinessOutcome} />
                    )}
                  </dl>
                </CardContent>
              </Card>

              <ProgressiveSection
                title="Schedule and ownership"
                summary="Open the full request record only when you need to verify schedule, ownership, or contribution."
                defaultOpen={meeting.status === "PENDING_APPROVAL" || (meeting.status === "CORRECTION_REQUIRED" && meeting.correctionStage === "REQUEST")}
              >
                <div className="grid gap-6 md:grid-cols-2">
                  <section>
                    <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      <CalendarDays className="h-4 w-4 text-primary" /> Schedule
                    </div>
                    <dl>
                      <MeetingDataRow label="Meeting type" value={meeting.meetingType} />
                      <MeetingDataRow label="Date" value={formatDate(meeting.meetingDate)} />
                      <MeetingDataRow label="Time" value={formatMeetingTime(meeting.meetingTime)} />
                      <MeetingDataRow label="City / State" value={[meeting.city, meeting.state].filter(Boolean).join(", ")} />
                      <MeetingDataRow label="Location" value={meeting.location} />
                    </dl>
                  </section>
                  <section>
                    <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      <FileText className="h-4 w-4 text-primary" /> Ownership and budget
                    </div>
                    <dl>
                      <MeetingDataRow label="Created by" value={meeting.creatorName} />
                      <MeetingDataRow label="Dealer / shop" value={meeting.storeName || meeting.dealerName || meeting.customerReference} />
                      <MeetingDataRow label="Store ID" value={meeting.storeId} />
                      <MeetingDataRow label="Company share" value={formatCurrency(meeting.plan?.companyContribution)} />
                      <MeetingDataRow label="Dealer share" value={formatCurrency(meeting.plan?.dealerContribution)} />
                    </dl>
                  </section>
                </div>
                {(meeting.approvalRemarks || (meeting.status === "CANCELLED" && (meeting.cancellationReason || meeting.cancellationRemarks)) || (meeting.status === "REJECTED" && meeting.rejectionReason)) && (
                <dl className="mt-6 grid gap-5 border-t border-border/60 pt-5 sm:grid-cols-2 lg:grid-cols-3">
                  {meeting.approvalRemarks && <MeetingNoteBlock label="Approval / rejection note" value={meeting.approvalRemarks} />}
                  {meeting.status === "CANCELLED" && (meeting.cancellationReason || meeting.cancellationRemarks) && (
                    <MeetingNoteBlock label="Cancellation reason" value={meeting.cancellationReason || meeting.cancellationRemarks} />
                  )}
                  {meeting.status === "REJECTED" && meeting.rejectionReason && <MeetingNoteBlock label="Rejection reason" value={meeting.rejectionReason} />}
                </dl>
                )}
              </ProgressiveSection>

              <ProgressiveSection
                title="Planned gifts and expenses"
                summary={`${plannedGiftQuantity || 0} ${plannedGiftQuantity === 1 ? "gift" : "gifts"} and ${formatCurrency(plannedExpenseTotal)} in planned expenses.`}
              >
                <div className="grid gap-5 md:grid-cols-2">
                  <section className="overflow-hidden rounded-md border border-border/60">
                    <div className="border-b bg-muted/20 px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Planned Gifts</div>
                    {plannedGifts.length ? (
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/20">
                            <TableHead className="px-5 py-2.5 text-xs">Item</TableHead>
                            <TableHead className="py-2.5 text-xs">Quantity</TableHead>
                            <TableHead className="pr-5 py-2.5 text-xs text-right">Estimated Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {plannedGifts.map((gift, index) => (
                            <TableRow key={`${gift.giftItem}-${index}`}>
                              <TableCell className="px-5 py-3 font-semibold text-xs">{gift.giftItem || "-"}</TableCell>
                              <TableCell className="py-3 text-xs">{Number(gift.quantity || 0)}</TableCell>
                              <TableCell className="pr-5 py-3 text-right font-bold text-xs">{formatCurrency(gift.estimatedAmount)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="p-5 text-xs text-muted-foreground">No planned gifts were added.</div>
                    )}
                  </section>

                  <section className="overflow-hidden rounded-md border border-border/60">
                    <div className="border-b bg-muted/20 px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Planned Expenses</div>
                    {plannedExpenses.length ? (
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/20">
                            <TableHead className="px-5 py-2.5 text-xs">Expense Head</TableHead>
                            <TableHead className="pr-5 py-2.5 text-xs text-right">Planned Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {plannedExpenses.map((expense, index) => (
                            <TableRow key={`${expense.expenseHead}-${index}`}>
                              <TableCell className="px-5 py-3 font-semibold text-xs">{expense.expenseHead || "Other"}</TableCell>
                              <TableCell className="pr-5 py-3 text-right font-bold text-xs">{formatCurrency(expense.amount)}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <TableCell className="px-5 py-3 font-extrabold text-xs">Total</TableCell>
                            <TableCell className="pr-5 py-3 text-right font-extrabold text-xs text-primary">{formatCurrency(plannedExpenseTotal)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="p-5 text-xs text-muted-foreground">No planned expenses were added.</div>
                    )}
                  </section>
                </div>
              </ProgressiveSection>
            </div>
          )}

          {adminTab === "attendees" && (
            <Card id="meeting-admin-panel-attendees" role="tabpanel" className="rounded-xl border border-border/30 bg-card/40 backdrop-blur-md shadow-sm overflow-hidden">
              <CardHeader className="border-b border-border/20 px-5 py-4">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{showAttendanceResults ? "Attendance Outcomes" : "Named Attendees"}</CardTitle>
              </CardHeader>
              <CardContent className="p-0 space-y-4">
                {showAttendanceResults && (
                  <div className="flex flex-wrap gap-x-6 gap-y-2 bg-muted/20 px-5 py-3 text-xs border-b border-border/10">
                    <span><span className="text-muted-foreground font-semibold">Actual attended:</span> <strong>{actualAttendanceCount}</strong></span>
                    <span><span className="text-muted-foreground font-semibold">Expected people:</span> <strong>{expectedTurnout || 0}</strong></span>
                    <span><span className="text-muted-foreground font-semibold">Named attendees:</span> <strong>{namedAttendeeCount}</strong></span>
                  </div>
                )}
                {meeting.attendees?.length ? (
                  <div className="overflow-x-auto">
                    <Table className="min-w-[800px]">
                      <TableHeader>
                        <TableRow className="bg-muted/20">
                          <TableHead className="px-5 text-xs">Name</TableHead>
                          <TableHead className="text-xs">Mobile</TableHead>
                          <TableHead className="text-xs">Category</TableHead>
                          <TableHead className="text-xs">City / Area</TableHead>
                          <TableHead className="text-xs">Company / Project</TableHead>
                          <TableHead className="pr-5 text-xs text-right">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {meeting.attendees.map((attendee) => (
                          <TableRow key={attendee.id || attendee.mobileNumber}>
                            <TableCell className="px-5 font-semibold text-xs">{attendee.name}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{attendee.mobileNumber}</TableCell>
                            <TableCell className="text-xs font-medium text-foreground">{attendee.category}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{attendee.cityArea || "-"}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{attendee.companyShopProject || "-"}</TableCell>
                            <TableCell className="pr-5 text-right">
                              {showAttendanceResults ? (
                                attendee.present ? (
                                  <div className="flex items-center justify-end gap-1.5">
                                    <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px] px-2 font-bold rounded-full">Present</Badge>
                                    {attendee.expected === false && <Badge variant="outline" className="text-[10px] px-2 rounded-full">Walk-in</Badge>}
                                  </div>
                                ) : meeting.attendanceFinalized ? (
                                  <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700 text-[10px] px-2 font-bold rounded-full">Absent</Badge>
                                ) : (
                                  <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 text-[10px] px-2 font-bold rounded-full">Not recorded</Badge>
                                )
                              ) : attendee.expected === false ? (
                                <Badge variant="outline" className="text-[10px] px-2 rounded-full">Walk-in</Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] px-2 rounded-full font-bold">Expected</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="p-5 text-xs text-muted-foreground text-center">No named attendees found.</div>
                )}
              </CardContent>
            </Card>
          )}

          {adminTab === "gifts" && (
            <div id="meeting-admin-panel-gifts" role="tabpanel" className="space-y-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Planned vs Actual Gifts</h3>
                <Badge
                  variant="outline"
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    meeting.giftsCompleted || meeting.noGifts
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-amber-200 bg-amber-50 text-amber-700"
                  }`}
                >
                  {meeting.noGifts ? "No Gifts Distributed" : meeting.giftsCompleted ? "Completed" : meeting.status === "CLOSED" ? "Not Recorded" : "Pending"}
                </Badge>
              </div>

              <AdminSummaryStrip
                metrics={[
                  { label: "Planned quantity", value: String(plannedGiftQuantity || 0), detail: `${plannedGifts.length} planned ${plannedGifts.length === 1 ? "item" : "items"}` },
                  { label: adminPresentation.giftComparisonReady ? "Issued quantity" : "Issued so far", value: String(issuedGiftQuantity || 0), detail: `${meeting.gifts?.length || 0} saved issue rows` },
                  adminPresentation.giftComparisonReady
                    ? {
                        label: "Difference",
                        value: formatSignedNumber(issuedGiftQuantity - plannedGiftQuantity),
                        detail: meeting.noGifts ? "Marked as no gifts distributed" : "Final saved variance",
                        valueClassName: issuedGiftQuantity >= plannedGiftQuantity ? "text-emerald-600" : "text-amber-600",
                      }
                    : {
                        label: "Completion",
                        value: meeting.status === "CLOSED" ? "Not recorded" : "In progress",
                        detail: "Difference will appear after completion",
                      },
                ]}
              />

              <Card className="rounded-xl border border-border/30 bg-card/40 backdrop-blur-md shadow-sm overflow-hidden">
                <CardHeader className="border-b border-border/20 px-5 py-3">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {adminPresentation.giftComparisonReady ? "Planned vs Issued Analysis" : "Approved Gift Plan and Progress"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {giftComparisonRows.length ? (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/20">
                          <TableHead className="text-xs">Gift / Item</TableHead>
                          <TableHead className="text-xs">Planned</TableHead>
                          <TableHead className="text-xs">{adminPresentation.giftComparisonReady ? "Issued" : "Issued So Far"}</TableHead>
                          {adminPresentation.giftComparisonReady && <TableHead className="text-xs">Difference</TableHead>}
                          <TableHead className="text-xs">Estimated Cost</TableHead>
                          {adminPresentation.giftComparisonReady && <TableHead className="pr-5 text-right text-xs">Status</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {giftComparisonRows.map((row) => (
                          <TableRow key={row.item}>
                            <TableCell className="px-5 font-semibold text-xs">{row.item}</TableCell>
                            <TableCell className="text-xs font-medium">{row.planned}</TableCell>
                            <TableCell className="text-xs font-medium">{row.issued}</TableCell>
                            {adminPresentation.giftComparisonReady && (
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] px-2 rounded-full font-bold ${row.difference >= 0 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}
                                >
                                  {formatSignedNumber(row.difference)}
                                </Badge>
                              </TableCell>
                            )}
                            <TableCell className="text-xs font-bold">{formatCurrency(row.estimatedAmount)}</TableCell>
                            {adminPresentation.giftComparisonReady && (
                              <TableCell className="pr-5 text-right">
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] px-2 rounded-full font-semibold ${
                                    meeting.noGifts
                                      ? "border-slate-200 bg-slate-50 text-slate-700"
                                      : row.difference === 0
                                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                        : row.difference > 0
                                          ? "border-blue-200 bg-blue-50 text-blue-700"
                                          : "border-amber-200 bg-amber-50 text-amber-700"
                                  }`}
                                >
                                  {meeting.noGifts
                                    ? "No gifts issued"
                                    : row.difference === 0
                                      ? "Matched"
                                      : row.difference > 0
                                        ? "Extra issued"
                                        : `Short by ${Math.abs(row.difference)}`}
                                </Badge>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="p-5 text-xs text-muted-foreground text-center">No planned or issued gift data found.</div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {adminTab === "expenses" && (
            <div id="meeting-admin-panel-expenses" role="tabpanel" className="space-y-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Planned vs Actual Expenses</h3>
                <Badge
                  variant="outline"
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    meeting.expensesCompleted || meeting.noExpenses
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-amber-200 bg-amber-50 text-amber-700"
                  }`}
                >
                  {meeting.noExpenses ? "No Expenses Incurred" : meeting.expensesCompleted ? "Completed" : meeting.status === "CLOSED" ? "Not Recorded" : "Pending"}
                </Badge>
              </div>

              <AdminSummaryStrip
                metrics={[
                  {
                    label: "Planned expenses",
                    value: formatCurrency(plannedExpenseTotal),
                    detail: `${formatCurrency(meeting.expectedBudget)} approved budget`,
                  },
                  {
                    label: adminPresentation.expenseComparisonReady ? "Actual expenses" : "Recorded so far",
                    value: formatCurrency(actualExpenseTotal),
                    detail: adminPresentation.expenseComparisonReady
                      ? `${formatSignedCurrency(expensePlanDelta)} against plan`
                      : "Final variance is not available yet",
                    valueClassName: adminPresentation.expenseComparisonReady && expensePlanDelta > 0 ? "text-amber-600" : "",
                  },
                  {
                    label: "Actual contribution",
                    value: `Company ${formatCurrency(companyPaidTotal)}`,
                    detail: `Dealer ${formatCurrency(dealerPaidTotal)}`,
                  },
                ]}
              />

              <Card className="rounded-xl border border-border/30 bg-card/40 backdrop-blur-md shadow-sm overflow-hidden">
                <CardHeader className="border-b border-border/20 px-5 py-3">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {adminPresentation.expenseComparisonReady ? "Category-Wise Plan vs Actual Comparison" : "Approved Expense Plan and Progress"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {expenseComparisonRows.length ? (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/20">
                          <TableHead className="text-xs">Expense Head</TableHead>
                          <TableHead className="text-xs">Planned</TableHead>
                          <TableHead className="text-xs">{adminPresentation.expenseComparisonReady ? "Actual" : "Recorded"}</TableHead>
                          {adminPresentation.expenseComparisonReady && <TableHead className="text-xs">Difference</TableHead>}
                          <TableHead className="text-xs">Company</TableHead>
                          <TableHead className="text-xs">Dealer</TableHead>
                          {adminPresentation.expenseComparisonReady && <TableHead className="pr-5 text-right text-xs">Status</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {expenseComparisonRows.map((row) => {
                          const isUnplannedSpend = row.planned === 0 && row.actual > 0;
                          const isNotSpent = row.planned > 0 && row.actual === 0;
                          const isOverBudget = row.difference > 0;

                          return (
                            <TableRow key={row.head} className={isOverBudget ? "bg-amber-500/5 hover:bg-amber-500/10" : undefined}>
                              <TableCell className="px-5 py-2">
                                <ExpenseHeadChip head={row.head} />
                              </TableCell>
                              <TableCell className="text-xs font-semibold">{formatCurrency(row.planned)}</TableCell>
                              <TableCell className="text-xs font-semibold">{formatCurrency(row.actual)}</TableCell>
                              {adminPresentation.expenseComparisonReady && (
                                <TableCell className={`text-xs font-bold ${isOverBudget ? "text-amber-600" : "text-emerald-600"}`}>
                                  {formatSignedCurrency(row.difference)}
                                </TableCell>
                              )}
                              <TableCell className="text-xs font-semibold text-muted-foreground">{formatCurrency(row.company)}</TableCell>
                              <TableCell className="text-xs font-semibold text-muted-foreground">{formatCurrency(row.dealer)}</TableCell>
                              {adminPresentation.expenseComparisonReady && (
                                <TableCell className="pr-5 text-right">
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] px-2 rounded-full font-semibold ${
                                      isOverBudget
                                        ? "border-amber-200 bg-amber-50 text-amber-700"
                                        : "border-emerald-200 bg-emerald-50 text-emerald-700"
                                    }`}
                                  >
                                    {isUnplannedSpend ? "Unplanned spend" : isOverBudget ? "Over budget" : isNotSpent ? "Not spent" : "Within plan"}
                                  </Badge>
                                </TableCell>
                              )}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="p-5 text-xs text-muted-foreground text-center">No planned or actual expense data found.</div>
                  )}
                </CardContent>
              </Card>

              <ProgressiveSection
                title="Actual expense entries"
                summary={`${meeting.expenses?.length || 0} saved ${meeting.expenses?.length === 1 ? "entry" : "entries"}. Open to inspect payer and date.`}
              >
                  {meeting.expenses?.length ? (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/20">
                          <TableHead className="px-5 text-xs">Head</TableHead>
                          <TableHead className="text-xs">Amount</TableHead>
                          <TableHead className="text-xs">Paid By</TableHead>
                          <TableHead className="text-xs">Company</TableHead>
                          <TableHead className="text-xs">Dealer</TableHead>
                          <TableHead className="text-xs">Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {meeting.expenses.map((expense, index) => (
                          <TableRow key={expense.id || index}>
                            <TableCell className="px-5 py-2"><ExpenseHeadChip head={expense.expenseHead} /></TableCell>
                            <TableCell className="text-xs font-bold text-foreground">{formatCurrency(expense.amount)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{expense.paidBy || "-"}</TableCell>
                            <TableCell className="text-xs font-medium">{formatCurrency(expense.companyAmount)}</TableCell>
                            <TableCell className="text-xs font-medium">{formatCurrency(expense.dealerAmount)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{formatDate(expense.expenseDate)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="p-5 text-xs text-muted-foreground text-center">No actual expense logs recorded.</div>
                  )}
              </ProgressiveSection>
            </div>
          )}

          {adminTab === "finalReport" && (
            <div id="meeting-admin-panel-finalReport" role="tabpanel" className="space-y-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Final Report Outcomes</h3>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${hasFinalReportContent(meeting) ? "border-emerald-200 bg-emerald-50 text-emerald-700" : ""}`}
                    >
                      {hasFinalReportContent(meeting) ? "Report Available" : "Not Submitted"}
                    </Badge>
                  </div>
                </div>
              </div>

              {adminPresentation.showFinalReportContent ? (
                <>
                  {hasFinalReportContent(meeting) && (
                    <Card className="rounded-lg border-border/70 bg-card/40 shadow-sm">
                      <CardContent className="p-5">
                        <div className="mb-4 flex items-center gap-2 text-sm font-bold text-foreground">
                          <FileText className="h-4 w-4 text-primary" />
                          Submitted outcome
                        </div>
                        <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                          <MeetingNoteBlock label="Meeting summary" value={meeting.meetingSummary} />
                          <MeetingNoteBlock label="Key discussion points" value={meeting.keyDiscussionPoints} />
                          <MeetingNoteBlock label="Actual business outcome" value={meeting.actualBusinessOutcome} />
                          <MeetingNoteBlock label="Lead details" value={meeting.leadDetails || meeting.leadsGenerated} />
                          <MeetingNoteBlock label="Interested customers" value={meeting.interestedCustomers} />
                          <MeetingNoteBlock label="Competitor information" value={meeting.competitorInformation} />
                          {meeting.finalReportApprovalRemarks && <MeetingNoteBlock label="Final approval remarks" value={meeting.finalReportApprovalRemarks} />}
                        </dl>
                      </CardContent>
                    </Card>
                  )}

                  <ProgressiveSection
                    title="Review checks and plan comparison"
                    summary="Open readiness checks and the approved-plan versus actual-outcome comparison."
                    defaultOpen={meeting.status === "REPORT_SUBMITTED"}
                  >
                    <div className="space-y-5">
                      <section className="space-y-3 border-b border-border/60 pb-5">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                          Workflow Verification Readiness
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {reportReadiness.map((item) => (
                            <div key={item.label} className="inline-flex items-center gap-1.5 rounded-lg border border-border/20 bg-background/50 px-2.5 py-1 text-xs">
                              <span className="font-semibold text-muted-foreground">{item.label}:</span>
                              <span className={`font-bold ${item.ready ? "text-emerald-600" : "text-amber-600"}`}>
                                {item.ready ? "Ready" : item.pendingLabel}
                              </span>
                            </div>
                          ))}
                        </div>
                      </section>

                      <section className="space-y-3">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          <FileText className="h-4 w-4 text-primary" />
                          Planned vs Actual Outcomes Summary
                        </div>
                        <div className="overflow-x-auto rounded-lg border border-border/30">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/20">
                                <TableHead className="text-xs">Comparison Metric</TableHead>
                                <TableHead className="text-xs">Expected Plan</TableHead>
                                <TableHead className="text-xs">Actual Execution</TableHead>
                                <TableHead className="text-xs">Variance / Impact</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              <TableRow>
                                <TableCell className="font-bold text-xs">Expected People / Attendance</TableCell>
                                <TableCell className="text-xs">
                                  {expectedTurnout || 0}
                                  <span className="text-muted-foreground font-normal"> ({namedAttendeeCount} named)</span>
                                </TableCell>
                                <TableCell className="text-xs font-medium">
                                  {meeting.attendanceFinalized
                                    ? `${actualAttendanceCount} present`
                                    : actualAttendanceCount > 0
                                      ? `${actualAttendanceCount} recorded (pending confirmation)`
                                      : "Not recorded"}
                                </TableCell>
                                <TableCell className={`text-xs font-extrabold ${meeting.attendanceFinalized ? (attendanceDelta >= 0 ? "text-emerald-600" : "text-red-600") : "text-muted-foreground"}`}>
                                  {meeting.attendanceFinalized ? `${attendanceDelta >= 0 ? `+${attendanceDelta}` : attendanceDelta} people` : "-"}
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell className="font-bold text-xs">Budget / Spend</TableCell>
                                <TableCell className="text-xs">{formatCurrency(meeting.expectedBudget)}</TableCell>
                                <TableCell className="text-xs font-medium">
                                  {adminPresentation.expenseComparisonReady
                                    ? formatCurrency(actualExpenseTotal)
                                    : actualExpenseTotal > 0
                                      ? `${formatCurrency(actualExpenseTotal)} recorded (pending confirmation)`
                                      : "Not recorded"}
                                </TableCell>
                                <TableCell className={`text-xs font-extrabold ${adminPresentation.expenseComparisonReady ? (expenseDelta <= 0 ? "text-emerald-600" : "text-amber-600") : "text-muted-foreground"}`}>
                                  {adminPresentation.expenseComparisonReady ? formatSignedCurrency(expenseDelta) : "-"}
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell className="font-bold text-xs">Gift Allocations</TableCell>
                                <TableCell className="text-xs">{plannedGiftQuantity || 0} planned</TableCell>
                                <TableCell className="text-xs font-medium">
                                  {adminPresentation.giftComparisonReady
                                    ? `${issuedGiftQuantity || 0} issued`
                                    : issuedGiftQuantity > 0
                                      ? `${issuedGiftQuantity} recorded (pending confirmation)`
                                      : "Not recorded"}
                                </TableCell>
                                <TableCell className={`text-xs font-extrabold ${adminPresentation.giftComparisonReady ? (giftDelta >= 0 ? "text-emerald-600" : "text-red-600") : "text-muted-foreground"}`}>
                                  {adminPresentation.giftComparisonReady ? `${giftDelta >= 0 ? `+${giftDelta}` : giftDelta} gifts` : "-"}
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      </section>

                    </div>
                  </ProgressiveSection>

                  <ProgressiveSection
                    title="Report data and CSV export"
                    summary="Open filters, export the authorized meeting data, or inspect management report views."
                  >
                    <div className="space-y-4">
                  <Card className="rounded-lg border-border/60 bg-background/40 shadow-none overflow-hidden">
                    <CardHeader className="flex flex-col gap-3 border-b border-border/20 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Report Export Options</CardTitle>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => setIsReportFiltersOpen((open) => !open)} className="rounded-lg">
                          <Filter className="h-3.5 w-3.5 mr-1" />
                          {isReportFiltersOpen ? "Hide Filter" : "Filter"}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => exportMeetingReport(reportFilters)} disabled={isExportingReport} className="rounded-lg">
                          {isExportingReport ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Download className="h-3.5 w-3.5 mr-1" />}
                          Export CSV
                        </Button>
                      </div>
                    </CardHeader>
                    {isReportFiltersOpen && (
                      <CardContent className="space-y-4 border-b border-border/20 p-5 bg-muted/10">
                        <div className="grid gap-3 grid-cols-2 md:grid-cols-6">
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold">Start Date</Label>
                            <Input
                              type="date"
                              className="h-8 text-xs rounded-lg"
                              value={reportFilters.start}
                              onChange={(event) => setReportFilters((prev) => ({ ...prev, start: event.target.value }))}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold">End Date</Label>
                            <Input
                              type="date"
                              className="h-8 text-xs rounded-lg"
                              value={reportFilters.end}
                              onChange={(event) => setReportFilters((prev) => ({ ...prev, end: event.target.value }))}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold">Status</Label>
                            <Select
                              value={reportFilters.status}
                              onValueChange={(value) => setReportFilters((prev) => ({ ...prev, status: value }))}
                            >
                              <SelectTrigger className="h-8 text-xs rounded-lg">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={REPORT_ALL_VALUE}>All statuses</SelectItem>
                                {REPORT_STATUS_OPTIONS.map((status) => (
                                  <SelectItem key={status} value={status}>
                                    {formatMeetingStatus(status)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold">Meeting Type</Label>
                            <Select
                              value={reportFilters.meetingType}
                              onValueChange={(value) => setReportFilters((prev) => ({ ...prev, meetingType: value }))}
                            >
                              <SelectTrigger className="h-8 text-xs rounded-lg">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={REPORT_ALL_VALUE}>All types</SelectItem>
                                {reportMeetingTypeOptions.map((type) => (
                                  <SelectItem key={type} value={type}>
                                    {type}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold">City</Label>
                            <Input
                              className="h-8 text-xs rounded-lg"
                              value={reportFilters.city}
                              onChange={(event) => setReportFilters((prev) => ({ ...prev, city: event.target.value }))}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold">State</Label>
                            <Input
                              className="h-8 text-xs rounded-lg"
                              value={reportFilters.state}
                              onChange={(event) => setReportFilters((prev) => ({ ...prev, state: event.target.value }))}
                            />
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={useCurrentMeetingReportFilters} className="text-xs h-7 rounded-md">
                            This Meeting
                          </Button>
                          <Button variant="outline" size="sm" onClick={resetReportToMonth} className="text-xs h-7 rounded-md">
                            Month View
                          </Button>
                        </div>
                      </CardContent>
                    )}
                  </Card>

                  <Card className="rounded-lg border-border/60 bg-background/40 shadow-none overflow-hidden">
                    <CardContent className="p-0">
                      <div className="grid lg:grid-cols-[220px_1fr]">
                        <aside className="border-b lg:border-b-0 lg:border-r border-border/20 p-4 bg-muted/10 shrink-0">
                          <div className="mb-2 px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Summary Views
                          </div>
                          <div className="flex gap-1.5 overflow-x-auto lg:flex-col lg:overflow-visible scrollbar-none">
                            {REPORT_VIEW_OPTIONS.map((option) => (
                              <button
                                key={option.key}
                                type="button"
                                onClick={() => setActiveReportView(option.key)}
                                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-left text-xs font-bold transition-all shrink-0 ${
                                  activeReportView === option.key
                                    ? "bg-primary/10 text-primary"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                }`}
                              >
                                <span className={`h-1.5 w-1.5 rounded-full ${activeReportView === option.key ? "bg-primary" : "bg-border"}`} />
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </aside>

                        <div className="p-4 space-y-3 min-w-0">
                          <div className="flex items-center justify-between gap-3 border-b border-border/10 pb-2">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">{activeReportMeta.label}</h4>
                            <span className="text-[10px] font-bold text-muted-foreground">{activeReportCount} records</span>
                          </div>

                          <div className="overflow-x-auto">
                            {activeReportView === "summary" && (
                              <ReportSectionCard title="Meeting Summary Database">
                                {reportMeetings.length ? (
                                  <Table className="min-w-[700px]">
                                    <TableHeader>
                                      <TableRow className="bg-muted/20">
                                        <TableHead className="text-xs">Meeting</TableHead>
                                        <TableHead className="text-xs">Date</TableHead>
                                        <TableHead className="text-xs">Dealer</TableHead>
                                        <TableHead className="text-xs">Location</TableHead>
                                        <TableHead className="text-xs">Owner</TableHead>
                                        <TableHead className="text-xs">Status</TableHead>
                                        <TableHead className="text-xs">Budget</TableHead>
                                        <TableHead className="text-xs">Attendance</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {reportMeetings.map((item) => (
                                        <TableRow key={item.id}>
                                          <TableCell className="py-2.5">
                                            <div className="font-semibold text-xs">{item.meetingType || "-"}</div>
                                            <div className="max-w-[150px] truncate text-[10px] text-muted-foreground">
                                              {item.customerReference || item.storeName || item.dealerName || `ID: #${item.id}`}
                                            </div>
                                          </TableCell>
                                          <TableCell className="text-xs">{formatDate(item.meetingDate)}</TableCell>
                                          <TableCell className="text-xs font-medium">{getMeetingDealerLabel(item)}</TableCell>
                                          <TableCell className="text-xs text-muted-foreground">{[item.city, item.state].filter(Boolean).join(", ") || "-"}</TableCell>
                                          <TableCell className="text-xs text-muted-foreground">{item.creatorName || "-"}</TableCell>
                                          <TableCell>
                                            <Badge variant="outline" className={`text-[9px] px-1.5 font-bold ${statusBadgeClass(item.status)}`}>
                                              {getMeetingStatusLabel(item)}
                                            </Badge>
                                          </TableCell>
                                          <TableCell className="text-xs font-bold">{formatCurrency(item.expectedBudget)}</TableCell>
                                          <TableCell className="text-xs font-medium">
                                            {getActualAttendanceCount(item)}/{item.expectedAttendees || item.attendees?.length || 0}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                ) : (
                                  <ReportEmptyState label="No meetings found for these filters." />
                                )}
                              </ReportSectionCard>
                            )}

                            {activeReportView === "expenses" && (
                              <ReportSectionCard title="Planned vs Actual Spends Summary">
                                {reportExpenseRows.length ? (
                                  <Table className="min-w-[600px]">
                                    <TableHeader>
                                      <TableRow className="bg-muted/20">
                                        <TableHead className="text-xs">Expense Head</TableHead>
                                        <TableHead className="text-xs">Planned</TableHead>
                                        <TableHead className="text-xs">Actual</TableHead>
                                        <TableHead className="text-xs">Difference</TableHead>
                                        <TableHead className="text-xs">Company</TableHead>
                                        <TableHead className="text-xs">Dealer</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {reportExpenseRows.map((row) => (
                                        <TableRow key={row.head}>
                                          <TableCell className="py-2"><ExpenseHeadChip head={row.head} /></TableCell>
                                          <TableCell className="text-xs font-semibold">{formatCurrency(row.planned)}</TableCell>
                                          <TableCell className="text-xs font-semibold">{formatCurrency(row.actual)}</TableCell>
                                          <TableCell className={`text-xs font-bold ${row.difference > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                                            {formatSignedCurrency(row.difference)}
                                          </TableCell>
                                          <TableCell className="text-xs font-medium text-muted-foreground">{formatCurrency(row.company)}</TableCell>
                                          <TableCell className="text-xs font-medium text-muted-foreground">{formatCurrency(row.dealer)}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                ) : (
                                  <ReportEmptyState label="No planned or actual expenses found." />
                                )}
                              </ReportSectionCard>
                            )}

                            {activeReportView === "gifts" && (
                              <ReportSectionCard title="Planned vs Issued Gifts Summary">
                                {reportGiftRows.length ? (
                                  <Table className="min-w-[500px]">
                                    <TableHeader>
                                      <TableRow className="bg-muted/20">
                                        <TableHead className="text-xs">Gift / Item</TableHead>
                                        <TableHead className="text-xs">Planned</TableHead>
                                        <TableHead className="text-xs">Issued</TableHead>
                                        <TableHead className="text-xs">Difference</TableHead>
                                        <TableHead className="text-xs">Estimated Cost</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {reportGiftRows.map((row) => (
                                        <TableRow key={row.item}>
                                          <TableCell className="py-2.5 font-semibold text-xs">{row.item}</TableCell>
                                          <TableCell className="text-xs font-semibold">{row.planned}</TableCell>
                                          <TableCell className="text-xs font-semibold">{row.issued}</TableCell>
                                          <TableCell className={`text-xs font-bold ${row.difference > 0 ? "text-blue-600" : "text-amber-600"}`}>
                                            {formatSignedNumber(row.difference)}
                                          </TableCell>
                                          <TableCell className="text-xs font-bold">{formatCurrency(row.estimatedAmount)}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                ) : (
                                  <ReportEmptyState label="No planned or issued gifts found." />
                                )}
                              </ReportSectionCard>
                            )}

                            {activeReportView === "dealer" && (
                              <ReportSectionCard title="Dealer Contribution Summary">
                                <ReportPerformanceTable rows={dealerPerformanceRows} labelHeader="Dealer / Shop" />
                              </ReportSectionCard>
                            )}

                            {activeReportView === "city" && (
                              <ReportSectionCard title="City Contribution Summary">
                                <ReportPerformanceTable rows={cityPerformanceRows} labelHeader="City / State" />
                              </ReportSectionCard>
                            )}

                            {activeReportView === "officer" && (
                              <ReportSectionCard title="Field Officer Performance Log">
                                <ReportPerformanceTable rows={fieldOfficerPerformanceRows} labelHeader="Field Officer" />
                              </ReportSectionCard>
                            )}

                            {activeReportView === "market" && (
                              <ReportSectionCard title="Market Contacts Database">
                                {marketDatabaseRows.length ? (
                                  <Table className="min-w-[800px]">
                                    <TableHeader>
                                      <TableRow className="bg-muted/20">
                                        <TableHead className="text-xs">Name</TableHead>
                                        <TableHead className="text-xs">Mobile</TableHead>
                                        <TableHead className="text-xs">Category</TableHead>
                                        <TableHead className="text-xs">City / Area</TableHead>
                                        <TableHead className="text-xs">Company / Project</TableHead>
                                        <TableHead className="text-xs">Meeting Type</TableHead>
                                        <TableHead className="text-xs">Dealer Reference</TableHead>
                                        <TableHead className="text-xs">Status</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {marketDatabaseRows.map((row) => (
                                        <TableRow key={`${row.mobile}-${row.name}`}>
                                          <TableCell className="font-semibold text-xs py-2">{row.name}</TableCell>
                                          <TableCell className="text-xs text-muted-foreground">{row.mobile}</TableCell>
                                          <TableCell className="text-xs font-medium">{row.category}</TableCell>
                                          <TableCell className="text-xs text-muted-foreground">{row.cityArea}</TableCell>
                                          <TableCell className="text-xs text-muted-foreground">{row.companyShopProject}</TableCell>
                                          <TableCell className="text-xs font-semibold">{row.meetingType}</TableCell>
                                          <TableCell className="text-xs text-muted-foreground">{row.dealer}</TableCell>
                                          <TableCell className="text-xs">
                                            <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 rounded-full font-bold">
                                              {row.status}
                                            </Badge>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                ) : (
                                  <ReportEmptyState label="No attendee contact data found." />
                                )}
                              </ReportSectionCard>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                    </div>
                  </ProgressiveSection>
                </>
              ) : (
                <Card className="rounded-xl border border-border/30 bg-card/40 backdrop-blur-md shadow-sm">
                  <CardContent className="flex flex-col items-center gap-3 px-5 py-10 text-center">
                    <FileText className="h-7 w-7 text-muted-foreground animate-pulse" />
                    <div className="space-y-1">
                      <div className="font-bold text-foreground text-sm">Awaiting Final Outcome Report</div>
                      <div className="max-w-md text-xs leading-relaxed text-muted-foreground">
                        The final report details, comparison charts, and CSV data downloads will unlock here once the field team finishes compiling their post-meeting summaries.
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {adminTab === "history" && (
            <Card id="meeting-admin-panel-history" role="tabpanel" className="rounded-xl border border-border/30 bg-card/40 backdrop-blur-md shadow-sm overflow-hidden">
              <CardHeader className="border-b border-border/20 px-5 py-4">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground font-semibold">Workflow History Trail</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {auditHistory.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table className="min-w-[700px]">
                      <TableHeader>
                        <TableRow className="bg-muted/20">
                          <TableHead className="px-5 text-xs">Action Taken</TableHead>
                          <TableHead className="text-xs">Transition</TableHead>
                          <TableHead className="text-xs">Correction Section</TableHead>
                          <TableHead className="text-xs">Decision Remarks</TableHead>
                          <TableHead className="text-xs">Performed By</TableHead>
                          <TableHead className="pr-5 text-xs text-right">Timestamp</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {auditHistory.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell className="px-5 font-bold text-xs py-3 text-primary">{entry.action}</TableCell>
                            <TableCell className="text-xs font-semibold">
                              {[entry.fromStatus, entry.toStatus].filter(Boolean).join(" → ") || "-"}
                            </TableCell>
                            <TableCell className="text-xs">
                              {entry.correctionStage ? (
                                <Badge variant="outline" className="text-[10px] px-2 rounded-full border-amber-200/50 bg-amber-500/10 text-amber-600 font-bold">
                                  {entry.correctionStage}
                                </Badge>
                              ) : "-"}
                            </TableCell>
                            <TableCell className="max-w-[220px] truncate text-xs font-medium text-muted-foreground" title={entry.remarks || ""}>
                              {entry.remarks || "-"}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground font-semibold">{entry.performedByName || entry.performedById || "-"}</TableCell>
                            <TableCell className="pr-5 text-right text-[11px] text-muted-foreground">
                              {entry.performedAt ? format(new Date(entry.performedAt), "dd MMM yyyy, HH:mm") : "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="p-5 text-xs text-muted-foreground text-center">No history trail logs recorded yet.</div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
        </div>
      </div>
      {approvalDecisionDialog}
      {finalReviewDecisionDialog}
      {cancelMeetingDialog}
      </>
    );
  }

  return (
    <>
    <div className="flex flex-col gap-4 lg:h-[calc(100vh-6.5rem)] lg:overflow-hidden min-w-0">
      {/* Top Header & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-border/30 bg-card/40 backdrop-blur-md p-4 shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/dashboard/meetings")}
            className="shrink-0 rounded-xl h-9"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back
          </Button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-extrabold tracking-tight text-foreground truncate">
                {meeting.meetingType} Meeting
              </h1>
              <Badge variant="outline" className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${statusBadgeClass(meeting.status)}`}>
                {getMeetingStatusLabel(meeting)}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground font-medium mt-0.5 flex items-center gap-2">
              <span>{[meeting.city, meeting.state].filter(Boolean).join(", ") || "No location set"}</span>
              <span>•</span>
              <span>{formatDate(meeting.meetingDate)} at {formatMeetingTime(meeting.meetingTime)}</span>
              {meeting.storeName && (
                <>
                  <span>•</span>
                  <span>Store: {meeting.storeName}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={loadMeeting} disabled={isSaving} className="rounded-xl h-9">
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isSaving ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          {canSubmit && (
            <Button size="sm" onClick={submitForApproval} disabled={isSaving} className="rounded-xl h-9 font-bold">
              <Send className="h-3.5 w-3.5 mr-1.5" />
              Submit Plan
            </Button>
          )}
        </div>
      </div>

      {/* Top KPI Bar */}
      <div className="shrink-0">
        <MeetingKpiGrid
          status={meeting.status}
          statusValue={getMeetingStageLabel(meeting)}
          secondaryLabel={showActualSummary ? "Gifts Issued" : "Planned Gifts"}
          secondaryValue={showActualSummary ? issuedGiftDisplay : plannedGiftDisplay}
          financialLabel="Expected Budget"
          financialValue={formatCurrency(meeting.expectedBudget)}
          financialSubMetrics={[
            { label: "Actual Expenses", value: formatCurrency(actualExpenseTotal) },
            {
              label: "Difference",
              value: formatCurrency(budgetDifference),
              valueClassName: budgetDifference <= 0 ? "text-emerald-600 font-extrabold" : "text-amber-600 font-extrabold",
            },
          ]}
          attendanceLabel={showActualSummary ? "Actual Attendance" : "Expected People"}
          attendanceValue={showActualSummary ? `${actualAttendanceCount}/${namedAttendeeCount || expectedTurnout || 0}` : String(expectedTurnout || 0)}
          attendanceSubMetrics={[{ label: "Named Attendees", value: String(namedAttendeeCount) }]}
        />
      </div>

      {/* Notices */}
      {message && <div className="rounded-xl border border-emerald-200/30 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-600 shrink-0">{message}</div>}
      {error && <div className="rounded-xl border border-red-200/30 bg-red-500/10 p-3 text-xs font-semibold text-red-600 shrink-0">{error}</div>}

      {meeting.status === "CORRECTION_REQUIRED" && meeting.correctionRemarks && (
        <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-3.5 text-xs text-orange-900 space-y-1 shrink-0">
          <div className="font-extrabold flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            Correction Stage: {correctionStageLabel(meeting.correctionStage)}
          </div>
          <div className="leading-relaxed opacity-90">{meeting.correctionRemarks}</div>
        </div>
      )}

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[176px_minmax(0,1fr)]">
      <div role="tablist" aria-label="Meeting workflow sections" className="flex gap-1.5 overflow-x-auto rounded-xl border border-border/30 bg-muted/40 p-1.5 scrollbar-none lg:self-start lg:flex-col lg:overflow-visible">
        {WORKFLOW_TABS.map((tab) => {
          const enabled = isMeetingTabEnabled(meeting, tab.key);
          return (
            <Button
              key={tab.key}
              type="button"
              variant="ghost"
              size="sm"
              disabled={!enabled}
              onClick={() => setActiveTab(tab.key)}
              className={`shrink-0 justify-start rounded-lg text-xs font-bold transition-all px-4 py-2 flex items-center gap-1.5 ${
                activeTab === tab.key
                  ? "bg-background text-foreground shadow-md font-extrabold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              {!enabled && <Lock className="h-3.5 w-3.5" />}
              {tab.label}
            </Button>
          );
        })}
      </div>

      <div className="min-w-0 lg:overflow-y-auto pb-4 pr-1 scrollbar-thin space-y-5">
        {activeTab === "request" && (
          <Card className="rounded-xl border border-border/30 bg-card/40 backdrop-blur-md shadow-sm">
            <CardHeader className="border-b border-border/20 px-5 py-4">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Request Details</CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              {canEditRequest ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground">Meeting type</Label>
                    <Select value={requestForm.meetingType} onValueChange={(value) => updateRequestForm("meetingType", value)}>
                      <SelectTrigger className="w-full rounded-lg h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {typeOptions.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground">Expected budget (INR)</Label>
                    <Input type="number" className="rounded-lg h-9" value={requestForm.expectedBudget} onChange={(event) => updateRequestForm("expectedBudget", event.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground">Expected people</Label>
                    <Input type="number" className="rounded-lg h-9" min="0" value={requestForm.expectedAttendees} onChange={(event) => updateRequestForm("expectedAttendees", event.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground">Planned Date</Label>
                    <Input type="date" className="rounded-lg h-9" value={requestForm.meetingDate} onChange={(event) => updateRequestForm("meetingDate", event.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground">Planned Time</Label>
                    <Input type="time" className="rounded-lg h-9" value={requestForm.meetingTime} onChange={(event) => updateRequestForm("meetingTime", event.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground">City</Label>
                    <Input className="rounded-lg h-9" value={requestForm.city} onChange={(event) => updateRequestForm("city", event.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground">State</Label>
                    <Input className="rounded-lg h-9" value={requestForm.state} onChange={(event) => updateRequestForm("state", event.target.value)} />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs font-bold text-muted-foreground">Execution Location Address</Label>
                    <Input className="rounded-lg h-9" value={requestForm.location} onChange={(event) => updateRequestForm("location", event.target.value)} />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs font-bold text-muted-foreground">Dealer / Shop / Customer Reference</Label>
                    <Input className="rounded-lg h-9" value={requestForm.customerReference} onChange={(event) => updateRequestForm("customerReference", event.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground">Company contribution (INR)</Label>
                    <Input type="number" min="0" max={requestForm.expectedBudget || undefined} className="rounded-lg h-9" value={requestForm.companyContribution} onChange={(event) => updateRequestForm("companyContribution", event.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground">Dealer contribution (INR)</Label>
                    <Input className="rounded-lg h-9" value={requestDealerContribution} readOnly aria-readonly="true" />
                    <p className="text-[11px] text-muted-foreground">Calculated automatically from the expected budget.</p>
                  </div>
                  <label className="flex items-center gap-2 rounded-xl border border-border/20 bg-muted/10 p-3 text-xs font-semibold sm:col-span-2 cursor-pointer hover:bg-muted/20 transition-all">
                    <Checkbox
                      checked={requestForm.allowWalkInAttendees}
                      onCheckedChange={(checked) => updateRequestForm("allowWalkInAttendees", checked === true)}
                    />
                    Allow walk-in attendees during execution
                  </label>
                  <div className="sm:col-span-2">
                    <Button onClick={saveRequest} disabled={isSaving} className="rounded-xl font-bold">
                      {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
                      Save Request Plan
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                  <ReadOnlyField label="Meeting type" value={meeting.meetingType} />
                  <ReadOnlyField label="Planned Date" value={formatDate(meeting.meetingDate)} />
                  <ReadOnlyField label="Planned Time" value={formatMeetingTime(meeting.meetingTime)} />
                  <ReadOnlyField label="City" value={meeting.city} />
                  <ReadOnlyField label="State" value={meeting.state} />
                  <ReadOnlyField label="Location" value={meeting.location} />
                  <ReadOnlyField label="Reference" value={meeting.customerReference} />
                  <ReadOnlyField label="Expected budget" value={formatCurrency(meeting.expectedBudget)} />
                  <ReadOnlyField label="Expected people" value={meeting.expectedAttendees} />
                  <ReadOnlyField label="Named attendees" value={meeting.attendees?.length || 0} />
                  <ReadOnlyField label="Company contribution" value={formatCurrency(meeting.plan?.companyContribution)} />
                  <ReadOnlyField label="Dealer contribution" value={formatCurrency(meeting.plan?.dealerContribution)} />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "attendees" && (
          <Card className="rounded-xl border border-border/30 bg-card/40 backdrop-blur-md shadow-sm overflow-hidden">
            <CardHeader className="border-b border-border/20 px-5 py-4 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Named Attendees</CardTitle>
              {canEditRequest && (
                <Button variant="outline" size="sm" onClick={() => setAttendees((prev) => [...prev, attendeeDraft()])} className="rounded-lg font-bold text-xs h-8">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Row
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              {canEditRequest ? (
                <>
                  <div className="space-y-3">
                    {attendees.map((attendee, index) => (
                      <div key={index} className="rounded-xl border border-border/20 bg-muted/5 p-4 relative group hover:border-border/40 transition-all">
                        <div className="mb-3.5 flex items-center justify-between">
                          <span className="text-xs font-extrabold text-primary uppercase tracking-wider">Attendee #{index + 1}</span>
                          {attendees.length > 1 && (
                            <Button variant="ghost" size="sm" onClick={() => setAttendees((prev) => prev.filter((_, currentIndex) => currentIndex !== index))} className="h-6 text-red-600 hover:text-red-700 hover:bg-red-50 text-[11px] font-bold rounded-md">
                              Remove
                            </Button>
                          )}
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                          <Input placeholder="Full Name" className="rounded-lg h-9 text-xs" value={attendee.name} onChange={(event) => setAttendees((prev) => prev.map((item, currentIndex) => currentIndex === index ? { ...item, name: event.target.value } : item))} />
                          <Input placeholder="Mobile Number" className="rounded-lg h-9 text-xs" value={attendee.mobileNumber} onChange={(event) => setAttendees((prev) => prev.map((item, currentIndex) => currentIndex === index ? { ...item, mobileNumber: event.target.value } : item))} />
                          <Select value={attendee.category || "mason"} onValueChange={(value) => setAttendees((prev) => prev.map((item, currentIndex) => currentIndex === index ? { ...item, category: value } : item))}>
                            <SelectTrigger className="w-full rounded-lg h-9 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ATTENDEE_CATEGORIES.map((category) => (
                                <SelectItem key={category} value={category} className="text-xs">
                                  {category}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input placeholder="City / area" className="rounded-lg h-9 text-xs" value={attendee.cityArea || ""} onChange={(event) => setAttendees((prev) => prev.map((item, currentIndex) => currentIndex === index ? { ...item, cityArea: event.target.value } : item))} />
                          <Input placeholder="Company / shop / project" className="rounded-lg h-9 text-xs" value={attendee.companyShopProject || ""} onChange={(event) => setAttendees((prev) => prev.map((item, currentIndex) => currentIndex === index ? { ...item, companyShopProject: event.target.value } : item))} />
                          <Input placeholder="Email Address" className="rounded-lg h-9 text-xs" value={attendee.email || ""} onChange={(event) => setAttendees((prev) => prev.map((item, currentIndex) => currentIndex === index ? { ...item, email: event.target.value } : item))} />
                          <Input className="sm:col-span-2 md:col-span-3 rounded-lg h-9 text-xs" placeholder="Remarks" value={attendee.remarks || ""} onChange={(event) => setAttendees((prev) => prev.map((item, currentIndex) => currentIndex === index ? { ...item, remarks: event.target.value } : item))} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button onClick={saveAttendees} disabled={isSaving} className="rounded-xl font-bold">
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
                    Save Named Attendees
                  </Button>
                </>
              ) : (
                <div className="overflow-x-auto border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/20">
                        <TableHead className="px-4 py-3 text-xs">Name</TableHead>
                        <TableHead className="px-4 py-3 text-xs">Mobile</TableHead>
                        <TableHead className="px-4 py-3 text-xs">Category</TableHead>
                        <TableHead className="px-4 py-3 text-xs">City / Area</TableHead>
                        <TableHead className="px-4 py-3 text-xs text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(meeting.attendees || []).map((attendee) => (
                        <TableRow key={attendee.id || attendee.mobileNumber}>
                          <TableCell className="px-4 py-3 font-semibold text-xs">{attendee.name}</TableCell>
                          <TableCell className="px-4 py-3 text-xs text-muted-foreground">{attendee.mobileNumber}</TableCell>
                          <TableCell className="px-4 py-3 text-xs font-semibold">{attendee.category}</TableCell>
                          <TableCell className="px-4 py-3 text-xs text-muted-foreground">{attendee.cityArea || "-"}</TableCell>
                          <TableCell className="px-4 py-3 text-right">
                            {attendee.present ? (
                              <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 text-[9px] px-1.5 font-bold rounded-full">Present</Badge>
                            ) : attendee.expected ? (
                              <Badge variant="outline" className="text-[9px] px-1.5 rounded-full font-bold">Expected</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[9px] px-1.5 rounded-full">Walk-in</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "approval" && (
          <Card className="rounded-xl border border-border/30 bg-card/40 backdrop-blur-md shadow-sm">
            <CardHeader className="border-b border-border/20 px-5 py-4">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Admin Approval Summary</CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <ReadOnlyField label="Workflow Status" value={getMeetingStatusLabel(meeting)} />
                <ReadOnlyField label="Budget Request" value={formatCurrency(meeting.expectedBudget)} />
                <ReadOnlyField label="Admin Review Remarks" value={meeting.approvalRemarks} />
              </div>
              {canApprove || canReject || canRequestCorrection ? (
                <Button className="rounded-xl font-bold" onClick={() => setIsApprovalDecisionOpen(true)}>
                  <CheckCircle2 className="h-4 w-4 mr-1.5" />
                  Review Decision Actions
                </Button>
              ) : (
                <LockedPanel label="Admin decision controls are locked. They open only when a meeting is in PENDING_APPROVAL status." />
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "execution" && (
          <Card className="rounded-xl border border-border/30 bg-card/40 backdrop-blur-md shadow-sm">
            <CardHeader className="border-b border-border/20 px-5 py-4">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Meeting Execution Log</CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-5">
              {canExecute || canMarkAttendance ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-muted-foreground">Actual date conducted</Label>
                      <Input type="date" className="rounded-lg h-9 text-xs" value={executionForm.actualMeetingDate} onChange={(event) => setExecutionForm((prev) => ({ ...prev, actualMeetingDate: event.target.value }))} disabled={!canExecute} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-muted-foreground">Actual time conducted</Label>
                      <Input type="time" className="rounded-lg h-9 text-xs" value={executionForm.actualMeetingTime} onChange={(event) => setExecutionForm((prev) => ({ ...prev, actualMeetingTime: event.target.value }))} disabled={!canExecute} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-muted-foreground">Actual execution location address</Label>
                      <Input className="rounded-lg h-9 text-xs" value={executionForm.actualLocation} onChange={(event) => setExecutionForm((prev) => ({ ...prev, actualLocation: event.target.value }))} disabled={!canExecute} />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2 md:col-span-3">
                      <Label className="text-xs font-bold text-muted-foreground">Execution remarks</Label>
                      <Textarea className="rounded-lg min-h-16" value={executionForm.executionRemarks} onChange={(event) => setExecutionForm((prev) => ({ ...prev, executionRemarks: event.target.value }))} disabled={!canExecute} />
                    </div>
                  </div>
                  {canExecute && (
                    <Button onClick={executeMeeting} disabled={isSaving} className="rounded-xl font-bold">
                      <UserCheck className="h-4 w-4 mr-1.5" />
                      Save & Start Execution
                    </Button>
                  )}
                  {canMarkAttendance && (
                    <div className="space-y-3.5 border-t border-border/20 pt-4">
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Mark Actual Attendance</h3>
                      <div className="overflow-x-auto border rounded-xl bg-background/50">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/20">
                              <TableHead className="w-16 text-center text-xs">Present</TableHead>
                              <TableHead className="text-xs">Attendee Name</TableHead>
                              <TableHead className="text-xs">Mobile Number</TableHead>
                              <TableHead className="text-xs">Category</TableHead>
                              <TableHead className="pr-4 text-xs">Individual Remarks</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(meeting.attendees || []).map((attendee) => (
                              <TableRow key={attendee.id || attendee.mobileNumber}>
                                <TableCell className="text-center py-2.5">
                                  <Checkbox
                                    className="rounded"
                                    checked={attendee.id != null ? attendance[attendee.id]?.present === true : false}
                                    disabled={attendee.id == null}
                                    onCheckedChange={(checked) =>
                                      attendee.id != null &&
                                      setAttendance((prev) => ({
                                        ...prev,
                                        [attendee.id as number]: {
                                          present: checked === true,
                                          remarks: prev[attendee.id as number]?.remarks || "",
                                        },
                                      }))
                                    }
                                  />
                                </TableCell>
                                <TableCell className="text-xs font-semibold">{attendee.name}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">{attendee.mobileNumber}</TableCell>
                                <TableCell className="text-xs font-medium text-foreground">{attendee.category}</TableCell>
                                <TableCell className="pr-4 py-1.5">
                                  <Input
                                    className="h-8 rounded-md text-xs bg-background/70"
                                    value={attendee.id != null ? attendance[attendee.id]?.remarks || "" : ""}
                                    disabled={attendee.id == null}
                                    onChange={(event) =>
                                      attendee.id != null &&
                                      setAttendance((prev) => ({
                                        ...prev,
                                        [attendee.id as number]: {
                                          present: prev[attendee.id as number]?.present === true,
                                          remarks: event.target.value,
                                        },
                                      }))
                                    }
                                  />
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      <Button onClick={saveAttendance} disabled={isSaving} className="rounded-xl font-bold">
                        <Save className="h-4 w-4 mr-1.5" />
                        Finalise & Confirm Attendance
                      </Button>
                    </div>
                  )}
                  {meeting.allowWalkInAttendees !== false && canMarkAttendance && (
                    <div className="space-y-3 rounded-xl border border-border/20 bg-muted/5 p-4 mt-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-primary">Record Walk-in Attendee</h3>
                      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                        <Input placeholder="Name" className="rounded-lg h-9 text-xs" value={walkIn.name} onChange={(event) => setWalkIn((prev) => ({ ...prev, name: event.target.value }))} />
                        <Input placeholder="Mobile Number" className="rounded-lg h-9 text-xs" value={walkIn.mobileNumber} onChange={(event) => setWalkIn((prev) => ({ ...prev, mobileNumber: event.target.value }))} />
                        <Select value={walkIn.category || "mason"} onValueChange={(value) => setWalkIn((prev) => ({ ...prev, category: value }))}>
                          <SelectTrigger className="w-full rounded-lg h-9 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ATTENDEE_CATEGORIES.map((category) => (
                              <SelectItem key={category} value={category} className="text-xs">
                                {category}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input placeholder="City / Area" className="rounded-lg h-9 text-xs" value={walkIn.cityArea || ""} onChange={(event) => setWalkIn((prev) => ({ ...prev, cityArea: event.target.value }))} />
                        <Input placeholder="Company / Project / Shop" className="rounded-lg h-9 text-xs" value={walkIn.companyShopProject || ""} onChange={(event) => setWalkIn((prev) => ({ ...prev, companyShopProject: event.target.value }))} />
                        <Input placeholder="Remarks" className="rounded-lg h-9 text-xs" value={walkIn.remarks || ""} onChange={(event) => setWalkIn((prev) => ({ ...prev, remarks: event.target.value }))} />
                      </div>
                      <Button variant="outline" onClick={addWalkIn} disabled={isSaving} className="rounded-lg font-bold text-xs h-9">
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Add & Mark Present
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <LockedPanel label="Execution controls are locked. They open only after the request plan is approved." />
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "gifts" && (
          <Card className="rounded-xl border border-border/30 bg-card/40 backdrop-blur-md shadow-sm">
            <CardHeader className="border-b border-border/20 px-5 py-4 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Distribute Gifts</CardTitle>
              {canIssueGifts && (
                <Button variant="outline" size="sm" onClick={() => setGifts((prev) => [...prev, giftDraft(presentAttendees[0]?.id)])} className="rounded-lg font-bold text-xs h-8">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Gift Line
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              {canIssueGifts ? (
                <>
                  <div className="rounded-lg border border-border/20 bg-muted/10 px-4 py-2.5 text-xs text-muted-foreground leading-relaxed">
                    Gifts can be issued only to attendees marked <strong>Present</strong>.
                  </div>
                  <div className="space-y-3">
                    {gifts.map((gift, index) => (
                      <div key={index} className="grid gap-3 rounded-xl border border-border/20 p-3 md:grid-cols-3 items-end bg-muted/5 relative">
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold text-muted-foreground">Attendee</Label>
                          <Select
                            value={gift.meetingAttendeeId ? String(gift.meetingAttendeeId) : ""}
                            onValueChange={(value) => setGifts((prev) => prev.map((item, currentIndex) => currentIndex === index ? { ...item, meetingAttendeeId: Number(value) } : item))}
                          >
                            <SelectTrigger className="w-full rounded-lg h-9 text-xs">
                              <SelectValue placeholder="Select Present Attendee" />
                            </SelectTrigger>
                            <SelectContent>
                              {presentAttendees.map((attendee) => (
                                <SelectItem key={attendee.id} value={String(attendee.id)} className="text-xs">
                                  {attendee.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold text-muted-foreground">Gift / Material Item</Label>
                          {currentGiftOptions.length ? (
                            <Select
                              value={gift.giftItem || ""}
                              onValueChange={(value) => setGifts((prev) => prev.map((item, currentIndex) => currentIndex === index ? { ...item, giftItem: value } : item))}
                            >
                              <SelectTrigger className="w-full rounded-lg h-9 text-xs">
                                <SelectValue placeholder="Select Item" />
                              </SelectTrigger>
                              <SelectContent>
                                {currentGiftOptions.map((item) => (
                                  <SelectItem key={item} value={item} className="text-xs">
                                    {item}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input placeholder="Enter Gift name" className="rounded-lg h-9 text-xs" value={gift.giftItem} onChange={(event) => setGifts((prev) => prev.map((item, currentIndex) => currentIndex === index ? { ...item, giftItem: event.target.value } : item))} />
                          )}
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold text-muted-foreground">Quantity</Label>
                          <Input type="number" min="1" className="rounded-lg h-9 text-xs" placeholder="Qty" value={gift.quantity} onChange={(event) => setGifts((prev) => prev.map((item, currentIndex) => currentIndex === index ? { ...item, quantity: Number(event.target.value) } : item))} />
                        </div>
                        {gifts.length > 1 && (
                          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg hover:bg-red-50 text-red-600 hover:text-red-700 shrink-0 justify-self-end" onClick={() => removeGift(index)} disabled={isSaving} aria-label="Remove gift line">
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button onClick={saveGifts} disabled={isSaving || presentAttendees.length === 0} className="rounded-xl font-bold">
                      <Gift className="h-4 w-4 mr-1.5" />
                      Save Gift Logs
                    </Button>
                    <Button variant="outline" onClick={markNoGifts} disabled={isSaving} className="rounded-xl text-xs h-10">
                      Mark No Gifts Distributed
                    </Button>
                  </div>
                </>
              ) : (
                <LockedPanel label="Gifts distribution panel is locked. It opens after meeting execution is started and requires present attendees to be recorded." />
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "expenses" && (
          <Card className="rounded-xl border border-border/30 bg-card/40 backdrop-blur-md shadow-sm">
            <CardHeader className="border-b border-border/20 px-5 py-4 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Actual Expenses Spends</CardTitle>
              {canSubmitExpenses && (
                <Button variant="outline" size="sm" onClick={() => setExpenses((prev) => [...prev, expenseDraft(executionForm.actualMeetingDate || meeting.meetingDate)])} className="rounded-lg font-bold text-xs h-8">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Expense Line
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              {canSubmitExpenses ? (
                <>
                  <div className="grid gap-3 grid-cols-3">
                    <ReadOnlyField label="Approved Budget" value={formatCurrency(meeting.expectedBudget)} />
                    <ReadOnlyField label="Recorded Spent" value={formatCurrency(expenseSubmissionTotal)} />
                    <ReadOnlyField label="Variance Difference" value={formatCurrency(expenseSubmissionTotal - Number(meeting.expectedBudget || 0))} />
                  </div>
                  {plannedExpenses.filter((expense) => !isGiftExpenseHead(expense.expenseHead)).length > 0 && (
                    <div className="overflow-hidden rounded-lg border border-border/30">
                      <div className="border-b bg-muted/20 px-4 py-2.5 text-xs font-bold text-muted-foreground">Planned expenses</div>
                      <Table>
                        <TableBody>
                          {plannedExpenses.filter((expense) => !isGiftExpenseHead(expense.expenseHead)).map((expense, index) => (
                            <TableRow key={`${expense.expenseHead}-${index}`}>
                              <TableCell className="font-semibold text-xs">{expense.expenseHead}</TableCell>
                              <TableCell className="text-xs">{formatCurrency(expense.amount)}</TableCell>
                              <TableCell className="text-right">
                                <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => recordPlannedExpense(expense)}>
                                  Record actual
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                  {giftExpenseTotal > 0 && (
                    <div className="flex items-center justify-between rounded-lg border border-border/30 bg-muted/10 px-4 py-3 text-xs">
                      <span className="font-semibold">Calculated gift expense</span>
                      <span className="font-bold">{formatCurrency(giftExpenseTotal)} · Company paid</span>
                    </div>
                  )}
                  <div className="space-y-3">
                    {expenses.map((expense, index) => (
                      <div key={index} className="rounded-xl border border-border/20 p-4 bg-muted/5 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">Expense Line #{index + 1}</span>
                          {expenses.length > 1 && (
                            <Button variant="ghost" size="sm" className="h-6 text-red-600 hover:bg-red-50 text-[10px] font-bold rounded-md" disabled={isSaving} onClick={() => removeExpense(index)}>
                              Delete Line
                            </Button>
                          )}
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 items-end">
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-muted-foreground">Expense Head</Label>
                            <Select value={expense.expenseHead} onValueChange={(value) => setExpenses((prev) => prev.map((item, currentIndex) => currentIndex === index ? { ...item, expenseHead: value } : item))}>
                              <SelectTrigger className="w-full rounded-lg h-9 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {currentExpenseHeadOptions.map((head) => (
                                  <SelectItem key={head} value={head} className="text-xs">
                                    {head}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-muted-foreground">Amount Spent (INR)</Label>
                            <Input type="number" min="0" className="rounded-lg h-9 text-xs" value={expense.amount} onChange={(event) => setExpenses((prev) => prev.map((item, currentIndex) => currentIndex === index ? { ...item, amount: Number(event.target.value) } : item))} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-muted-foreground">Paid By</Label>
                            <Select value={expense.paidBy || "COMPANY"} onValueChange={(value) => setExpenses((prev) => prev.map((item, currentIndex) => currentIndex === index ? { ...item, paidBy: value } : item))}>
                              <SelectTrigger className="w-full rounded-lg h-9 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="COMPANY" className="text-xs">Company</SelectItem>
                                <SelectItem value="DEALER" className="text-xs">Dealer</SelectItem>
                                <SelectItem value="SHARED" className="text-xs">Shared Allocation</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-muted-foreground">Spend Date</Label>
                            <Input type="date" className="rounded-lg h-9 text-xs" value={expense.expenseDate || ""} onChange={(event) => setExpenses((prev) => prev.map((item, currentIndex) => currentIndex === index ? { ...item, expenseDate: event.target.value } : item))} />
                          </div>
                        </div>

                        {expense.paidBy === "SHARED" && (
                          <div className="grid gap-3 grid-cols-2 bg-muted/10 p-3 rounded-lg border border-border/10">
                            <div className="space-y-1.5">
                              <Label className="text-[10px] font-bold text-muted-foreground">Company Contribution Amount</Label>
                              <Input
                                type="number"
                                min="0"
                                className="h-8 text-xs rounded-md bg-background"
                                value={expense.companyAmount ?? ""}
                                placeholder="Company share"
                                onChange={(event) => setExpenses((prev) => prev.map((item, currentIndex) => currentIndex === index ? { ...item, companyAmount: Number(event.target.value) } : item))}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-[10px] font-bold text-muted-foreground">Dealer Contribution Amount</Label>
                              <Input
                                type="number"
                                min="0"
                                className="h-8 text-xs rounded-md bg-background"
                                value={expense.dealerAmount ?? ""}
                                placeholder="Dealer share"
                                onChange={(event) => setExpenses((prev) => prev.map((item, currentIndex) => currentIndex === index ? { ...item, dealerAmount: Number(event.target.value) } : item))}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button onClick={submitExpenses} disabled={isSaving} className="rounded-xl font-bold">
                      <Send className="h-4 w-4 mr-1.5" />
                      Submit Expense Report
                    </Button>
                    <Button variant="outline" onClick={markNoExpenses} disabled={isSaving} className="rounded-xl text-xs h-10">
                      Mark No Expenses Incurred
                    </Button>
                  </div>
                </>
              ) : (
                <LockedPanel label="Expense reporting panel is locked. It opens after meeting execution is recorded." />
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "finalReport" && (
          <Card className="rounded-xl border border-border/30 bg-card/40 backdrop-blur-md shadow-sm">
            <CardHeader className="border-b border-border/20 px-5 py-4">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Compile Final Report</CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-5">
              {isMeetingTabEnabled(meeting, "finalReport") ? (
                <>
                  <div className="grid gap-3 grid-cols-3">
                    <ReadOnlyField label="Total Attendees Present" value={(meeting.attendees || []).filter((attendee) => attendee.present).length} />
                    <ReadOnlyField label="Actual Total Expenses" value={formatCurrency(actualExpenseTotal || totalExpenses)} />
                    <ReadOnlyField label="Distributed Gift Categories" value={`${meeting.gifts?.length || 0} items logged`} />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs font-bold text-muted-foreground">Executive Meeting Summary</Label>
                      <Textarea className="rounded-lg min-h-24 text-xs" value={finalReport.meetingSummary} onChange={(event) => setFinalReport((prev) => ({ ...prev, meetingSummary: event.target.value }))} disabled={!canSubmitFinalReport} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-muted-foreground">Key Discussion Points</Label>
                      <Textarea className="rounded-lg min-h-20 text-xs" value={finalReport.keyDiscussionPoints} onChange={(event) => setFinalReport((prev) => ({ ...prev, keyDiscussionPoints: event.target.value }))} disabled={!canSubmitFinalReport} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-muted-foreground">Actual Business Outcomes / Commitments</Label>
                      <Textarea className="rounded-lg min-h-20 text-xs" value={finalReport.actualBusinessOutcome} onChange={(event) => setFinalReport((prev) => ({ ...prev, actualBusinessOutcome: event.target.value }))} disabled={!canSubmitFinalReport} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-muted-foreground">Leads Summary Remarks</Label>
                      <Textarea className="rounded-lg min-h-20 text-xs" value={finalReport.leadsGenerated} onChange={(event) => setFinalReport((prev) => ({ ...prev, leadsGenerated: event.target.value }))} disabled={!canSubmitFinalReport} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-muted-foreground">Total Lead Count Captured</Label>
                      <Input
                        type="number"
                        min="0"
                        className="rounded-lg h-9 text-xs"
                        value={finalReport.leadCount ?? ""}
                        onChange={(event) => setFinalReport((prev) => ({ ...prev, leadCount: event.target.value === "" ? undefined : Number(event.target.value) }))}
                        disabled={!canSubmitFinalReport}
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs font-bold text-muted-foreground">Detailed Leads Contact Info</Label>
                      <Textarea className="rounded-lg min-h-20 text-xs" value={finalReport.leadDetails} onChange={(event) => setFinalReport((prev) => ({ ...prev, leadDetails: event.target.value }))} disabled={!canSubmitFinalReport} />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs font-bold text-muted-foreground">Interested High-Value Customers / Contractors</Label>
                      <Textarea className="rounded-lg min-h-20 text-xs" value={finalReport.interestedCustomers} onChange={(event) => setFinalReport((prev) => ({ ...prev, interestedCustomers: event.target.value }))} disabled={!canSubmitFinalReport} />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs font-bold text-muted-foreground">Local Competitor Intel Collected</Label>
                      <Textarea className="rounded-lg min-h-20 text-xs" value={finalReport.competitorInformation} onChange={(event) => setFinalReport((prev) => ({ ...prev, competitorInformation: event.target.value }))} disabled={!canSubmitFinalReport} />
                    </div>
                  </div>
                  {canSubmitFinalReport && (
                    <Button onClick={submitFinalReport} disabled={isSaving} className="rounded-xl font-bold mt-2">
                      <Send className="h-4 w-4 mr-1.5" />
                      Save & Submit Final Report
                    </Button>
                  )}
                  {(canApproveFinalReport || canClose || canCancel) && (
                    <div className="flex flex-wrap gap-2 border-t border-border/20 pt-4 mt-3">
                      {(canApproveFinalReport || canClose) && (
                        <Button onClick={() => setIsFinalReviewDecisionOpen(true)} className="rounded-xl font-bold">
                          <CheckCircle2 className="h-4 w-4 mr-1.5" />
                          Review Final Approval
                        </Button>
                      )}
                      {canCancel && (
                        <Button variant="destructive" onClick={() => setIsCancelMeetingOpen(true)} className="rounded-xl font-bold">
                          Cancel Meeting
                        </Button>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <LockedPanel label="Final outcome report is locked. It unlocks only after actual expenses spends are finalized and submitted." />
              )}
            </CardContent>
          </Card>
        )}
      </div>
      </div>
    </div>
    {approvalDecisionDialog}
    {finalReviewDecisionDialog}
    {cancelMeetingDialog}
    </>
  );
}
