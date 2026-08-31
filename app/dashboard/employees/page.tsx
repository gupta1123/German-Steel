"use client";

import React, { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ChevronLeft, ChevronRight, Archive, Settings, Plus, Loader2, XCircle, Filter, MoreHorizontal } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { API } from "@/lib/api";
import { syncPageQuery } from "@/lib/page-query-sync";
import { useAuth } from "@/components/auth-provider";
import { isManagerRoleValue, normalizeRoleValue } from "@/lib/auth";
import { getUniqueFieldOfficersFromTeams } from "@/lib/team-access";
import { getEmployeeRoleCategory, getEmployeeRoleLabel, isAdminEmployee } from "@/lib/employee-role";
import { usePathname, useSearchParams } from "next/navigation";
import { useGuardedRouter, useUnsavedChanges } from "@/components/unsaved-changes-provider";
import { toast } from "sonner";

interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  departmentName: string;
  userName: string;
  password: string;
  primaryContact: string;
  dateOfJoining: string;
  name: string;
  department: string;
  actions: string;
  city: string;
  state: string;
  userDto: {
    username: string;
    password: string | null;
    roles: string | null;
    employeeId: number | null;
    firstName: string | null;
    lastName: string | null;
  };
}

interface TeamData {
  id: number;
  office?: {
    id: number;
    firstName: string;
    lastName: string;
  } | null;
  officeManager?: {
    id: number;
    firstName: string;
    lastName: string;
  } | null;
  officeManagers?: Array<{
    id: number;
    firstName?: string | null;
    lastName?: string | null;
  }> | null;
  fieldOfficers: User[];
}

interface OfficeManager {
  id: number;
  firstName: string;
  lastName: string;
  city: string;
  email: string;
  deleted?: boolean;
  role?: string;
}

// Utility function to convert text to sentence case
const toSentenceCase = (text: string): string => {
  if (!text) return text;
  return text.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
};

function Ellipsis({ value }: { value: string | number | null | undefined }) {
  const displayValue = value === null || value === undefined || value === '' ? '—' : String(value);
  return <span className="block min-w-0 truncate" title={displayValue}>{displayValue}</span>;
}


function EmployeeList() {
  const router = useGuardedRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();

  const [users, setUsers] = useState<User[]>([]);
  const [teamData, setTeamData] = useState<TeamData[] | null>(null);
  const [officeManager, setOfficeManager] = useState<OfficeManager | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<'all' | 'regional-manager' | 'field-officer'>('all');
  const STATE_KEY = 'employees.list.state.v1';
  const [isHydrated, setIsHydrated] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [areFiltersVisible, setAreFiltersVisible] = useState(true);
  const [resetPasswordUserId, setResetPasswordUserId] = useState<number | string | null>(null);
  const [selectedColumns, setSelectedColumns] = useState(['name', 'email', 'city', 'state', 'role', 'department', 'userName', 'dateOfJoining', 'primaryContact', 'actions']);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [sortColumn, setSortColumn] = useState<keyof User>('firstName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [assignCityUserId, setAssignCityUserId] = useState<number | null>(null);
  const [assignCityUserName, setAssignCityUserName] = useState<string>("");
  const [city, setCity] = useState("");
  const [assignedCity, setAssignedCity] = useState<string | null>(null);
  const [isAssignCityModalOpen, setIsAssignCityModalOpen] = useState(false);
  const [cities, setCities] = useState<string[]>([]);
  const [assignedCities, setAssignedCities] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('tab1');
const [archivedEmployees, setArchivedEmployees] = useState<User[]>([]);
const [isArchivedModalOpen, setIsArchivedModalOpen] = useState(false);
const [archiveSearchQuery, setArchiveSearchQuery] = useState("");
const [isEditUsernameModalOpen, setIsEditUsernameModalOpen] = useState(false);
const [editingUsername, setEditingUsername] = useState<{ id: number; username: string } | null>(null);
const [deleteCandidate, setDeleteCandidate] = useState<User | null>(null);
const [isDeletingUser, setIsDeletingUser] = useState(false);

  const persistedUsername = editingUsername
    ? users.find((user) => user.id === editingUsername.id)?.userName ?? ''
    : '';
  const resetPasswordDraftIsDirty = isResetPasswordOpen && (newPassword.length > 0 || confirmPassword.length > 0);
  const usernameDraftIsDirty = isEditUsernameModalOpen && Boolean(editingUsername) && editingUsername?.username !== persistedUsername;
  const employeeAccountDraftIsDirty = resetPasswordDraftIsDirty || usernameDraftIsDirty;
  const { requestDiscard, markSaved } = useUnsavedChanges(employeeAccountDraftIsDirty);

  const { token, userRole, userData, currentUser } = useAuth();
  const employeeId = userData?.employeeId ? String(userData.employeeId) : (typeof window !== 'undefined' ? localStorage.getItem('employeeId') : null);
  const officeManagerId = typeof window !== 'undefined' ? localStorage.getItem('officeManagerId') : null;
  const normalizedRole = normalizeRoleValue(userRole);
  const authorityRole = normalizeRoleValue(currentUser?.authorities?.[0]?.authority ?? null);
  const isAdminUser = normalizedRole === 'ADMIN' || normalizedRole === 'ROLE_ADMIN' || authorityRole === 'ADMIN' || authorityRole === 'ROLE_ADMIN';
  const isManagerUser = !isAdminUser && (isManagerRoleValue(userRole) || isManagerRoleValue(authorityRole));

  const fetchEmployees = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (isManagerUser) {
        const response = await fetch(`http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/employee/team/getbyEmployee?id=${employeeId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch team data');
        }

        const teamData: TeamData[] = await response.json();
        if (!teamData || teamData.length === 0) {
          throw new Error('No team data found for the manager');
        }

        setTeamData(teamData);
        const scopedFieldOfficers = getUniqueFieldOfficersFromTeams(teamData);
        setUsers(scopedFieldOfficers.filter((user: User) => !isAdminEmployee(user)).map((user: User) => ({ ...user, userName: user.userDto?.username || "" })));
      } else {
        const data = await API.getAllEmployees<User>();
        if (!data) {
            throw new Error('No data received when fetching all employees');
        }

        const employees = data.filter((user: User) => !isAdminEmployee(user));
        setUsers(employees.map((user: User) => ({ ...user, userName: user.userDto?.username || "" })));
        setAssignedCities(employees.filter((user: User) => user.city).map((user: User) => user.city));
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [token, employeeId, isManagerUser]);

  // Hydrate filters/paging
  useEffect(() => {
    if (isHydrated) return;

    let saved: { searchQuery?: string; selectedRoleFilter?: string; currentPage?: number; itemsPerPage?: number } = {};
    try {
      const raw = sessionStorage.getItem(STATE_KEY);
      if (raw) {
        saved = JSON.parse(raw) ?? {};
      }
    } catch {}

    const querySearch = searchParams.get('q');
    const queryRole = searchParams.get('role');
    const queryPage = Number(searchParams.get('page'));
    const querySize = Number(searchParams.get('size'));

    const initialSearch = typeof querySearch === 'string' ? querySearch : saved.searchQuery ?? '';
    const savedRole = queryRole ?? saved.selectedRoleFilter;
    const initialRole = savedRole === 'regional-manager' || savedRole === 'field-officer' ? savedRole : 'all';
    const initialPage = !Number.isNaN(queryPage) && queryPage > 0
      ? queryPage
      : typeof saved.currentPage === 'number' && saved.currentPage > 0
        ? saved.currentPage
        : 1;
    const initialSize = !Number.isNaN(querySize) && querySize > 0
      ? querySize
      : typeof saved.itemsPerPage === 'number' && saved.itemsPerPage > 0
        ? saved.itemsPerPage
        : 10;

    setSearchQuery(initialSearch);
    setSelectedRoleFilter(initialRole);
    setCurrentPage(initialPage);
    setItemsPerPage(initialSize);
    setIsHydrated(true);
  }, [searchParams, isHydrated]);

  // Persist state on change
  useEffect(() => {
    if (!isHydrated) return;

    try {
      sessionStorage.setItem(STATE_KEY, JSON.stringify({ searchQuery, selectedRoleFilter, currentPage, itemsPerPage }));
    } catch {}

    const params = new URLSearchParams(searchParamsString);
    if (searchQuery.trim()) {
      params.set('q', searchQuery.trim());
    } else {
      params.delete('q');
    }
    if (selectedRoleFilter !== 'all') {
      params.set('role', selectedRoleFilter);
    } else {
      params.delete('role');
    }
    if (currentPage > 1) {
      params.set('page', currentPage.toString());
    } else {
      params.delete('page');
    }
    if (itemsPerPage !== 10) {
      params.set('size', itemsPerPage.toString());
    } else {
      params.delete('size');
    }

    const nextQuery = params.toString();
    if (nextQuery === searchParamsString) {
      return;
    }

    const nextUrl = `${pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`;
    syncPageQuery(nextUrl);
  }, [searchQuery, selectedRoleFilter, currentPage, itemsPerPage, isHydrated, pathname, searchParamsString]);

  const fetchArchivedEmployees = async () => {
    try {
      console.log('Fetching archived employees...');
      const response = await fetch('http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/employee/getAllInactive', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch archived employees: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Archived employees data:', data);
      console.log('Number of archived employees:', data.length);
      setArchivedEmployees(data);
    } catch (error) {
      console.error('Error fetching archived employees:', error);
    }
  };

  const deleteUserById = async (userId: number) => {
    try {
      const employeeTeams = await API.getTeamByEmployee(userId).catch(() => []);
      const assignedTeams = (employeeTeams as unknown as TeamData[]).filter((team) =>
        team.fieldOfficers?.some((officer) => officer.id === userId)
      );

      for (const team of assignedTeams) {
        const removeResponse = await fetch(
          `http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/employee/team/deleteFieldOfficer?id=${team.id}`,
          {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ fieldOfficers: [userId] }),
          }
        );

        if (!removeResponse.ok) {
          const message = await removeResponse.text().catch(() => '');
          throw new Error(message || 'Could not remove the employee from their team.');
        }
      }

      const response = await fetch(
        `http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/employee/delete?id=${userId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        API.invalidateEmployeeDirectory();
        setUsers((prevUsers) => prevUsers.filter((user) => user.id !== userId));
        setTeamData((current) => current?.map((team) => ({
          ...team,
          fieldOfficers: team.fieldOfficers.filter((officer) => officer.id !== userId),
        })) ?? current);
        toast.success('Employee archived', { duration: 3000 });
      } else {
        const message = await response.text().catch(() => '');
        throw new Error(message || 'Failed to archive employee');
      }
    } catch (error) {
      console.error('Error deleting employee:', error);
      toast.error(error instanceof Error ? error.message : 'Could not archive employee', { duration: 3000 });
      throw error;
    }
  };

  const handleConfirmDeleteUser = async () => {
    if (!deleteCandidate) return;
    setIsDeletingUser(true);
    try {
      await deleteUserById(deleteCandidate.id);
      setDeleteCandidate(null);
    } catch {
      // Keep the dialog open so the user can retry after the toast explains the failure.
    } finally {
      setIsDeletingUser(false);
    }
  };

  const handleResetPasswordSubmit = async () => {
    if (newPassword !== confirmPassword) {
      console.error('Passwords do not match!');
      return;
    }

    try {
      const response = await fetch(
        "http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/user/manage/update",
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            username: users.find(user => user.id === resetPasswordUserId)?.userName,
            password: newPassword
          })
        }
      );

      if (response.ok) {
        markSaved();
        setIsResetPasswordOpen(false);
        setNewPassword('');
        setConfirmPassword('');
      } else {
        console.error('Failed to reset password');
      }
    } catch (error) {
      console.error('Error resetting password:', error);
    }
  };


  const handleUnarchive = async (employeeId: number) => {
    try {
      const response = await fetch(
        `http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/employee/setActive?id=${employeeId}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      
      if (response.ok) {
        API.invalidateEmployeeDirectory();
        fetchArchivedEmployees();
        fetchEmployees();
      }
    } catch (error) {
      console.error('Error unarchiving employee:', error);
    }
  };

  const handleSaveUsername = async () => {
    if (!editingUsername?.username.trim()) {
      console.error('Username cannot be empty');
      return;
    }

    if (editingUsername) {
      try {
        setIsLoading(true);
        
        const encodedUsername = encodeURIComponent(editingUsername.username.trim());
        const response = await fetch(
          `http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/employee/editUsername?id=${editingUsername.id}&username=${encodedUsername}`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const text = await response.text().catch(() => '');
        if (response.ok) {
          markSaved();
          API.invalidateEmployeeDirectory();
          setIsEditUsernameModalOpen(false);
          setEditingUsername(null);
          fetchEmployees();
          if (text) {
            console.log('Username update response:', text);
          }
        }
      } catch (error) {
        console.error('Error updating username:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    if (token && isHydrated) {
      fetchEmployees();
    }
  }, [token, employeeId, isHydrated, fetchEmployees]);

  // Helper functions
  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  // Function to generate role tags with pastel colors
  const getRoleTag = (role: string) => {
    const transformedRole = getEmployeeRoleLabel(role);
    
    if (transformedRole === 'Regional Manager') {
      return (
        <Badge 
          variant="secondary" 
          className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200"
        >
          {transformedRole}
        </Badge>
      );
    } else if (transformedRole === 'Field Officer') {
      return (
        <Badge 
          variant="secondary" 
          className="bg-green-100 text-green-800 border-green-200 hover:bg-green-200"
        >
          {transformedRole}
        </Badge>
      );
    } else {
      return (
        <Badge 
          variant="secondary" 
          className="bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200"
        >
          {transformedRole}
        </Badge>
      );
    }
  };

  const handleSort = (column: keyof User) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };


  const handleResetPassword = (userId: number | string) => {
    setNewPassword('');
    setConfirmPassword('');
    setResetPasswordUserId(userId);
    setIsResetPasswordOpen(true);
  };

  const closeResetPasswordDialog = () => {
    requestDiscard(() => {
      setIsResetPasswordOpen(false);
      setNewPassword('');
      setConfirmPassword('');
    }, resetPasswordDraftIsDirty);
  };

  const handleEditUsername = (userId: number, currentUsername: string) => {
    setEditingUsername({ id: userId, username: currentUsername });
    setIsEditUsernameModalOpen(true);
  };

  const handleViewUser = (userId: number) => {
    try {
      sessionStorage.setItem('employees.last.view', JSON.stringify({ from: 'list' }));
    } catch {}
    router.push(`/dashboard/employee/${userId}`);
  };

  const handleGoToEdit = (userId: number) => {
    router.push(`/dashboard/employees/${userId}/edit`);
  };


  const closeUsernameDialog = () => {
    requestDiscard(() => {
      setIsEditUsernameModalOpen(false);
      setEditingUsername(null);
    }, usernameDraftIsDirty);
  };

  // Filtering and sorting logic
  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return users.filter((user) => {
      if (isAdminEmployee(user)) return false;
      const matchesRole = selectedRoleFilter === 'all' || getEmployeeRoleCategory(user.role) === selectedRoleFilter;
      if (!matchesRole) return false;
      if (!query) return true;

      return (`${user.firstName ?? ''} ${user.lastName ?? ''}`).toLowerCase().includes(query) ||
        String(user.email ?? '').toLowerCase().includes(query) ||
        getEmployeeRoleLabel(user.role).toLowerCase().includes(query);
    });
  }, [users, searchQuery, selectedRoleFilter]);

  const sortedUsers = useMemo(() => {
    return [...filteredUsers].sort((a, b) => {
      if (a[sortColumn] < b[sortColumn]) return sortDirection === 'asc' ? -1 : 1;
      if (a[sortColumn] > b[sortColumn]) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredUsers, sortColumn, sortDirection]);

  const indexOfLastUser = currentPage * itemsPerPage;
  const indexOfFirstUser = indexOfLastUser - itemsPerPage;
  const currentUsers = sortedUsers.slice(indexOfFirstUser, indexOfLastUser);


  const filteredArchivedEmployees = useMemo(() => {
    console.log('Filtering archived employees:', archivedEmployees.length, 'employees, search query:', archiveSearchQuery);
    const filtered = archivedEmployees.filter((employee) => !isAdminEmployee(employee)).filter((employee) =>
      `${employee.firstName} ${employee.lastName}`.toLowerCase().includes(archiveSearchQuery.toLowerCase()) ||
      employee.role.toLowerCase().includes(archiveSearchQuery.toLowerCase()) ||
      employee.departmentName.toLowerCase().includes(archiveSearchQuery.toLowerCase()) ||
      employee.city.toLowerCase().includes(archiveSearchQuery.toLowerCase())
    );
    console.log('Filtered result:', filtered.length, 'employees');
    return filtered;
  }, [archivedEmployees, archiveSearchQuery]);

  return (
    <div className="mx-auto w-full max-w-none py-4">
      <div className="mb-4 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  sessionStorage.setItem('addEmployee.navigation', 'fromEmployeesList');
                }
                router.push('/dashboard/employees/add');
              }}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Employee
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setAreFiltersVisible((visible) => !visible)}>
              <Filter className="mr-2 h-4 w-4" />
              {areFiltersVisible ? 'Hide Filters' : 'Show Filters'}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                {['name', 'city', 'state', 'role', 'userName', 'primaryContact', 'actions'].map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column}
                    checked={selectedColumns.includes(column)}
                    onCheckedChange={() => {
                      if (selectedColumns.includes(column)) {
                        setSelectedColumns(selectedColumns.filter((col) => col !== column));
                      } else {
                        setSelectedColumns([...selectedColumns, column]);
                      }
                    }}
                  >
                    {column}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button 
              variant="outline"
              size="sm"
              onClick={() => {
                setIsArchivedModalOpen(true);
                fetchArchivedEmployees();
              }}
              className="flex items-center gap-2"
            >
              <Archive className="h-4 w-4" />
              Archived
            </Button>
          </div>
      </div>

      {areFiltersVisible && (
        <div className="mb-4 rounded-xl border border-border/70 bg-muted/20 p-3">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,28rem)_180px]">
            <div className="relative">
              <Label htmlFor="employee-search" className="sr-only">Search employees</Label>
              <Input
                id="employee-search"
                type="search"
                autoComplete="off"
                placeholder="Search name, email, or role"
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setCurrentPage(1);
                }}
                className="h-8 bg-background pr-8 text-xs shadow-none"
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery('')} className="absolute inset-y-0 right-0 flex items-center pr-2 text-muted-foreground hover:text-foreground" aria-label="Clear search">
                  <XCircle className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Select
              value={selectedRoleFilter}
              onValueChange={(value: 'all' | 'regional-manager' | 'field-officer') => {
                setSelectedRoleFilter(value);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-8 bg-background text-xs shadow-none" aria-label="Filter by role">
                <SelectValue placeholder="All roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="regional-manager">Regional Manager</SelectItem>
                <SelectItem value="field-officer">Field Officer</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="space-y-4">
          {/* Filters skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
            <div className="flex items-end">
              <Skeleton className="h-10 w-full" />
            </div>
          </div>

          {/* Table skeleton */}
          <Card className="w-full">
            <CardContent className="pt-6">
              <div className="rounded-md border overflow-hidden w-full">
                <div className="overflow-x-auto w-full">
                  <Table className="min-w-full">
                    <TableHeader>
                      <TableRow>
                        {['Name','Role','User Name','Phone','City','State','Actions'].map(h => (
                          <TableHead key={h} className="whitespace-nowrap">{h}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...Array(6)].map((_, i) => (
                        <TableRow key={i}>
                          <TableCell className="whitespace-nowrap"><Skeleton className="h-4 w-40" /></TableCell>
                          <TableCell className="whitespace-nowrap"><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell className="whitespace-nowrap"><Skeleton className="h-4 w-28" /></TableCell>
                          <TableCell className="whitespace-nowrap"><Skeleton className="h-4 w-28" /></TableCell>
                          <TableCell className="whitespace-nowrap"><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell className="whitespace-nowrap"><Skeleton className="h-4 w-20" /></TableCell>
                          <TableCell className="whitespace-nowrap"><Skeleton className="h-8 w-8 rounded" /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      {error && <div className="text-red-500">Error: {error}</div>}

      {!isLoading && !error && (
        <>
          {/* Mobile view */}
          <div className="space-y-3 md:hidden">
            {currentUsers.map((user) => (
              <Card key={user.id} className="overflow-hidden shadow-none">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarFallback className="bg-muted text-xs font-semibold">{getInitials(user.firstName, user.lastName)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold" title={`${user.firstName} ${user.lastName}`}>{`${user.firstName} ${user.lastName}`}</p>
                        <p className="truncate text-xs text-muted-foreground" title={user.userName}>{user.userName || 'No username'}</p>
                      </div>
                    </div>
                    <div className="shrink-0">{getRoleTag(user.role)}</div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3 text-xs">
                    <div className="min-w-0"><span className="text-muted-foreground">Phone</span><Ellipsis value={user.primaryContact} /></div>
                    <div className="min-w-0"><span className="text-muted-foreground">Location</span><Ellipsis value={[toSentenceCase(user.city), user.state].filter(Boolean).join(', ')} /></div>
                  </div>
                  <div className="mt-3 flex justify-end gap-1">
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => handleGoToEdit(user.id)}>Edit</Button>
                    <Button variant="outline" size="sm" className="h-7 px-3 text-xs" onClick={() => handleViewUser(user.id)}>View details</Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7" aria-label="More employee actions"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditUsername(user.id, user.userName)}>Edit Username</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleResetPassword(user.id)}>Reset Password</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setDeleteCandidate(user)}>Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop view */}
          <div className="hidden min-w-0 md:block">
              <Table className="table-fixed text-xs font-poppins">
              <colgroup>
                {selectedColumns.includes('name') && <col className="w-[22%]" />}
                {selectedColumns.includes('role') && <col className="w-[16%]" />}
                {selectedColumns.includes('userName') && <col className="w-[16%]" />}
                {selectedColumns.includes('primaryContact') && <col className="w-[14%]" />}
                {selectedColumns.includes('city') && <col className="w-[12%]" />}
                {selectedColumns.includes('state') && <col className="w-[14%]" />}
                {selectedColumns.includes('actions') && <col className="w-[6%]" />}
              </colgroup>
              <TableHeader>
                <TableRow>
                  {selectedColumns.includes('name') && (
                    <TableHead className="cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap" onClick={() => handleSort('firstName')}>
                      Name
                      {sortColumn === 'firstName' && (
                        <span className="ml-2">
                          {sortDirection === 'asc' ? '▲' : '▼'}
                        </span>
                      )}
                    </TableHead>
                  )}
                  {selectedColumns.includes('role') && (
                    <TableHead className="cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap" onClick={() => handleSort('role')}>
                      Role
                      {sortColumn === 'role' && (
                        <span className="ml-2">
                          {sortDirection === 'asc' ? '▲' : '▼'}
                        </span>
                      )}
                    </TableHead>
                  )}
                  {selectedColumns.includes('userName') && (
                    <TableHead className="cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap" onClick={() => handleSort('userName')}>
                      User Name
                      {sortColumn === 'userName' && (
                        <span className="ml-2">
                          {sortDirection === 'asc' ? '▲' : '▼'}
                        </span>
                      )}
                    </TableHead>
                  )}
                  {selectedColumns.includes('primaryContact') && (
                    <TableHead className="cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap" onClick={() => handleSort('primaryContact')}>
                      Phone
                      {sortColumn === 'primaryContact' && (
                        <span className="ml-2">
                          {sortDirection === 'asc' ? '▲' : '▼'}
                        </span>
                      )}
                    </TableHead>
                  )}
                  {selectedColumns.includes('city') && (
                    <TableHead className="cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap" onClick={() => handleSort('city')}>
                      City
                      {sortColumn === 'city' && (
                        <span className="ml-2">
                          {sortDirection === 'asc' ? '▲' : '▼'}
                        </span>
                      )}
                    </TableHead>
                  )}
                  {selectedColumns.includes('state') && (
                    <TableHead className="cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap" onClick={() => handleSort('state')}>
                      State
                      {sortColumn === 'state' && (
                        <span className="ml-2">
                          {sortDirection === 'asc' ? '▲' : '▼'}
                        </span>
                      )}
                    </TableHead>
                  )}
                  {selectedColumns.includes('actions') && (
                    <TableHead className="overflow-hidden text-ellipsis text-right whitespace-nowrap">Actions</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentUsers.map((user) => (
                  <TableRow key={user.id}>
                    {selectedColumns.includes('name') && (
                      <TableCell className="font-medium"><Ellipsis value={`${user.firstName} ${user.lastName}`} /></TableCell>
                    )}
                    {selectedColumns.includes('role') && <TableCell className="overflow-hidden">{getRoleTag(user.role)}</TableCell>}
                    {selectedColumns.includes('userName') && <TableCell><Ellipsis value={user.userName} /></TableCell>}
                    {selectedColumns.includes('primaryContact') && <TableCell><Ellipsis value={user.primaryContact} /></TableCell>}
                    {selectedColumns.includes('city') && <TableCell><Ellipsis value={toSentenceCase(user.city)} /></TableCell>}
                    {selectedColumns.includes('state') && <TableCell><Ellipsis value={user.state} /></TableCell>}
                    {selectedColumns.includes('actions') && (
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleGoToEdit(user.id)}>
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEditUsername(user.id, user.userName)}>
                              Edit Username
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleViewUser(user.id)}>
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleResetPassword(user.id)}>
                              Reset Password
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setDeleteCandidate(user)}>
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Label htmlFor="pageSize" className="text-xs">Rows per page:</Label>
              <Select value={itemsPerPage.toString()} onValueChange={(value) => setItemsPerPage(parseInt(value))}>
                <SelectTrigger className="h-8 w-20 text-xs">
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
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Previous</span>
              </Button>
              
              <span className="text-xs text-muted-foreground">
                Page {currentPage} of {Math.max(Math.ceil(sortedUsers.length / itemsPerPage), 1)}
              </span>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.min(Math.ceil(sortedUsers.length / itemsPerPage), currentPage + 1))}
                disabled={currentPage >= Math.ceil(sortedUsers.length / itemsPerPage)}
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Reset Password Modal */}
      <Dialog open={isResetPasswordOpen} onOpenChange={(open) => {
        if (!open) closeResetPasswordDialog();
      }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Enter a new password for the user.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeResetPasswordDialog}>
              Cancel
            </Button>
            <Button onClick={handleResetPasswordSubmit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Delete Employee Confirmation */}
      <Dialog
        open={!!deleteCandidate}
        onOpenChange={(open) => {
          if (!open && !isDeletingUser) {
            setDeleteCandidate(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Delete Employee</DialogTitle>
            <DialogDescription>
              {`Are you sure you want to delete ${deleteCandidate ? `${deleteCandidate.firstName} ${deleteCandidate.lastName}`.trim() || 'this employee' : 'this employee'}? This action cannot be undone.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteCandidate(null)}
              disabled={isDeletingUser}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDeleteUser}
              disabled={isDeletingUser}
              className="flex items-center gap-2"
            >
              {isDeletingUser && <Loader2 className="h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archived Employees Modal */}
      <Dialog open={isArchivedModalOpen} onOpenChange={setIsArchivedModalOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Archived Employees</DialogTitle>
            <DialogDescription>
              View and manage archived employees
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Search Filter */}
            <div className="flex items-center space-x-2">
              <Input
                placeholder="Search archived employees..."
                value={archiveSearchQuery}
                onChange={(e) => setArchiveSearchQuery(e.target.value)}
                className="max-w-md"
              />
              <Badge variant="secondary" className="h-9 px-3">
                {filteredArchivedEmployees.length} Results
              </Badge>
              <Badge variant="outline" className="h-9 px-3">
                Total: {archivedEmployees.length}
              </Badge>
            </div>

            {/* Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredArchivedEmployees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell className="font-medium">
                        {`${employee.firstName} ${employee.lastName}`}
                      </TableCell>
                      <TableCell>{employee.role}</TableCell>
                      <TableCell>{employee.departmentName}</TableCell>
                      <TableCell>{employee.city}</TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUnarchive(employee.id)}
                          className="flex items-center gap-2"
                        >
                          <ArrowLeft className="h-4 w-4" />
                          Unarchive
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredArchivedEmployees.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        <div className="flex flex-col items-center gap-2">
                          <p className="text-sm text-muted-foreground">
                            {archivedEmployees.length === 0 
                              ? "No archived employees found" 
                              : "No results found for your search"}
                          </p>
                          {archivedEmployees.length > 0 && archiveSearchQuery && (
                            <Button 
                              variant="ghost" 
                              onClick={() => setArchiveSearchQuery("")}
                              className="text-sm"
                            >
                              Clear search
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Username Modal */}
      <Dialog open={isEditUsernameModalOpen} onOpenChange={(open) => {
        if (!open) closeUsernameDialog();
      }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Username</DialogTitle>
            <DialogDescription>
              Enter a new username for the employee. Username must not be empty.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="newUsername">New Username</Label>
              <Input
                id="newUsername"
                value={editingUsername?.username || ''}
                onChange={(e) => setEditingUsername(prev => prev ? { ...prev, username: e.target.value } : null)}
                placeholder="Enter new username"
                disabled={isLoading}
                className="transition-all duration-200 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={closeUsernameDialog}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSaveUsername}
              disabled={isLoading || !editingUsername?.username.trim()}
              className="relative"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Saving...
                </span>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function EmployeesPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
      <EmployeeList />
    </Suspense>
  );
}
