// API service for WebSalesV3 - All endpoints from api.md
// Use direct API calls to http://ec2-18-211-58-135.compute-1.amazonaws.com:8081
import { getApiErrorMessage } from '@/lib/api-error';
import { normalizeVisitTask } from '@/lib/visit-task';

const API_BASE_URL = 'http://ec2-18-211-58-135.compute-1.amazonaws.com:8081';
const SECONDARY_API_BASE_URL = 'http://ec2-18-211-58-135.compute-1.amazonaws.com:8081';
const DISTANCE_RECALCULATION_API_URL = `${API_BASE_URL}/attendance-log/updateDistanceTravelledForEmployeesWithOlaMaps`;

// Types based on API responses from api.md
export interface EmployeeDto {
  id: number;
  firstName: string;
  lastName: string;
  employeeId: string;
  primaryContact: number;
  secondaryContact: number;
  departmentName: string;
  email: string;
  role: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  country: string;
  pincode: number;
  dateOfJoining: string;
  createdAt: string;
  houseLatitude?: number;
  houseLongitude?: number;
  status?: string;
}

// Alias for backward compatibility
export type Employee = EmployeeDto;

export interface VisitAttachmentResponse {
  fileName: string;
  fileDownloadUri: string;
  fileType: string;
  tag?: string;
  size?: number;
}

export interface VisitDto {
  id: number;
  storeId: number;
  storeName: string;
  storeLatitude?: number;
  storeLongitude?: number;
  intent?: number;
  storePrimaryContact?: number;
  employeeId: number;
  employeeName: string;
  visit_date: string;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  visitLatitude?: number;
  visitLongitude?: number;
  checkinLatitude?: number;
  checkinLongitude?: number;
  checkoutLatitude?: number;
  checkoutLongitude?: number;
  checkinDate?: string;
  checkoutDate?: string;
  checkinTime?: string;
  checkoutTime?: string;
  vehicleType?: string;
  purpose?: string;
  priority?: string;
  outcome?: string;
  feedback?: string;
  hasGift?: boolean;
  giftName?: string | null;
  giftQuantity?: number | null;
  giftRemarks?: string | null;
  attachment?: Array<Record<string, unknown>>;
  attachmentResponse?: VisitAttachmentResponse[];
  visitIntentId?: number;
  visitIntentValue?: number;
  city?: string;
  district?: string;
  subDistrict?: string;
  state?: string;
  country?: string;
  travelAllowance?: number;
  dearnessAllowance?: number;
  salary?: number;
  isSelfGenerated?: boolean;
  brandsInUse?: Array<Record<string, unknown>>;
  brandProCons?: Array<Record<string, unknown>>;
  assignedById?: number;
  assignedByName?: string;
  statsDto?: Record<string, unknown>;
  createdAt?: string;
  createdTime?: string;
  updatedAt?: string;
  updatedTime?: string;
  intentAuditLogDto?: Record<string, unknown>;
  monthlySale?: number;
}

export interface VisitCheckoutPayload {
  checkoutLatitude: number;
  checkoutLongitude: number;
  feedback: string;
  outcome: string;
}

export interface VisitResponse {
  content: VisitDto[];
  pageable: {
    pageNumber: number;
    pageSize: number;
    sort: {
      empty: boolean;
      sorted: boolean;
      unsorted: boolean;
    };
    offset: number;
    paged: boolean;
    unpaged: boolean;
  };
  totalPages: number;
  totalElements: number;
  last: boolean;
  size: number;
  number: number;
  sort: {
    empty: boolean;
    sorted: boolean;
    unsorted: boolean;
  };
  numberOfElements: number;
  first: boolean;
  empty: boolean;
}

export interface BrandProCon {
  id: number;
  brandName: string;
  pros: string[];
  cons: string[];
}

export interface IntentAuditLog {
  id: number;
  storeId: number;
  storeName: string;
  oldIntentLevel: number;
  newIntentLevel: number;
  employeeId: number;
  employeeName: string;
  changeDate: string;
  changeTime: string;
  visitId: number;
}

export interface MonthlySaleChange {
  id: number;
  storeId: number;
  storeName: string;
  oldMonthlySale: number;
  newMonthlySale: number;
  visitId: number;
  visitDate: string;
  employeeId: number;
  employeeName: string;
  changeDate: string;
  changeTime: string;
}

export interface Task {
  id: number;
  title: string;
  description: string;
  type: string;
  status: string;
  priority: string;
  assignedTo: string;
  dueDate: string;
  visitId: number;
  assignedToId?: number;
  assignedBy?: string;
  storeName?: string;
  storeCity?: string;
  createdAt?: string;
  updatedAt?: string;
  imageCount?: number;
}

// Alias for backward compatibility
export type TaskDto = Task;

export interface Note {
  id: number;
  content: string;
  employeeId: number;
  employeeName: string;
  storeId: number;
  storeName: string;
  visitId: number | null;
  attachment?: Array<{ fileName: string; fileData: string }>;
  attachmentResponse?: Array<{
    fileName: string;
    fileDownloadUri: string;
    fileType: string;
    tag: string;
    size: number;
  }>;
  createdDate: string;
  updatedDate: string;
  createdTime: string | null;
  updatedTime: string | null;
}

// Alias for backward compatibility
export type Visit = VisitDto;

export interface LiveLocationDto {
  id: number;
  empId: number;
  empName: string;
  latitude: number;
  longitude: number;
  updatedAt: string;
  updatedTime: string;
}

// Alias for backward compatibility
export type EmployeeLocation = LiveLocationDto;

export interface AttendanceLogItem {
  id: number;
  employeeId: number;
  employeeName: string;
  attendanceStatus: string;
  visitCount: number;
  uniqueStoreCount?: number;
  travelAllowance?: number;
  dearnessAllowance?: number;
  checkinDate: string;
  checkoutDate: string;
  checkinTime: string;
  checkoutTime: string;
  fullMonthSalary?: number;
}

// Alias for backward compatibility
export type AttendanceLog = AttendanceLogItem;

export interface AttendanceStats {
  weeklyCount?: number;
  monthlyCount?: number;
  yearlyCount?: number;
  uniqueStoreCount: number;
  fullDays: number;
  halfDays: number;
  absences: number;
  travelAllowance: number;
  dearnessAllowance: number;
  salary?: number;
  expenseTotal?: number;
  statsDto: {
    visitCount: number;
    presentDays?: number;
    fullDays: number;
    halfDays: number;
    absences: number;
  };
  employeeId: number;
  employeeName: string;
}

export interface ReportCountsItem {
  weeklyCount?: number;
  monthlyCount?: number;
  yearlyCount?: number;
  uniqueStoreCount: number;
  fullDays: number;
  halfDays: number;
  absences: number;
  travelAllowance: number;
  dearnessAllowance: number;
  salary: number;
  expenseTotal: number;
  statsDto: {
    visitCount: number;
    presentDays: number;
    fullDays: number;
    halfDays: number;
    absences: number;
    expenseTotal: number;
    approvedExpense: number;
  };
  employeeId: number;
  employeeFirstName: string;
  employeeLastName: string;
}

export interface ExpenseDto {
  id: number;
  type: string;
  subType: string;
  amount: number;
  approvalPersonId: number;
  approvalPersonName: string;
  approvalStatus: string;
  description: string;
  approvalDate: string;
  submissionDate: string | null;
  rejectionReason: string | null;
  reimbursedDate: string | null;
  reimbursementAmount: number | null;
  employeeId: number;
  employeeName: string;
  expenseDate: string;
  paymentMethod: string | null;
  attachment: Array<{ fileName: string; fileData: string }>;
  attachmentResponse: Array<{ fileName: string; fileDownloadUri: string; fileType: string; tag?: string; size?: number }>;
}

export interface StoreDto {
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
  // Additional fields from API response
  landmark?: string | null;
  district?: string;
  subDistrict?: string;
  managers?: Array<{ id: number; name: string }>;
  latitude?: number | null;
  longitude?: number | null;
  brandsInUse?: Array<string>;
  employeeId?: number;
  brandProCons?: Array<{ id: number; brandName: string; pros: string[]; cons: string[] }>;
  visitThisMonth?: number;
  outcomeLastVisit?: string;
  createdAt?: string;
  updatedAt?: string;
  createdTime?: string;
  updatedTime?: string;
  secondaryContact?: number | null;
  industry?: string | null;
  companySize?: string | null;
  gstNumber?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  pincode?: number | null;
  likes?: { likeCount: number; userLiked: boolean };
  dateOfBirth?: string | null;
  dob?: string | null;
  yearOfJoining?: number | null;
}

export interface ClientTypeDto {
  id: number;
  type: string | null;
}

export interface StoreResponse {
  content: StoreDto[];
  pageable: {
    pageNumber: number;
    pageSize: number;
    sort: {
      empty: boolean;
      sorted: boolean;
      unsorted: boolean;
    };
    offset: number;
    paged: boolean;
    unpaged: boolean;
  };
  totalPages: number;
  totalElements: number;
  last: boolean;
  size: number;
  number: number;
  sort: {
    empty: boolean;
    sorted: boolean;
    unsorted: boolean;
  };
  numberOfElements: number;
  first: boolean;
  empty: boolean;
}

export interface LocationMasterDto {
  id: number;
  lgdCode: number;
  name: string;
  type: string;
}

export interface LocationPageDto {
  content: LocationMasterDto[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface EmployeeUserDto {
  id: number;
  firstName: string;
  lastName: string;
  employeeId?: string | number;
  email: string;
  role: string;
  departmentName: string;
  userName: string;
  password: string;
  primaryContact: string;
  secondaryContact?: string;
  dateOfJoining: string;
  city: string;
  state: string;
  district?: string | null;
  subDistrict?: string | null;
  country?: string;
  addressLine1?: string;
  addressLine2?: string;
  pincode?: string | number;
  assignedCity?: string[] | null;
  houseLatitude?: number;
  houseLongitude?: number;
  userDto: {
    username: string;
    password: string | null;
    roles: string | null;
    employeeId: number | null;
    firstName: string | null;
    lastName: string | null;
  };
}

export interface EmployeeStatsWithVisits {
  statsDto: {
    visitCount: number;
    fullDays: number;
    halfDays: number;
    absences: number;
  };
  visitDto: VisitDto[];
}

export interface VisitPurposeCount {
  purpose: string;
  count: number;
}

export interface EmployeeVisitSummary {
  completedVisits: number;
  visitsByPurpose: VisitPurposeCount[];
}

export interface EmployeeStatsOptimizedResponse {
  statsDto: EmployeeStatsWithVisits['statsDto'];
  summary: EmployeeVisitSummary;
  visitPage: VisitResponse;
}

export interface DashboardSummary {
  startDate: string;
  endDate: string;
  totalVisits: number;
  activeEmployees: number;
  countsByEmployee: Array<{
    employeeId: number;
    employeeName: string;
    visitCount: number;
  }>;
}

export interface EmployeeJourneyPoint {
  id: number;
  employeeId: number;
  employeeName: string;
  storeName: string;
  lat: number;
  lng: number;
  coordinateSource: string;
  visitDate: string;
  checkinDate?: string | null;
  checkinTime?: string | null;
  checkoutDate?: string | null;
  checkoutTime?: string | null;
  purpose?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
}

export interface EmployeeDashboardSummary {
  employeeId: number;
  employeeName: string;
  startDate: string;
  endDate: string;
  statsDto: EmployeeStatsWithVisits['statsDto'] & {
    presentDays?: number;
    completedVisitCount?: number;
    totalVisitCount?: number;
  };
  visitSummary: EmployeeVisitSummary;
  expenseSummary: {
    expenseCount: number;
    totalAmount: number;
    approvedCount: number;
    approvedAmount: number;
    pendingCount: number;
    pendingAmount: number;
    rejectedCount: number;
    rejectedAmount: number;
  };
  brandSummary: {
    pricingEntryCount: number;
    distinctBrandCount: number;
  };
}

export interface TeamManagerDto {
  id: number;
  firstName?: string | null;
  lastName?: string | null;
  role?: string | null;
  assignedCity?: string[] | null;
  city?: string | null;
  email?: string | null;
  deleted?: boolean;
}

export interface TeamDataDto {
  id: number;
  // Legacy aliases can still appear on older or compatibility payloads.
  office?: TeamManagerDto | null;
  officeManager?: TeamManagerDto | null;
  // Full multi-manager list from the new backend contract.
  officeManagers?: TeamManagerDto[] | null;
  fieldOfficers: EmployeeUserDto[];
}

export interface CurrentUserDto {
  password: string;
  username: string;
  authorities: Array<{
    authority: string;
  }>;
  accountNonExpired: boolean;
  accountNonLocked: boolean;
  credentialsNonExpired: boolean;
  enabled: boolean;
}

export interface DailyBreakdownDto {
  date: string;
  employeeName: string;
  employeeId: number;
  dailyDearnessAllowance: number;
  travelAllowance: number;
  totalDailySalary: number;
  dayType: string;
  completedVisits: number;
  dayOfWeek: string;
  hasAttendance: boolean;
  isSunday: boolean;
  bikeDistanceKm: number;
  carDistanceKm: number;
  dailyBaseSalary: number;
  baseEarned: number;
}

export type SalesTargetType = 'MONTHLY' | 'DAILY';

export interface SalesTargetDto {
  id: number;
  employeeId: number;
  employeeName: string;
  storeId: number;
  storeName: string;
  storeCity?: string | null;
  storeState?: string | null;
  targetType: SalesTargetType;
  month?: number | null;
  year?: number | null;
  targetDate?: string | null;
  targetTons: number;
  fulfilledTons?: number | null;
  salesTons?: number | null;
  effectiveFulfilledTons: number;
  pendingTons: number;
  achievementPercent: number;
  status: string;
  remarks?: string | null;
}

export interface SalesTargetCreatePayload {
  employeeId: number;
  storeId: number;
  targetType: SalesTargetType;
  targetTons: number;
  remarks?: string;
  month?: number;
  year?: number;
  targetDate?: string;
}

export interface SalesTargetEditPayload {
  targetTons?: number;
  fulfilledTons?: number | null;
  remarks?: string;
}

export interface SalesTargetSearchParams {
  employeeId?: number;
  storeId?: number;
  targetType?: SalesTargetType;
  month?: number;
  year?: number;
  startDate?: string;
  endDate?: string;
}

export interface FieldOfficerPerformanceDto {
  employeeId: number;
  employeeCode?: string | null;
  employeeName: string;
  city?: string | null;
  teamId?: number | null;
  startDate: string;
  endDate: string;
  targetValue: number;
  achievedValue: number;
  achievementPercent: number;
  totalVisits: number;
  completedVisits: number;
  completionRate: number;
  uniqueStoresVisited: number;
  newStores: number;
  presentDays: number;
  fullDays: number;
  halfDays: number;
  absences: number;
  rating: 'Excellent' | 'Good' | 'Average' | 'Poor' | 'Not Rated' | string;
}

export interface FieldOfficerPerformanceParams {
  startDate: string;
  endDate: string;
  employeeId?: number;
  city?: string;
  teamId?: number;
}

// API Service Class
export class API {
  private baseUrl: string;
  private token: string | null = null;
  private employeeDirectoryCache: {
    token: string | null;
    data: EmployeeUserDto[];
    expiresAt: number;
  } | null = null;
  private employeeDirectoryRequest: {
    token: string | null;
    version: number;
    promise: Promise<EmployeeUserDto[]>;
  } | null = null;
  private employeeDirectoryVersion = 0;
  private readonly employeeDirectoryTtlMs = 5 * 60 * 1000;

  constructor() {
    this.baseUrl = API_BASE_URL;
    this.loadToken();
  }

  // Simple connectivity check method
  async checkConnectivity(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.ok;
    } catch (error) {
      console.error('🌐 Connectivity check failed:', error);
      return false;
    }
  }

  // Static methods for backward compatibility
  static async getEmployees<T = EmployeeUserDto>(options?: { forceRefresh?: boolean }): Promise<T[]> {
    return apiService.getAllEmployees<T>(options);
  }

  static async getReportCounts(startDate: string, endDate: string): Promise<ReportCountsItem[]> {
    return apiService.getReportCounts(startDate, endDate);
  }

  static async getFieldOfficerPerformance(params: FieldOfficerPerformanceParams): Promise<FieldOfficerPerformanceDto[]> {
    return apiService.getFieldOfficerPerformance(params);
  }

  static async getAttendanceByDate(date: string): Promise<AttendanceLogItem[]> {
    return apiService.getAttendanceForRange(date, date);
  }

  static async recalculateDistanceForEmployeesWithOlaMaps(employeeIds: number[], startDate: string, endDate: string): Promise<string> {
    return apiService.recalculateDistanceForEmployeesWithOlaMaps(employeeIds, startDate, endDate);
  }

  static async getDailyBreakdown(employeeId: number, startDate: string, endDate: string): Promise<DailyBreakdownDto[]> {
    return apiService.getDailyBreakdown(employeeId, startDate, endDate);
  }



  static async getVisitsByDateSorted(startDate: string, endDate: string, page: number = 0, size: number = 10, sort: string = 'visitDate,desc', storeName?: string, employeeName?: string): Promise<VisitResponse> {
    return apiService.getVisitsByDateSorted(startDate, endDate, page, size, sort, storeName, employeeName);
  }

  static async getVisitsByDateSortedOld(startDate: string, endDate: string, page: number = 0, size: number = 10, sort: string = 'id,desc', employeeName?: string): Promise<VisitResponse> {
    return apiService.getVisitsByDateSortedOld(startDate, endDate, page, size, sort, employeeName);
  }

  static async getVisitsForTeam(teamId: number, startDate: string, endDate: string, page: number = 0, size: number = 10, sort: string = 'visitDate,desc', purpose?: string, priority?: string, storeName?: string, employeeName?: string): Promise<VisitResponse> {
    return apiService.getVisitsForTeam(teamId, startDate, endDate, page, size, sort, purpose, priority, storeName, employeeName);
  }

  static async getVisitsForTeams(teamIds: number[], startDate: string, endDate: string, page: number = 0, size: number = 10, sort: string = 'visitDate,desc', purpose?: string, priority?: string, outcome?: string, storeName?: string, employeeName?: string): Promise<VisitResponse> {
    return apiService.getVisitsForTeams(teamIds, startDate, endDate, page, size, sort, purpose, priority, outcome, storeName, employeeName);
  }

  static async checkoutVisit(id: number, payload: VisitCheckoutPayload): Promise<string> {
    return apiService.checkoutVisit(id, payload);
  }

  static async createNote(noteData: {
    content: string;
    employeeId: number;
    storeId: number;
    visitId: number;
  }): Promise<number> {
    return apiService.createNote(noteData);
  }

  static async getAllNotes(): Promise<Note[]> {
    return apiService.getAllNotes();
  }

  static async getStoresFiltered(params: {
    storeName?: string;
    ownerName?: string;
    city?: string;
    state?: string;
    clientType?: string;
    page?: number;
    size?: number;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<StoreDto[]> {
    return apiService.getStoresFiltered(params);
  }

  static async getStoresFilteredPaginated(params: {
    storeName?: string;
    ownerName?: string;
    city?: string;
    state?: string;
    clientType?: string;
    employeeName?: string;
    primaryContact?: string;
    page?: number;
    size?: number;
    sortBy?: string;
    sortOrder?: string;
    sort?: string;
  }): Promise<StoreResponse> {
    return apiService.getStoresFilteredPaginated(params);
  }

  static async getStoresByEmployee(employeeId: number, params: {
    sortBy?: string;
    sortOrder?: string;
  }): Promise<StoreResponse> {
    return apiService.getStoresByEmployee(employeeId, params);
  }

  static async deleteStore(storeId: number): Promise<void> {
    return apiService.deleteStore(storeId);
  }

  static async exportStores(): Promise<string> {
    return apiService.exportStores();
  }

  // Employee-related static methods
  static async getAllEmployees<T = EmployeeUserDto>(options?: { forceRefresh?: boolean }): Promise<T[]> {
    return apiService.getAllEmployees<T>(options);
  }

  static invalidateEmployeeDirectory(): void {
    apiService.invalidateEmployeeDirectory();
  }

  static async getEmployeeById(id: number): Promise<EmployeeUserDto> {
    return apiService.getEmployeeById(id);
  }

  static async getTeamByEmployee(employeeId: number): Promise<TeamDataDto[]> {
    return apiService.getTeamByEmployee(employeeId);
  }

  static async getTeamById(teamId: number): Promise<TeamDataDto> {
    return apiService.getTeamById(teamId);
  }

  static async getLocationStates(): Promise<LocationMasterDto[]> {
    return apiService.getLocationStates();
  }

  static async getLocationDistricts(stateId: number): Promise<LocationMasterDto[]> {
    return apiService.getLocationDistricts(stateId);
  }

  static async getLocationCities(districtId: number, search?: string): Promise<LocationMasterDto[]> {
    return apiService.getAllLocationCities(districtId, search);
  }

  static async getClientTypes(): Promise<ClientTypeDto[]> {
    return apiService.getClientTypes();
  }

  static async getCities(): Promise<string[]> {
    return apiService.getCities();
  }

  static async assignEmployeeCity(employeeId: number, city: string): Promise<unknown> {
    return apiService.assignEmployeeCity(employeeId, city);
  }

  static async removeEmployeeCity(employeeId: number, city: string): Promise<unknown> {
    return apiService.removeEmployeeCity(employeeId, city);
  }

  static async getAllInactiveEmployees(): Promise<EmployeeUserDto[]> {
    return apiService.getAllInactiveEmployees();
  }

  static async createEmployee(employeeData: Record<string, unknown>): Promise<unknown> {
    return apiService.createEmployee(employeeData);
  }

  static async updateEmployee(empId: number, employeeData: Record<string, unknown>): Promise<unknown> {
    return apiService.updateEmployee(empId, employeeData);
  }

  static async deleteEmployee(id: number): Promise<unknown> {
    return apiService.deleteEmployee(id);
  }

  static async getArchivedEmployees(): Promise<EmployeeUserDto[]> {
    return apiService.getArchivedEmployees();
  }

  static async resetPassword(username: string, password: string): Promise<unknown> {
    return apiService.resetPassword(username, password);
  }

  static async editUsername(id: number, username: string): Promise<unknown> {
    return apiService.editUsername(id, username);
  }

  static async setEmployeeActive(id: number): Promise<unknown> {
    return apiService.setEmployeeActive(id);
  }

  static async getEmployeeStatsByDateRange(employeeId: number, startDate: string, endDate: string): Promise<EmployeeStatsWithVisits> {
    return apiService.getEmployeeStatsByDateRange(employeeId, startDate, endDate);
  }

  static async getEmployeeStatsWithVisits(employeeId: number, startDate: string, endDate: string): Promise<EmployeeStatsWithVisits> {
    return apiService.getEmployeeStatsWithVisits(employeeId, startDate, endDate);
  }

  static async getEmployeeStatsOptimized(employeeId: number, startDate: string, endDate: string, page: number = 0, size: number = 20, sort: string = 'id,desc'): Promise<EmployeeStatsOptimizedResponse> {
    return apiService.getEmployeeStatsOptimized(employeeId, startDate, endDate, page, size, sort);
  }

  static async getEmployeeVisitsPaged(employeeId: number, startDate: string, endDate: string, page: number = 0, size: number = 20, sort: string = 'id,desc'): Promise<VisitResponse> {
    return apiService.getEmployeeVisitsPaged(employeeId, startDate, endDate, page, size, sort);
  }

  static async getVisitsByStorePaged(storeId: number, page: number = 0, size: number = 20, sort: string = 'visitDate,desc'): Promise<VisitResponse> {
    return apiService.getVisitsByStorePaged(storeId, page, size, sort);
  }

  static async getDashboardSummary(startDate: string, endDate: string): Promise<DashboardSummary> {
    return apiService.getDashboardSummary(startDate, endDate);
  }

  static async getEmployeeJourney(employeeId: number, startDate: string, endDate: string): Promise<EmployeeJourneyPoint[]> {
    return apiService.getEmployeeJourney(employeeId, startDate, endDate);
  }

  static async getEmployeeDashboardSummary(employeeId: number, startDate: string, endDate: string): Promise<EmployeeDashboardSummary> {
    return apiService.getEmployeeDashboardSummary(employeeId, startDate, endDate);
  }

  static async getReportForEmployeeRange<T>(startDate: string, endDate: string): Promise<Record<string, T[]>> {
    return apiService.getReportForEmployeeRange<T>(startDate, endDate);
  }

  static async getEmployeeLiveLocation(employeeId: number): Promise<LiveLocationDto> {
    return apiService.getEmployeeLiveLocation(employeeId);
  }

  static async getAllEmployeeLocations(): Promise<LiveLocationDto[]> {
    return apiService.getAllEmployeeLocations();
  }

  static async createAttendanceLog(employeeId: number): Promise<unknown> {
    return apiService.createAttendanceLog(employeeId);
  }

  static async getCurrentUser(): Promise<CurrentUserDto> {
    return apiService.getCurrentUser();
  }

  static async getStoresForTeam(teamId: number, page: number = 0, size: number = 10): Promise<StoreResponse> {
    return apiService.getStoresForTeam(teamId, page, size);
  }

  static async getStoresByDobDateRange(startDate: string, endDate: string): Promise<StoreDto[]> {
    return apiService.getStoresByDobDateRange(startDate, endDate);
  }

  static async searchSalesTargets(params: SalesTargetSearchParams = {}): Promise<SalesTargetDto[]> {
    return apiService.searchSalesTargets(params);
  }

  static async createSalesTarget(payload: SalesTargetCreatePayload): Promise<number> {
    return apiService.createSalesTarget(payload);
  }

  static async editSalesTarget(id: number, payload: SalesTargetEditPayload): Promise<SalesTargetDto> {
    return apiService.editSalesTarget(id, payload);
  }

  private async loadToken(): Promise<void> {
    if (typeof window !== 'undefined') {
      // Client-side: get from localStorage
      this.token = localStorage.getItem('authToken');
    } else {
      // Server-side: get from cookies - use dynamic import
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { cookies } = require('next/headers');
        const cookieStore = await cookies();
        this.token = cookieStore.get('authToken')?.value || null;
      } catch {
        // If cookies() fails, token will remain null
        this.token = null;
      }
    }
  }

  private async getHeaders(): Promise<HeadersInit> {
    // Always refresh token before building headers to avoid stale auth
    await this.loadToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  private async makeRequest<T>(endpoint: string, options: RequestInit = {}, retryCount = 0): Promise<T> {
    const isAbsoluteEndpoint = /^https?:\/\//i.test(endpoint);
    const url = isAbsoluteEndpoint ? endpoint : `${this.baseUrl}${endpoint}`;
    const headers = await this.getHeaders();
    const config: RequestInit = {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    };

    console.log('🌐 Making API request:', {
      url,
      method: config.method || 'GET',
      headers: config.headers,
      hasToken: !!this.token
    });

    try {
      const response = await fetch(url, config);
      const contentType = response.headers.get('content-type') || '';

      if (!response.ok) {
        throw new Error(
          await getApiErrorMessage(response, `Request failed (${response.status})`)
        );
      }

      // No content
      if (response.status === 204) {
        return undefined as unknown as T;
      }

      // Ensure we only parse JSON when it is JSON
      if (!contentType || !contentType.toLowerCase().includes('application/json')) {
        const text = await response.text();
        
        // For certain endpoints that might return HTML or other formats when no data exists,
        // return empty array instead of throwing error
        const visitEndpoints = [
          '/monthly-sale/getByVisit',
          '/intent-audit/getByVisit', 
          '/task/getByVisit',
          '/notes/getByVisit'
        ];
        
        // For endpoints that return success message as text
        const successTextEndpoints = [
          '/employee-user/create',
          '/attendance-log/createAttendanceLog',
          '/employee/edit',
          '/employee/assignCity',
          '/employee/removeAssignedCity'
        ];
        
        if (visitEndpoints.some(visitEndpoint => endpoint.includes(visitEndpoint)) && response.ok) {
          console.warn(`Non-JSON response from ${endpoint}, returning empty array. Response: ${text.slice(0, 200)}`);
          return [] as unknown as T;
        }
        
        if (successTextEndpoints.some(successEndpoint => endpoint.includes(successEndpoint)) && response.ok) {
          console.log(`Success response from ${endpoint}: ${text}`);
          return { success: true, message: text } as unknown as T;
        }
        
        const preview = text.slice(0, 200);
        throw new Error(
          `Expected JSON but received '${contentType || 'unknown'}' from ${url}. Body starts with: ${preview}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error(`🚨 API request failed for ${endpoint}:`, error);
      console.error('🌐 Request details:', {
        url,
        method: config.method || 'GET',
        hasToken: !!this.token,
        tokenPreview: this.token ? `${this.token.substring(0, 20)}...` : 'No token'
      });
      
      // If it's a network error, provide more helpful error message
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        console.error('🌐 Network Error Details:', {
          url,
          baseUrl: this.baseUrl,
          error: error.message,
          retryCount,
          possibleCauses: [
            'CORS policy blocking the request',
            'API server is down or unreachable',
            'Network connectivity issues',
            'Invalid URL or endpoint',
            'Authentication token expired or invalid'
          ]
        });

        // Retry logic for network errors (max 2 retries)
        if (retryCount < 2) {
          console.log(`🔄 Retrying request (attempt ${retryCount + 1}/2)...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Exponential backoff
          return this.makeRequest<T>(endpoint, options, retryCount + 1);
        }

        throw new Error(`Network error: Unable to connect to API server at ${this.baseUrl}. This could be due to:
- API server is down or unreachable
- Network connectivity issues
- CORS policy blocking the request
- Authentication token expired

Please check your internet connection and try again.`);
      }
      
      throw error;
    }
  }

  private async makeTextRequest(endpoint: string, options: RequestInit = {}, retryCount = 0): Promise<string> {
    const isAbsoluteEndpoint = /^https?:\/\//i.test(endpoint);
    const url = isAbsoluteEndpoint ? endpoint : `${this.baseUrl}${endpoint}`;
    const headers = await this.getHeaders();
    const config: RequestInit = {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    };

    console.log('🌐 Making text API request:', {
      url,
      method: config.method || 'GET',
      headers: config.headers,
      hasToken: !!this.token,
    });

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        throw new Error(
          await getApiErrorMessage(response, `Request failed (${response.status})`)
        );
      }

      return response.text();
    } catch (error) {
      console.error(`🚨 Text API request failed for ${endpoint}:`, error);
      console.error('🌐 Request details:', {
        url,
        method: config.method || 'GET',
        hasToken: !!this.token,
        tokenPreview: this.token ? `${this.token.substring(0, 20)}...` : 'No token',
      });

      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        if (retryCount < 2) {
          console.log(`🔄 Retrying text request (attempt ${retryCount + 1}/2)...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
          return this.makeTextRequest(endpoint, options, retryCount + 1);
        }

        throw new Error(`Network error: Unable to connect to API server at ${this.baseUrl}. This could be due to:
- API server is down or unreachable
- Network connectivity issues
- CORS policy blocking the request
- Authentication token expired

Please check your internet connection and try again.`);
      }

      throw error;
    }
  }

  // Employee APIs



  async updateEmployeeLiveLocation(id: number, latitude: number, longitude: number): Promise<string> {
    return this.makeRequest<string>(`/employee/updateLiveLocation?id=${id}&latitude=${latitude}&longitude=${longitude}`, {
      method: 'PUT',
    });
  }

  // Visit APIs
  async getAllVisits(): Promise<VisitDto[]> {
    return this.makeRequest<VisitDto[]>('/visit/getAll');
  }

  async getVisitsByEmployee(employeeId: number): Promise<VisitDto[]> {
    return this.makeRequest<VisitDto[]>(`/visit/getByEmployee?employeeId=${employeeId}`);
  }

  async getVisitsByDateRange(startDate: string, endDate: string): Promise<VisitDto[]> {
    return this.makeRequest<VisitDto[]>(`/visit/getByDateRange?start=${startDate}&end=${endDate}`);
  }

  async getVisitsByEmployeeAndDateRange(employeeId: number, startDate: string, endDate: string): Promise<VisitDto[]> {
    return this.makeRequest<VisitDto[]>(`/visit/getByEmployeeAndDateRange?employeeId=${employeeId}&start=${startDate}&end=${endDate}`);
  }

  async getEmployeeStatsByDateRange(employeeId: number, startDate: string, endDate: string): Promise<EmployeeStatsWithVisits> {
    return this.makeRequest<EmployeeStatsWithVisits>(`/visit/getByDateRangeAndEmployeeStats?id=${employeeId}&start=${startDate}&end=${endDate}`);
  }

  async getEmployeeStatsWithVisits(employeeId: number, startDate: string, endDate: string): Promise<EmployeeStatsWithVisits> {
    return this.getEmployeeStatsByDateRange(employeeId, startDate, endDate);
  }

  async getEmployeeStatsOptimized(employeeId: number, startDate: string, endDate: string, page: number = 0, size: number = 20, sort: string = 'id,desc'): Promise<EmployeeStatsOptimizedResponse> {
    const query = new URLSearchParams({
      id: String(employeeId), start: startDate, end: endDate,
      page: String(page), size: String(size), sort,
    });
    return this.makeRequest<EmployeeStatsOptimizedResponse>(`/visit/getByDateRangeAndEmployeeStatsOptimized?${query}`);
  }

  async getEmployeeVisitsPaged(employeeId: number, startDate: string, endDate: string, page: number = 0, size: number = 20, sort: string = 'id,desc'): Promise<VisitResponse> {
    const query = new URLSearchParams({
      id: String(employeeId), start: startDate, end: endDate,
      page: String(page), size: String(size), sort,
    });
    return this.makeRequest<VisitResponse>(`/visit/getByDateRangeAndEmployeePaged?${query}`);
  }

  async getVisitsByDateSorted(startDate: string, endDate: string, page: number = 0, size: number = 10, sort: string = 'visitDate,desc', storeName?: string, employeeName?: string): Promise<VisitResponse> {
    let url = `/visit/getByDateSorted?startDate=${startDate}&endDate=${endDate}&page=${page}&size=${size}&sort=${sort}`;
    if (storeName && storeName.trim() !== '') {
      url += `&storeName=${encodeURIComponent(storeName.trim())}`;
    }
    if (employeeName && employeeName.trim() !== '') {
      url += `&employeeName=${encodeURIComponent(employeeName.trim())}`;
    }
    console.log('API URL:', `${this.baseUrl}${url}`);
    return this.makeRequest<VisitResponse>(url);
  }

  async getVisitsByDateSortedOld(startDate: string, endDate: string, page: number = 0, size: number = 10, sort: string = 'id,desc', employeeName?: string): Promise<VisitResponse> {
    let url = `/visit/getByDateSortedOld?startDate=${startDate}&endDate=${endDate}&page=${page}&size=${size}&sort=${sort}`;
    if (employeeName && employeeName.trim() !== '') {
      url += `&employeeName=${encodeURIComponent(employeeName.trim())}`;
    }
    console.log('Old Visit API URL:', `${this.baseUrl}${url}`);
    return this.makeRequest<VisitResponse>(url);
  }

  async getVisitsForTeam(teamId: number, startDate: string, endDate: string, page: number = 0, size: number = 10, sort: string = 'visitDate,desc', purpose?: string, priority?: string, storeName?: string, employeeName?: string): Promise<VisitResponse> {
    let url = `/visit/getForTeam?teamId=${teamId}&startDate=${startDate}&endDate=${endDate}&page=${page}&size=${size}&sort=${sort}`;
    
    if (purpose && purpose.trim() !== '') {
      url += `&purpose=${encodeURIComponent(purpose.trim())}`;
    }
    
    if (priority && priority.trim() !== '') {
      url += `&priority=${encodeURIComponent(priority.trim())}`;
    }
    
    if (storeName && storeName.trim() !== '') {
      url += `&storeName=${encodeURIComponent(storeName.trim())}`;
    }
    
    if (employeeName && employeeName.trim() !== '') {
      url += `&employeeName=${encodeURIComponent(employeeName.trim())}`;
    }
    
    console.log('Team API URL:', `${this.baseUrl}${url}`);
    return this.makeRequest<VisitResponse>(url);
  }

  async getVisitsForTeams(teamIds: number[], startDate: string, endDate: string, page: number = 0, size: number = 10, sort: string = 'visitDate,desc', purpose?: string, priority?: string, outcome?: string, storeName?: string, employeeName?: string): Promise<VisitResponse> {
    const query = new URLSearchParams({
      startDate, endDate, page: String(page), size: String(size), sort,
    });
    teamIds.forEach((teamId) => query.append('teamIds', String(teamId)));
    if (purpose?.trim()) query.set('purpose', purpose.trim());
    if (priority?.trim()) query.set('priority', priority.trim());
    if (outcome?.trim()) query.set('outcome', outcome.trim());
    if (storeName?.trim()) query.set('storeName', storeName.trim());
    if (employeeName?.trim()) query.set('employeeName', employeeName.trim());
    return this.makeRequest<VisitResponse>(`/visit/getForTeams?${query}`);
  }

  // Visit detail APIs
  async getVisitById(id: number): Promise<VisitDto> {
    return this.makeRequest<VisitDto>(`/visit/getById?id=${id}`);
  }

  async checkoutVisit(id: number, payload: VisitCheckoutPayload): Promise<string> {
    return this.makeTextRequest(`/visit/checkout?id=${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async getVisitProCons(visitId: number): Promise<BrandProCon[]> {
    return this.makeRequest<BrandProCon[]>(`/visit/getProCons?visitId=${visitId}`);
  }

  async addBrandProCons(visitId: number, brandData: {
    brandName: string;
    pros: string[];
    cons: string[];
  }[]): Promise<void> {
    return this.makeRequest<void>(`/visit/addProCons?visitId=${visitId}`, {
      method: 'PUT',
      body: JSON.stringify(brandData),
    });
  }

  async deleteBrandProCons(visitId: number, brandData: {
    brandName: string;
  }[]): Promise<void> {
    return this.makeRequest<void>(`/visit/deleteProCons?visitId=${visitId}`, {
      method: 'POST',
      body: JSON.stringify(brandData),
    });
  }

  async getIntentAuditByVisit(id: number): Promise<IntentAuditLog[]> {
    return this.makeRequest<IntentAuditLog[]>(`/intent-audit/getByVisit?id=${id}`);
  }

  async getMonthlySaleByVisit(visitId: number): Promise<MonthlySaleChange[]> {
    return this.makeRequest<MonthlySaleChange[]>(`/monthly-sale/getByVisit?visitId=${visitId}`);
  }

  async getTasksByVisit(type: string, visitId: number): Promise<Task[]> {
    const tasks = await this.makeRequest<Record<string, unknown>[]>(`/task/getByVisit?type=${type}&visitId=${visitId}`);
    if (!Array.isArray(tasks)) throw new Error('Unexpected visit tasks response');
    return tasks.map(normalizeVisitTask);
  }

  async getVisitsByStore(id: number): Promise<VisitDto[]> {
    return this.makeRequest<VisitDto[]>(`/visit/getByStore?id=${id}`);
  }

  async getVisitsByStorePaged(id: number, page: number = 0, size: number = 20, sort: string = 'visitDate,desc'): Promise<VisitResponse> {
    const query = new URLSearchParams({ id: String(id), page: String(page), size: String(size), sort });
    return this.makeRequest<VisitResponse>(`/visit/getByStorePaged?${query}`);
  }

  // Notes by store
  async getNotesByStore(storeId: number): Promise<Note[]> {
    return this.makeRequest<Note[]>(`/notes/getByStore?id=${storeId}`);
  }

  async getNotesByVisit(id: number): Promise<Note[]> {
    return this.makeRequest<Note[]>(`/notes/getByVisit?id=${id}`);
  }

  async createNote(noteData: {
    content: string;
    employeeId: number;
    storeId: number;
    visitId: number;
  }): Promise<number> {
    return this.makeRequest<number>('/notes/create', {
      method: 'POST',
      body: JSON.stringify(noteData),
    });
  }

  async getAllNotes(): Promise<Note[]> {
    return this.makeRequest<Note[]>('/notes/getAll');
  }

  async updateNote(id: number, noteData: {
    content: string;
    employeeId: number;
    storeId: number;
  }): Promise<void> {
    return this.makeRequest<void>(`/notes/edit?id=${id}`, {
      method: 'PUT',
      body: JSON.stringify(noteData),
    });
  }

  async deleteNote(id: number): Promise<void> {
    return this.makeRequest<void>(`/notes/delete?id=${id}`, {
      method: 'DELETE',
    });
  }

  // Attendance APIs
  async getAttendanceForRange(startDate: string, endDate: string): Promise<AttendanceLogItem[]> {
    return this.makeRequest<AttendanceLogItem[]>(`/attendance-log/getForRange1?start=${startDate}&end=${endDate}`);
  }

  async getAttendanceStatsForRange(startDate: string, endDate: string): Promise<AttendanceStats[]> {
    return this.makeRequest<AttendanceStats[]>(`/attendance-log/getForRange?start=${startDate}&end=${endDate}`);
  }

  async getAttendanceForEmployeeAndRange(employeeId: number, startDate: string, endDate: string): Promise<AttendanceStats[]> {
    return this.makeRequest<AttendanceStats[]>(`/attendance-log/getForEmployeeAndRange?employeeId=${employeeId}&start=${startDate}&end=${endDate}`);
  }

  async recalculateDistanceForEmployeesWithOlaMaps(employeeIds: number[], startDate: string, endDate: string): Promise<string> {
    const employeeIdsParam = employeeIds.join(',');
    return this.makeTextRequest(
      `${DISTANCE_RECALCULATION_API_URL}?employeeIds=${employeeIdsParam}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`,
      {
        method: 'PUT',
      }
    );
  }

  async getDailyBreakdown(employeeId: number, startDate: string, endDate: string): Promise<DailyBreakdownDto[]> {
    return this.makeRequest<DailyBreakdownDto[]>(
      `/salary-calculation/daily-breakdown?employeeId=${employeeId}&startDate=${startDate}&endDate=${endDate}`
    );
  }

  // Report APIs
  async getReportCounts(startDate: string, endDate: string): Promise<ReportCountsItem[]> {
    return this.makeRequest<ReportCountsItem[]>(`/report/getCounts?startDate=${startDate}&endDate=${endDate}`);
  }

  async getReportForEmployeeRange<T>(startDate: string, endDate: string): Promise<Record<string, T[]>> {
    const query = new URLSearchParams({ startDate, endDate, groupBy: 'month' });
    return this.makeRequest<Record<string, T[]>>(`/report/getForEmployeeRange?${query}`);
  }

  async getFieldOfficerPerformance(params: FieldOfficerPerformanceParams): Promise<FieldOfficerPerformanceDto[]> {
    const query = new URLSearchParams({
      startDate: params.startDate,
      endDate: params.endDate,
    });
    if (params.employeeId != null) query.set('employeeId', String(params.employeeId));
    if (params.city?.trim()) query.set('city', params.city.trim());
    if (params.teamId != null) query.set('teamId', String(params.teamId));

    return this.makeRequest<FieldOfficerPerformanceDto[]>(`/report/field-officer-performance?${query}`);
  }

  // Expense APIs
  async getExpensesByDateRange(startDate: string, endDate: string): Promise<ExpenseDto[]> {
    return this.makeRequest<ExpenseDto[]>(`/expense/getByDateRange?start=${startDate}&end=${endDate}`);
  }

  // Store APIs
  async getStoresFiltered(params: {
    storeName?: string;
    ownerName?: string;
    city?: string;
    state?: string;
    clientType?: string;
    page?: number;
    size?: number;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<StoreDto[]> {
    const queryParams = new URLSearchParams();
    
    if (params.storeName) queryParams.append('storeName', params.storeName);
    if (params.ownerName) queryParams.append('clientName', params.ownerName);
    if (params.city && params.city !== 'all') queryParams.append('city', params.city);
    if (params.state && params.state !== 'all') queryParams.append('state', params.state);
    if (params.clientType && params.clientType !== 'all') queryParams.append('clientType', params.clientType);
    if (params.page !== undefined) queryParams.append('page', params.page.toString());
    if (params.size !== undefined) queryParams.append('size', params.size.toString());
    
    // Always sort alphabetically by store name by default
    const sortBy = params.sortBy || 'storeName';
    const sortOrder = params.sortOrder || 'asc';
    queryParams.append('sortBy', sortBy);
    queryParams.append('sortOrder', sortOrder);

    const response = await this.makeRequest<StoreResponse>(`/store/filteredValues?${queryParams.toString()}`);
    return response.content;
  }

  async getStoresFilteredPaginated(params: {
    storeName?: string;
    ownerName?: string;
    city?: string;
    state?: string;
    clientType?: string;
    employeeName?: string;
    primaryContact?: string;
    page?: number;
    size?: number;
    sortBy?: string;
    sortOrder?: string;
    sort?: string;
  }): Promise<StoreResponse> {
    const queryParams = new URLSearchParams();
    
    if (params.storeName) queryParams.append('storeName', params.storeName);
    if (params.ownerName) queryParams.append('clientName', params.ownerName);
    if (params.city) queryParams.append('city', params.city);
    if (params.state) queryParams.append('state', params.state);
    if (params.clientType) queryParams.append('clientType', params.clientType);
    if (params.employeeName) queryParams.append('employeeName', params.employeeName);
    if (params.primaryContact) {
      const cleanedPhone = params.primaryContact.replace(/\D/g, '');
      if (cleanedPhone) queryParams.append('primaryContact', cleanedPhone);
    }
    if (params.page !== undefined) queryParams.append('page', params.page.toString());
    if (params.size !== undefined) queryParams.append('size', params.size.toString());
    
    // Always sort alphabetically by store name by default
    const sortBy = params.sortBy || 'storeName';
    const sortOrder = params.sortOrder || 'asc';
    queryParams.append('sort', `${sortBy},${sortOrder}`);

    return this.makeRequest<StoreResponse>(`/store/filteredValues?${queryParams.toString()}`);
  }

  // Get a single store by ID
  async getStoreById(id: number): Promise<StoreDto> {
    return this.makeRequest<StoreDto>(`/store/getById?id=${id}`);
  }

  // Update store by ID
  async updateStore(id: number, payload: Partial<StoreDto>): Promise<StoreDto> {
    return this.makeRequest<StoreDto>(`/store/edit?id=${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async getStoresByEmployee(employeeId: number, params: {
    sortBy?: string;
    sortOrder?: string;
  }): Promise<StoreResponse> {
    const queryParams = new URLSearchParams();
    queryParams.append('id', employeeId.toString());
    
    // Always sort alphabetically by store name by default
    const sortBy = params.sortBy || 'storeName';
    const sortOrder = params.sortOrder || 'asc';
    queryParams.append('sort', `${sortBy},${sortOrder}`);

    return this.makeRequest<StoreResponse>(`/store/getByEmployeeWithSort?${queryParams.toString()}`);
  }

  async deleteStore(storeId: number): Promise<void> {
    return this.makeRequest<void>(`/store/deleteById?id=${storeId}`, {
      method: 'DELETE',
    });
  }

  async exportStores(): Promise<string> {
    const headers = await this.getHeaders();
    const response = await fetch(`${this.baseUrl}/store/export`, {
      headers,
    });
    
    if (!response.ok) {
      throw new Error(`Export failed: ${response.status} ${response.statusText}`);
    }
    
    return response.text();
  }

  // Dashboard specific APIs
  async getDashboardSummary(startDate: string, endDate: string): Promise<DashboardSummary> {
    const query = new URLSearchParams({ startDate, endDate });
    return this.makeRequest<DashboardSummary>(`/dashboard/summary?${query}`);
  }

  async getEmployeeJourney(employeeId: number, startDate: string, endDate: string): Promise<EmployeeJourneyPoint[]> {
    const query = new URLSearchParams({ employeeId: String(employeeId), startDate, endDate });
    return this.makeRequest<EmployeeJourneyPoint[]>(`/visit/employee-journey?${query}`);
  }

  async getEmployeeDashboardSummary(employeeId: number, startDate: string, endDate: string): Promise<EmployeeDashboardSummary> {
    const query = new URLSearchParams({ employeeId: String(employeeId), startDate, endDate });
    return this.makeRequest<EmployeeDashboardSummary>(`/employee/dashboard-summary?${query}`);
  }

  async getDashboardData(startDate: string, endDate: string) {
    const [employees, visits, reportCounts] = await Promise.all([
      this.getAllEmployees(),
      this.getVisitsByDateRange(startDate, endDate),
      this.getReportCounts(startDate, endDate)
    ]);

    return {
      employees,
      visits,
      reportCounts
    };
  }

  async getEmployeeDashboardData(employeeId: number, startDate: string, endDate: string) {
    const [employee, visits, attendanceStats] = await Promise.all([
      this.getEmployeeById(employeeId),
      this.getVisitsByEmployeeAndDateRange(employeeId, startDate, endDate),
      this.getAttendanceForEmployeeAndRange(employeeId, startDate, endDate)
    ]);

    return {
      employee,
      visits,
      attendanceStats
    };
  }

  async getAllEmployeeLocations(): Promise<LiveLocationDto[]> {
    // Use the bulk API endpoint instead of individual calls
    return this.makeRequest<LiveLocationDto[]>('/employee/getAllLiveLocations');
  }

  async getEmployeeLiveLocation(employeeId: number): Promise<LiveLocationDto> {
    return this.makeRequest<LiveLocationDto>(`/employee/getLiveLocation?id=${employeeId}`);
  }

  // Tasks by store and date range (complaints/requirements)
  async getTasksByStoreAndDate(params: { storeId: number; start: string; end: string }): Promise<TaskDto[]> {
    const { storeId, start, end } = params;
    return this.makeRequest<TaskDto[]>(`/task/getByStoreAndDate?storeId=${storeId}&start=${start}&end=${end}`);
  }

  // Sites by store
  async getSitesByStore(storeId: number): Promise<Array<{ id: number; siteName: string; storeId: number }>> {
    return this.makeRequest<Array<{ id: number; siteName: string; storeId: number }>>(`/site/getByStore?id=${storeId}`);
  }

  // Utility methods
  formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  formatDateRange(startDate: Date, endDate: Date): { start: string; end: string } {
    return {
      start: this.formatDate(startDate),
      end: this.formatDate(endDate)
    };
  }

  // Employee-related methods
  async getArchivedEmployees(): Promise<EmployeeUserDto[]> {
    return this.makeRequest<EmployeeUserDto[]>('/employee/getAllInactive');
  }

  async getAllEmployees<T = EmployeeUserDto>(options: { forceRefresh?: boolean } = {}): Promise<T[]> {
    await this.loadToken();
    const requestToken = this.token;
    const now = Date.now();

    if (
      !options.forceRefresh &&
      this.employeeDirectoryCache?.token === requestToken &&
      this.employeeDirectoryCache.expiresAt > now
    ) {
      return [...this.employeeDirectoryCache.data] as T[];
    }

    if (
      !options.forceRefresh &&
      this.employeeDirectoryRequest?.token === requestToken
    ) {
      const employees = await this.employeeDirectoryRequest.promise;
      return [...employees] as T[];
    }

    const version = this.employeeDirectoryVersion;
    const promise = this.makeRequest<EmployeeUserDto[]>('/employee/getAll')
      .then((employees) => {
        if (version === this.employeeDirectoryVersion) {
          this.employeeDirectoryCache = {
            token: requestToken,
            data: employees,
            expiresAt: Date.now() + this.employeeDirectoryTtlMs,
          };
        }
        return employees;
      })
      .finally(() => {
        if (this.employeeDirectoryRequest?.version === version) {
          this.employeeDirectoryRequest = null;
        }
      });

    this.employeeDirectoryRequest = { token: requestToken, version, promise };
    const employees = await promise;
    return [...employees] as T[];
  }

  invalidateEmployeeDirectory(): void {
    this.employeeDirectoryVersion += 1;
    this.employeeDirectoryCache = null;
    this.employeeDirectoryRequest = null;
  }

  async getEmployeeById(id: number): Promise<EmployeeUserDto> {
    return this.makeRequest<EmployeeUserDto>(`/employee/getById?id=${id}`);
  }

  async getTeamByEmployee(employeeId: number): Promise<TeamDataDto[]> {
    return this.makeRequest<TeamDataDto[]>(`/employee/team/getbyEmployee?id=${employeeId}`);
  }

  async getTeamById(teamId: number): Promise<TeamDataDto> {
    return this.makeRequest<TeamDataDto>(`/employee/team/getById?id=${teamId}`);
  }

  async getLocationStates(): Promise<LocationMasterDto[]> {
    return this.makeRequest<LocationMasterDto[]>('/locations/states');
  }

  async getLocationDistricts(stateId: number): Promise<LocationMasterDto[]> {
    return this.makeRequest<LocationMasterDto[]>(`/locations/districts?stateId=${stateId}`);
  }

  async getClientTypes(): Promise<ClientTypeDto[]> {
    return this.makeRequest<ClientTypeDto[]>('/clientType/getAll');
  }

  async getLocationCityPage(
    districtId: number,
    page: number = 0,
    size: number = 100,
    search?: string
  ): Promise<LocationPageDto> {
    const query = new URLSearchParams({
      districtId: String(districtId),
      page: String(page),
      size: String(size),
    });
    const normalizedSearch = search?.trim();
    if (normalizedSearch) query.set('q', normalizedSearch);

    return this.makeRequest<LocationPageDto>(`/locations/cities?${query.toString()}`);
  }

  async getAllLocationCities(districtId: number, search?: string): Promise<LocationMasterDto[]> {
    const firstPage = await this.getLocationCityPage(districtId, 0, 100, search);
    if (firstPage.totalPages <= 1) return firstPage.content;

    const remainingPages = await Promise.all(
      Array.from({ length: firstPage.totalPages - 1 }, (_, index) =>
        this.getLocationCityPage(districtId, index + 1, 100, search)
      )
    );

    return [firstPage, ...remainingPages].flatMap((page) => page.content);
  }

  async getCities(): Promise<string[]> {
    return this.makeRequest<string[]>('/employee/getCities');
  }

  async assignEmployeeCity(employeeId: number, city: string): Promise<unknown> {
    this.invalidateEmployeeDirectory();
    return this.makeRequest<unknown>(
      `/employee/assignCity?id=${employeeId}&city=${encodeURIComponent(city)}`,
      { method: 'PUT' }
    );
  }

  async removeEmployeeCity(employeeId: number, city: string): Promise<unknown> {
    this.invalidateEmployeeDirectory();
    return this.makeRequest<unknown>(
      `/employee/removeAssignedCity?employeeId=${employeeId}&city=${encodeURIComponent(city)}`,
      { method: 'DELETE' }
    );
  }

  async getAllInactiveEmployees(): Promise<EmployeeUserDto[]> {
    return this.makeRequest<EmployeeUserDto[]>('/employee/getAllInactive');
  }

  async createEmployee(employeeData: Record<string, unknown>): Promise<unknown> {
    const result = await this.makeRequest<unknown>('/employee-user/create', {
      method: 'POST',
      body: JSON.stringify(employeeData),
    });
    this.invalidateEmployeeDirectory();
    return result;
  }

  async updateEmployee(empId: number, employeeData: Record<string, unknown>): Promise<unknown> {
    const result = await this.makeRequest<unknown>(`/employee/edit?empId=${empId}`, {
      method: 'PUT',
      body: JSON.stringify(employeeData),
    });
    this.invalidateEmployeeDirectory();
    return result;
  }

  async deleteEmployee(id: number): Promise<unknown> {
    const result = await this.makeRequest<unknown>(`/employee/delete?id=${id}`, {
      method: 'PUT',
    });
    this.invalidateEmployeeDirectory();
    return result;
  }

  async resetPassword(username: string, password: string): Promise<unknown> {
    return this.makeRequest<unknown>('/user/manage/update', {
      method: 'PUT',
      body: JSON.stringify({ username, password }),
    });
  }

  async editUsername(id: number, username: string): Promise<unknown> {
    const result = await this.makeRequest<unknown>(`/employee/editUsername?id=${id}&username=${username}`, {
      method: 'PUT',
    });
    this.invalidateEmployeeDirectory();
    return result;
  }

  async setEmployeeActive(id: number): Promise<unknown> {
    const result = await this.makeRequest<unknown>(`/employee/setActive?id=${id}`, {
      method: 'PUT',
    });
    this.invalidateEmployeeDirectory();
    return result;
  }

  async createAttendanceLog(employeeId: number): Promise<unknown> {
    return this.makeRequest<unknown>(`/attendance-log/createAttendanceLog?employeeId=${employeeId}`, {
      method: 'POST',
    });
  }

  async getCurrentUser(): Promise<CurrentUserDto> {
    return this.makeRequest<CurrentUserDto>(`${SECONDARY_API_BASE_URL}/user/manage/current-user`);
  }

  async getStoresForTeam(teamId: number, page: number = 0, size: number = 10): Promise<StoreResponse> {
    return this.makeRequest<StoreResponse>(`/store/getForTeam?teamId=${teamId}&page=${page}&size=${size}`);
  }

  async getStoresByDobDateRange(startDate: string, endDate: string): Promise<StoreDto[]> {
    // Use the same base URL as other store calls (relative path)
    return this.makeRequest<StoreDto[]>(`/store/getByDobDateRange?startDate=${startDate}&endDate=${endDate}`);
  }

  // Store-attached sales target APIs. These are intentionally separate from
  // the legacy city-level /target endpoints.
  async searchSalesTargets(params: SalesTargetSearchParams = {}): Promise<SalesTargetDto[]> {
    const query = new URLSearchParams();
    if (params.employeeId != null) query.set('employeeId', String(params.employeeId));
    if (params.storeId != null) query.set('storeId', String(params.storeId));
    if (params.targetType) query.set('targetType', params.targetType);
    if (params.month != null) query.set('month', String(params.month));
    if (params.year != null) query.set('year', String(params.year));
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);

    const queryString = query.toString();
    return this.makeRequest<SalesTargetDto[]>(`/sales-target/search${queryString ? `?${queryString}` : ''}`);
  }

  async createSalesTarget(payload: SalesTargetCreatePayload): Promise<number> {
    return this.makeRequest<number>('/sales-target/create', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async editSalesTarget(id: number, payload: SalesTargetEditPayload): Promise<SalesTargetDto> {
    return this.makeRequest<SalesTargetDto>(`/sales-target/edit?id=${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }
}

// Export singleton instance
export const apiService = new API();
