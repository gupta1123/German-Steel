"use client";

import React, { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Phone, Mail, MapPin, Calendar, Building, User, ArrowLeft, ChevronLeft, ChevronRight, Archive, Settings, Plus, Loader2, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import AddTeam from "@/components/AddTeam";
import { Skeleton } from "@/components/ui/skeleton";
import { API } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { hasAdminSetupPrivileges, isManagerRoleValue, normalizeRoleValue } from "@/lib/auth";
import { getUniqueFieldOfficersFromTeams } from "@/lib/team-access";
import { usePathname, useSearchParams } from "next/navigation";
import { useGuardedRouter, useUnsavedChanges } from "@/components/unsaved-changes-provider";

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
  const STATE_KEY = 'employees.list.state.v1';
  const [isHydrated, setIsHydrated] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
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
  const { requestDiscard } = useUnsavedChanges(employeeAccountDraftIsDirty);

  const { token, userRole, userData, currentUser } = useAuth();
  const canManageTeamSetup = hasAdminSetupPrivileges(userRole, currentUser);
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
        setUsers(scopedFieldOfficers.map((user: User) => ({ ...user, userName: user.userDto?.username || "" })));
      } else {
        const data = await API.getAllEmployees<User>();
        if (!data) {
            throw new Error('No data received when fetching all employees');
        }

        setUsers(data.map((user: User) => ({ ...user, userName: user.userDto?.username || "" })));
        setAssignedCities(data.filter((user: User) => user.city).map((user: User) => user.city));
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

    let saved: { searchQuery?: string; currentPage?: number; itemsPerPage?: number } = {};
    try {
      const raw = sessionStorage.getItem(STATE_KEY);
      if (raw) {
        saved = JSON.parse(raw) ?? {};
      }
    } catch {}

    const querySearch = searchParams.get('q');
    const queryPage = Number(searchParams.get('page'));
    const querySize = Number(searchParams.get('size'));

    const initialSearch = typeof querySearch === 'string' ? querySearch : saved.searchQuery ?? '';
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
    setCurrentPage(initialPage);
    setItemsPerPage(initialSize);
    setIsHydrated(true);
  }, [searchParams, isHydrated]);

  // Persist state on change
  useEffect(() => {
    if (!isHydrated) return;

    try {
      sessionStorage.setItem(STATE_KEY, JSON.stringify({ searchQuery, currentPage, itemsPerPage }));
    } catch {}

    const params = new URLSearchParams(searchParamsString);
    if (searchQuery.trim()) {
      params.set('q', searchQuery.trim());
    } else {
      params.delete('q');
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

    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }, [searchQuery, currentPage, itemsPerPage, isHydrated, pathname, router, searchParamsString]);

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
      } else {
        console.error('Failed to delete employee');
      }
    } catch (error) {
      console.error('Error deleting employee:', error);
    }
  };

  const handleConfirmDeleteUser = async () => {
    if (!deleteCandidate) return;
    setIsDeletingUser(true);
    try {
      await deleteUserById(deleteCandidate.id);
      setDeleteCandidate(null);
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

  const transformRole = (role: string) => {
    return role === 'Manager' ? 'Regional Manager' : 
           role === 'Office Manager' ? 'Regional Manager' : 
           role;
  };

  // Function to generate role tags with pastel colors
  const getRoleTag = (role: string) => {
    const transformedRole = transformRole(role);
    
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
    return users.filter((user) =>
      (`${user.firstName} ${user.lastName}`).toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.role.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [users, searchQuery]);

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
    const filtered = archivedEmployees.filter((employee) =>
      `${employee.firstName} ${employee.lastName}`.toLowerCase().includes(archiveSearchQuery.toLowerCase()) ||
      employee.role.toLowerCase().includes(archiveSearchQuery.toLowerCase()) ||
      employee.departmentName.toLowerCase().includes(archiveSearchQuery.toLowerCase()) ||
      employee.city.toLowerCase().includes(archiveSearchQuery.toLowerCase())
    );
    console.log('Filtered result:', filtered.length, 'employees');
    return filtered;
  }, [archivedEmployees, archiveSearchQuery]);

  return (
    <div className="container-employee mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Search and Filters Section */}
      <div className="mb-8 space-y-4">
        {/* Search Bar */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Input
                type="text"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-10"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute inset-y-0 right-2 flex items-center justify-center text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline"
              onClick={() => {
                setIsArchivedModalOpen(true);
                fetchArchivedEmployees();
              }}
              className="flex items-center gap-2"
            >
              <Archive className="h-4 w-4" />
              Archived
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
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
            
            {canManageTeamSetup && <AddTeam />}
            
            <Button 
              onClick={() => {
                // Set flag to reset form when navigating to add page
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
        </div>
      </div>

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
          <div className="md:hidden space-y-4">
            {currentUsers.map((user, index) => (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                <Card className="overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300">
                  <CardHeader className="pb-2">
                    <div className="flex items-center space-x-4">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-gray-200 text-gray-700 font-semibold">
                          {getInitials(user.firstName, user.lastName)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-lg font-bold">{`${user.firstName} ${user.lastName}`}</CardTitle>
                        <div className="text-sm">{getRoleTag(user.role)}</div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3">
                      {selectedColumns.includes('userName') && (
                        <div className="flex items-center space-x-2">
                          <User className="h-5 w-5 text-blue-500" />
                          <span className="text-sm">{user.userName}</span>
                        </div>
                      )}
                      {selectedColumns.includes('primaryContact') && (
                        <div className="flex items-center space-x-2">
                          <Phone className="h-5 w-5 text-green-500" />
                          <span className="text-sm">{user.primaryContact}</span>
                        </div>
                      )}
                      {selectedColumns.includes('email') && (
                        <div className="flex items-center space-x-2">
                          <Mail className="h-5 w-5 text-red-500" />
                          <span className="text-sm">{user.email}</span>
                        </div>
                      )}
                      {selectedColumns.includes('city') && (
                        <div className="flex items-center space-x-2">
                          <MapPin className="h-5 w-5 text-yellow-500" />
                          <span className="text-sm">{toSentenceCase(user.city)}</span>
                        </div>
                      )}
                      {selectedColumns.includes('state') && (
                        <div className="flex items-center space-x-2">
                          <Building className="h-5 w-5 text-purple-500" />
                          <span className="text-sm">{user.state}</span>
                        </div>
                      )}
                      {selectedColumns.includes('dateOfJoining') && (
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-5 w-5 text-indigo-500" />
                          <span className="text-sm">{format(new Date(user.dateOfJoining), 'MMM dd, yyyy')}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                  <div className="px-6 py-3 bg-gray-50 flex justify-end space-x-2">
                    <Button variant="ghost" size="sm" onClick={() => handleGoToEdit(user.id)}>
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleViewUser(user.id)}>
                      View
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteCandidate(user)}>
                      Delete
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Desktop view */}
          <div className="hidden md:block">
            <div className="rounded-md border overflow-hidden">
              <Table className="w-full">
              <TableHeader>
                <TableRow>
                  {selectedColumns.includes('name') && (
                    <TableHead className="cursor-pointer px-6 py-3" onClick={() => handleSort('firstName')}>
                      Name
                      {sortColumn === 'firstName' && (
                        <span className="ml-2">
                          {sortDirection === 'asc' ? '▲' : '▼'}
                        </span>
                      )}
                    </TableHead>
                  )}
                  {selectedColumns.includes('role') && (
                    <TableHead className="cursor-pointer px-6 py-3" onClick={() => handleSort('role')}>
                      Role
                      {sortColumn === 'role' && (
                        <span className="ml-2">
                          {sortDirection === 'asc' ? '▲' : '▼'}
                        </span>
                      )}
                    </TableHead>
                  )}
                  {selectedColumns.includes('userName') && (
                    <TableHead className="cursor-pointer px-6 py-3" onClick={() => handleSort('userName')}>
                      User Name
                      {sortColumn === 'userName' && (
                        <span className="ml-2">
                          {sortDirection === 'asc' ? '▲' : '▼'}
                        </span>
                      )}
                    </TableHead>
                  )}
                  {selectedColumns.includes('primaryContact') && (
                    <TableHead className="cursor-pointer px-6 py-3" onClick={() => handleSort('primaryContact')}>
                      Phone
                      {sortColumn === 'primaryContact' && (
                        <span className="ml-2">
                          {sortDirection === 'asc' ? '▲' : '▼'}
                        </span>
                      )}
                    </TableHead>
                  )}
                  {selectedColumns.includes('city') && (
                    <TableHead className="cursor-pointer px-6 py-3" onClick={() => handleSort('city')}>
                      City
                      {sortColumn === 'city' && (
                        <span className="ml-2">
                          {sortDirection === 'asc' ? '▲' : '▼'}
                        </span>
                      )}
                    </TableHead>
                  )}
                  {selectedColumns.includes('state') && (
                    <TableHead className="cursor-pointer px-6 py-3" onClick={() => handleSort('state')}>
                      State
                      {sortColumn === 'state' && (
                        <span className="ml-2">
                          {sortDirection === 'asc' ? '▲' : '▼'}
                        </span>
                      )}
                    </TableHead>
                  )}
                  {selectedColumns.includes('actions') && (
                    <TableHead className="text-right px-6 py-3">Actions</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentUsers.map((user) => (
                  <TableRow key={user.id}>
                    {selectedColumns.includes('name') && (
                      <TableCell className="font-medium px-6 py-3">{`${user.firstName} ${user.lastName}`}</TableCell>
                    )}
                    {selectedColumns.includes('role') && <TableCell className="px-6 py-3">{getRoleTag(user.role)}</TableCell>}
                    {selectedColumns.includes('userName') && <TableCell className="px-6 py-3">{user.userName}</TableCell>}
                    {selectedColumns.includes('primaryContact') && <TableCell className="px-6 py-3">{user.primaryContact}</TableCell>}
                    {selectedColumns.includes('city') && <TableCell className="px-6 py-3">{toSentenceCase(user.city)}</TableCell>}
                    {selectedColumns.includes('state') && <TableCell className="px-6 py-3">{user.state}</TableCell>}
                    {selectedColumns.includes('actions') && (
                      <TableCell className="text-right px-6 py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <span>•••</span>
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
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center space-x-2">
              <Label htmlFor="pageSize">Rows per page:</Label>
              <Select value={itemsPerPage.toString()} onValueChange={(value) => setItemsPerPage(parseInt(value))}>
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
                Page {currentPage} of {Math.ceil(sortedUsers.length / itemsPerPage)}
              </span>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.min(Math.ceil(sortedUsers.length / itemsPerPage), currentPage + 1))}
                disabled={currentPage >= Math.ceil(sortedUsers.length / itemsPerPage)}
              >
                Next
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
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
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
