"use client";

import React, { useState, useId, useEffect } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils"; 

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SpacedCalendar } from '@/components/ui/spaced-calendar';
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

// Icons
import { 
  Eye, 
  EyeOff, 
  CalendarIcon, 
  User, 
  Briefcase,
  MapPin, 
  Lock, 
  CheckCircle2, 
  ChevronsUpDown,
  RefreshCw,
  Search,
  Loader2,
  ShieldAlert,
  X
} from 'lucide-react';

import { API, EmployeeUserDto } from "@/lib/api";
import { formatCityLabel } from "@/lib/city-options";
import { useGuardedRouter, useUnsavedChanges } from "@/components/unsaved-changes-provider";
import { useDashboardHeader } from "@/components/dashboard-header-context";

// --- Types & Initial State ---

interface NewEmployeeState {
  employeeId: string;
  firstName: string;
  lastName: string;
  primaryContact: string;
  secondaryContact: string;
  departmentName: string;
  email: string;
  role: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  dateOfJoining: string;
  userName: string;
  password: string;
}

type NewEmployeeField = keyof NewEmployeeState;

const initialNewEmployeeState: NewEmployeeState = {
  employeeId: "",
  firstName: "",
  lastName: "",
  primaryContact: "",
  secondaryContact: "",
  departmentName: "Sales",
  email: "",
  role: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  country: "India",
  pincode: "",
  dateOfJoining: "",
  userName: "",
  password: "",
};

type EmployeeFormMode = "create" | "edit";

interface EmployeeFormWizardProps {
  mode: EmployeeFormMode;
  employeeId?: number;
}

const mapEmployeeDtoToState = (employee: EmployeeUserDto): NewEmployeeState => {
  const normalizedDoJ = employee.dateOfJoining
    ? employee.dateOfJoining.split('T')[0]
    : "";
  const normalizedRole =
    employee.role === "Office Manager" ? "Manager" : employee.role || "";

  return {
    employeeId: employee.employeeId
      ? String(employee.employeeId)
      : employee.userDto?.employeeId
      ? String(employee.userDto.employeeId)
      : "",
    firstName: employee.firstName || "",
    lastName: employee.lastName || "",
    primaryContact: employee.primaryContact
      ? String(employee.primaryContact)
      : "",
    secondaryContact: employee.secondaryContact
      ? String(employee.secondaryContact)
      : "",
    departmentName: employee.departmentName || "",
    email: employee.email || "",
    role: normalizedRole,
    addressLine1: employee.addressLine1 || "",
    addressLine2: employee.addressLine2 || "",
    city: employee.city || "",
    state: employee.state || "",
    country: employee.country || "India",
    pincode: employee.pincode ? String(employee.pincode) : "",
    dateOfJoining: normalizedDoJ,
    userName: employee.userName || employee.userDto?.username || "",
    password: "",
  };
};

const generateTemporaryPassword = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const random = Array.from({ length: 10 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  return `${random}@9`;
};


export default function EmployeeFormWizard({ mode, employeeId }: EmployeeFormWizardProps) {
  const router = useGuardedRouter();
  const isEditMode = mode === "edit";
  const pageTitle = isEditMode ? "Edit Employee" : "Add Employee";
  const pageSubtitle = isEditMode ? "Update the existing user profile" : "Create a new user profile";
  const primaryActionLabel = isEditMode ? "Update Employee" : "Create Employee";
  
  // State
  const [newEmployee, setNewEmployee] = useState<NewEmployeeState>(initialNewEmployeeState);
  const [baselineEmployee, setBaselineEmployee] = useState<NewEmployeeState>(initialNewEmployeeState);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showBackConfirmDialog, setShowBackConfirmDialog] = useState(false);
  const [isFormReady, setIsFormReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [selectedAssignedCities, setSelectedAssignedCities] = useState<string[]>([]);
  const [baselineAssignedCities, setBaselineAssignedCities] = useState<string[]>([]);
  const [isCityAssignmentOpen, setIsCityAssignmentOpen] = useState(false);
  const [citySearch, setCitySearch] = useState("");
  const [usernameWasEdited, setUsernameWasEdited] = useState(false);

  const employeeFormIsDirty = isFormReady && (
    JSON.stringify(newEmployee) !== JSON.stringify(baselineEmployee) ||
    JSON.stringify(selectedAssignedCities) !== JSON.stringify(baselineAssignedCities)
  );
  const { markSaved } = useUnsavedChanges(employeeFormIsDirty);
  
  // Validation State
  const [primaryContactError, setPrimaryContactError] = useState<string | null>(null);
  const [secondaryContactError, setSecondaryContactError] = useState<string | null>(null);
  const [cityError, setCityError] = useState<string | null>(null);
  
  // IDs for accessibility
  const rawUsernameId = useId();
  const rawPasswordId = useId();
  const usernameFieldId = `addEmployeeUser-${rawUsernameId.replace(/:/g, '')}`;
  const passwordFieldId = `addEmployeePass-${rawPasswordId.replace(/:/g, '')}`;

  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;

  const resetFormState = (
    state: NewEmployeeState = initialNewEmployeeState,
    assignedCities: string[] = []
  ) => {
    setNewEmployee(state);
    setBaselineEmployee(state);
    setSelectedAssignedCities(assignedCities);
    setBaselineAssignedCities(assignedCities);
    setShowPassword(false);
    setCitySearch("");
    setUsernameWasEdited(false);
    setPrimaryContactError(null);
    setSecondaryContactError(null);
    setCityError(null);
  };

  useEffect(() => {
    if (!token) return;

    API.getCities()
      .then((cities) => {
        const normalized = Array.from(
          new Set((Array.isArray(cities) ? cities : []).map((city) => city.trim()).filter(Boolean))
        ).sort((a, b) => a.localeCompare(b));
        setAvailableCities(normalized);
      })
      .catch((error) => console.error('Failed to load assignable cities:', error));
  }, [token]);

  // Reset form when navigating from employees list (create mode only)
  useEffect(() => {
    if (!isEditMode && typeof window !== 'undefined') {
      const navigationState = sessionStorage.getItem('addEmployee.navigation');
      if (navigationState === 'fromEmployeesList') {
        resetFormState(initialNewEmployeeState);
        sessionStorage.removeItem('addEmployee.navigation');
      }
    }
  }, [isEditMode]);

  // Load existing employee for edit mode
  useEffect(() => {
    let rafId: number | null = null;

    if (!isEditMode) {
      setIsFormReady(false);
      const createDefaults = {
        ...initialNewEmployeeState,
        dateOfJoining: format(new Date(), "yyyy-MM-dd"),
        password: generateTemporaryPassword(),
      };
      resetFormState(createDefaults);
      setLoadError(null);
      if (typeof window !== 'undefined') {
        rafId = window.requestAnimationFrame(() => setIsFormReady(true));
      } else {
        setIsFormReady(true);
      }

      return () => {
        if (rafId && typeof window !== 'undefined') {
          window.cancelAnimationFrame(rafId);
        }
      };
    }

    if (!employeeId) {
      setLoadError("Missing employee identifier.");
      return;
    }

    const loadEmployee = async () => {
      try {
        setIsFormReady(false);
        setLoadError(null);
        const employee = await API.getEmployeeById(employeeId);
        const mapped = mapEmployeeDtoToState(employee);
        resetFormState(mapped, employee.assignedCity ?? []);
        setIsFormReady(true);
      } catch (error) {
        console.error("Error loading employee:", error);
        setLoadError(error instanceof Error ? error.message : "Failed to load employee.");
      }
    };

    loadEmployee();

    return () => {
      if (rafId && typeof window !== 'undefined') {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [isEditMode, employeeId]);

  useEffect(() => {
    if (isEditMode || usernameWasEdited) return;

    const suggestedUsername = [newEmployee.firstName, newEmployee.lastName]
      .map((part) => part.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_"))
      .filter(Boolean)
      .join("_");

    setNewEmployee((current) =>
      current.userName === suggestedUsername ? current : { ...current, userName: suggestedUsername }
    );
  }, [isEditMode, newEmployee.firstName, newEmployee.lastName, usernameWasEdited]);

  // Handle back button click
  const handleBackClick = React.useCallback(() => {
    if (employeeFormIsDirty) {
      setShowBackConfirmDialog(true);
    } else {
      router.push('/dashboard/employees');
    }
  }, [employeeFormIsDirty, router]);

  useDashboardHeader({
    heading: pageTitle,
    subheading: pageSubtitle,
    onBack: handleBackClick,
  });

  // Confirm navigation back
  const handleConfirmBack = () => {
    setShowBackConfirmDialog(false);
    markSaved();
    router.push('/dashboard/employees');
  };

  // --- Handlers ---

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = e.currentTarget;
    const datasetField = target.dataset.field as NewEmployeeField | undefined;
    const fieldName = datasetField ?? (target.name as NewEmployeeField);
    if (!fieldName) return;
    let { value } = target;

    if (fieldName === "userName") setUsernameWasEdited(true);

    // Phone Validation
    if (fieldName === 'primaryContact' || fieldName === 'secondaryContact') {
      const digitsOnly = (value || '').replace(/\D/g, '');
      const capped = digitsOnly.slice(0, 10);
      const digitCount = capped.length;
      const err = digitCount > 0 && digitCount < 10 ? 'Must be 10 digits' : null;
      
      if (fieldName === 'primaryContact') setPrimaryContactError(err);
      if (fieldName === 'secondaryContact') setSecondaryContactError(err);
      value = capped;
    }

    // City Validation
    if (fieldName === 'city') {
      const textOnly = value.replace(/[0-9]/g, '');
      if (textOnly !== value) {
        setCityError('City cannot contain numbers');
        value = textOnly;
      } else {
        setCityError(null);
      }
    }

    setNewEmployee((prev) => ({ ...prev, [fieldName]: value }));
  };

  const formIsValid = !!(
    newEmployee.firstName.trim() &&
    newEmployee.lastName.trim() &&
    newEmployee.employeeId.trim() &&
    newEmployee.primaryContact.length === 10 &&
    !primaryContactError &&
    newEmployee.departmentName &&
    newEmployee.role &&
    (isEditMode || (newEmployee.userName.trim() && newEmployee.password))
  );

  const toggleAssignedCity = (city: string) => {
    setSelectedAssignedCities((current) =>
      current.some((item) => item.toLowerCase() === city.toLowerCase())
        ? current.filter((item) => item.toLowerCase() !== city.toLowerCase())
        : [...current, city]
    );
  };

  const syncAssignedCities = async (targetEmployeeId: number) => {
    const baselineByKey = new Map(baselineAssignedCities.map((city) => [city.trim().toLowerCase(), city]));
    const selectedByKey = new Map(selectedAssignedCities.map((city) => [city.trim().toLowerCase(), city]));

    const citiesToAssign = Array.from(selectedByKey.entries())
      .filter(([key]) => !baselineByKey.has(key))
      .map(([, city]) => city);
    const citiesToRemove = Array.from(baselineByKey.entries())
      .filter(([key]) => !selectedByKey.has(key))
      .map(([, city]) => city);

    await Promise.all([
      ...citiesToAssign.map((city) => API.assignEmployeeCity(targetEmployeeId, city)),
      ...citiesToRemove.map((city) => API.removeEmployeeCity(targetEmployeeId, city)),
    ]);
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      
      if (!token) {
        alert('Authentication token not found. Please log in again.');
        return;
      }

      // Final Data prep
      const roleForApi = newEmployee.role === 'Manager' || newEmployee.role === 'Regional Manager' 
        ? 'Office Manager' 
        : newEmployee.role;

      const primaryContactNum = Number(newEmployee.primaryContact);
      const secondaryContactNum = newEmployee.secondaryContact ? Number(newEmployee.secondaryContact) : null;

      // Final quick validation check
      if (isNaN(primaryContactNum) || primaryContactNum.toString().length !== 10) throw new Error("Invalid Primary Contact");
      if (secondaryContactNum && (isNaN(secondaryContactNum) || secondaryContactNum.toString().length !== 10)) throw new Error("Invalid Secondary Contact");

      const employeePayload = {
        employeeId: newEmployee.employeeId,
        firstName: newEmployee.firstName,
        lastName: newEmployee.lastName,
        primaryContact: primaryContactNum,
        secondaryContact: secondaryContactNum,
        departmentName: newEmployee.departmentName,
        email: newEmployee.email,
        role: roleForApi,
        addressLine1: newEmployee.addressLine1,
        addressLine2: newEmployee.addressLine2,
        city: newEmployee.city,
        state: newEmployee.state,
        country: newEmployee.country,
        pincode: newEmployee.pincode,
        dateOfJoining: newEmployee.dateOfJoining,
      };

      if (!isEditMode) {
        const requestBody = {
          user: {
            username: newEmployee.userName,
            password: newEmployee.password,
          },
          employee: employeePayload,
        };

        await API.createEmployee(requestBody);

        const allEmployees = await API.getAllEmployees({ forceRefresh: true });
        const createdEmployee = allEmployees.find(
          (emp: EmployeeUserDto) => emp?.userDto?.username === newEmployee.userName
        );
        if (createdEmployee) {
          if (roleForApi === 'Field Officer') {
            await syncAssignedCities(createdEmployee.id);
            const refreshedEmployee = await API.getEmployeeById(createdEmployee.id);
            const savedCityKeys = new Set((refreshedEmployee.assignedCity ?? []).map((city) => city.trim().toLowerCase()));
            const missingCities = selectedAssignedCities.filter((city) => !savedCityKeys.has(city.trim().toLowerCase()));
            if (missingCities.length > 0) {
              throw new Error(`Employee was created, but these city assignments were not saved: ${missingCities.join(', ')}`);
            }
          }

          try {
            await API.createAttendanceLog(createdEmployee.id);
          } catch (logErr) {
            console.warn("Attendance log creation failed, but employee and city assignments were saved.", logErr);
          }
        } else if (roleForApi === 'Field Officer' && selectedAssignedCities.length > 0) {
          throw new Error('Employee was created, but the new employee ID could not be resolved for city assignment.');
        }
      } else {
        if (!employeeId) {
          throw new Error("Invalid employee id");
        }

        const updatePayload: Record<string, unknown> = {
          ...employeePayload,
          userName: newEmployee.userName,
        };

        const trimmedPassword = newEmployee.password?.trim();
        if (trimmedPassword) {
          updatePayload.password = trimmedPassword;
        }

        await API.updateEmployee(employeeId, updatePayload);
        if (roleForApi === 'Field Officer') {
          await syncAssignedCities(employeeId);
        }
      }

      toast.success(isEditMode ? "Employee updated" : "Employee created", { duration: 3000 });
      markSaved();
      router.push('/dashboard/employees');
    } catch (error) {
      console.error('Error saving employee:', error);
      toast.error(error instanceof Error ? error.message : 'Could not save employee', { duration: 3000 });
    } finally {
      setIsSubmitting(false);
    }
  };

  const cityAssignmentOptions = Array.from(
    [...availableCities, newEmployee.city]
      .map((city) => city.trim())
      .filter(Boolean)
      .reduce((cities, city) => {
        const key = city.toLowerCase();
        const residenceCity = newEmployee.city.trim();
        cities.set(key, residenceCity && residenceCity.toLowerCase() === key ? residenceCity : formatCityLabel(city));
        return cities;
      }, new Map<string, string>())
      .values()
  )
    .filter((city) => city.toLowerCase().includes(citySearch.trim().toLowerCase()))
    .sort((a, b) => a.localeCompare(b));

  if (isEditMode && loadError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <p className="text-sm text-red-500">Failed to load employee details.</p>
        <p className="text-sm text-muted-foreground text-center">{loadError}</p>
        <Button onClick={() => router.push('/dashboard/employees')}>Back to Employees</Button>
      </div>
    );
  }

  if (!isFormReady) {
    return <EmployeeFormSkeleton />;
  }

  return (
    <div className="mx-auto w-full max-w-6xl py-3 text-foreground">
      {isEditMode && (
        <div className="mb-3 flex items-start gap-2.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs text-slate-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-100">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
          <p><span className="font-semibold text-slate-900 dark:text-white">Admin notice:</span> Verify personal information carefully. The Employee ID is permanent after profile creation.</p>
        </div>
      )}

      <Card className="mx-auto flex flex-col overflow-hidden border-border/80 shadow-sm">
                {!isEditMode && <CardHeader className="border-b border-border/60 px-5 py-4">
                    <div className="flex items-center gap-3">
                       <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                         <User className="h-4 w-4" />
                       </div>
                       <div>
                         <CardTitle className="text-base font-semibold tracking-tight">Employee profile</CardTitle>
                         <CardDescription className="text-xs text-muted-foreground">Identity, work assignment, address, and account access</CardDescription>
                       </div>
                    </div>
                </CardHeader>}
                
                <CardContent className={cn("flex-1", isEditMode ? "p-4" : "px-5 py-5")}>
                    <div className="space-y-5">
                            {/* STEP 1: PERSONAL */}
                            {(
                                <div className="grid gap-4">
                                      <div className="flex items-start gap-2.5">
                                        <User className="mt-0.5 h-4 w-4 text-muted-foreground" />
                                        <div>
                                        <h3 className="text-sm font-semibold tracking-tight">Personal details</h3>
                                        <p className="mt-0.5 text-xs text-muted-foreground">Basic identity and contact information</p>
                                        </div>
                                      </div>
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="firstName">First Name <span className="text-red-500">*</span></Label>
                                            <Input id="firstName" name="firstName" placeholder="e.g. John" value={newEmployee.firstName} onChange={handleInputChange} className="h-9 bg-background" autoFocus />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="lastName">Last Name <span className="text-red-500">*</span></Label>
                                            <Input id="lastName" name="lastName" placeholder="e.g. Doe" value={newEmployee.lastName} onChange={handleInputChange} className="h-9 bg-background" />
                                        </div>
                                    
                                    <div className="space-y-2 xl:col-span-2">
                                        <Label htmlFor="employeeId">Employee ID <span className="text-red-500">*</span></Label>
                                        <Input id="employeeId" name="employeeId" placeholder="EMP-001" value={newEmployee.employeeId} onChange={handleInputChange} disabled={isEditMode} className="h-9 bg-background font-mono uppercase disabled:opacity-70" />
                                    </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="primaryContact">Primary Contact <span className="text-red-500">*</span></Label>
                                            <Input 
                                                id="primaryContact" 
                                                name="primaryContact" 
                                                placeholder="9876543210" 
                                                maxLength={10} 
                                                inputMode="numeric"
                                                className={cn("h-9 bg-background", primaryContactError ? "border-red-500/50 focus-visible:ring-red-500" : "")}
                                                value={newEmployee.primaryContact} 
                                                onChange={handleInputChange} 
                                            />
                                            {primaryContactError && <span className="text-xs text-red-500 font-medium">{primaryContactError}</span>}
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="secondaryContact">Secondary Contact</Label>
                                            <Input 
                                                id="secondaryContact" 
                                                name="secondaryContact" 
                                                placeholder="Optional" 
                                                maxLength={10} 
                                                inputMode="numeric"
                                                className={cn("h-9 bg-background", secondaryContactError ? "border-red-500/50 focus-visible:ring-red-500" : "")}
                                                value={newEmployee.secondaryContact} 
                                                onChange={handleInputChange} 
                                            />
                                             {secondaryContactError && <span className="text-xs text-red-500 font-medium">{secondaryContactError}</span>}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* STEP 2: WORK */}
                            {(
                                <div className="space-y-4">
                                        <Separator />
                                        <div className="flex items-start gap-2.5">
                                          <Briefcase className="mt-0.5 h-4 w-4 text-muted-foreground" />
                                          <div>
                                          <h3 className="text-sm font-semibold tracking-tight">Work and role</h3>
                                          <p className="mt-0.5 text-xs text-muted-foreground">Department, designation, and operational assignments</p>
                                          </div>
                                        </div>
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                        <div className="space-y-2">
                                            <Label>Department <span className="text-red-500">*</span></Label>
                                            <Select value={newEmployee.departmentName} onValueChange={(val) => setNewEmployee({ ...newEmployee, departmentName: val })}>
                                                <SelectTrigger className="h-9 w-full bg-background">
                                                    <SelectValue placeholder="Select Department" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Sales">Sales</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Assigned Role <span className="text-red-500">*</span></Label>
                                            <Select
                                                value={newEmployee.role}
                                                onValueChange={(val) => {
                                                    setNewEmployee({ ...newEmployee, role: val });
                                                    if (val !== 'Field Officer') {
                                                        setSelectedAssignedCities([]);
                                                    }
                                                }}
                                            >
                                                <SelectTrigger className="h-9 w-full bg-background">
                                                    <SelectValue placeholder="Select Role" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Field Officer">Field Officer</SelectItem>
                                                    <SelectItem value="Manager">Regional Manager</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                    <div className="space-y-2">
                                        <Label>Date of Joining</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                            <Button
                                                variant={"outline"}
                                                className={cn(
                                                "h-9 w-full justify-start border-input bg-background text-left font-normal",
                                                !newEmployee.dateOfJoining && "text-muted-foreground"
                                                )}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {newEmployee.dateOfJoining ? format(new Date(newEmployee.dateOfJoining), "MMM dd, yyyy") : <span>Pick a date</span>}
                                            </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                            <SpacedCalendar
                                                mode="single"
                                                selected={newEmployee.dateOfJoining ? new Date(newEmployee.dateOfJoining) : undefined}
                                                onSelect={(date) => {
                                                    if(date) setNewEmployee({...newEmployee, dateOfJoining: format(date, 'yyyy-MM-dd')})
                                                }}
                                                initialFocus
                                            />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    </div>

                                    {newEmployee.role === 'Field Officer' && (
                                        <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
                                            <div>
                                                <Label>Assign Cities to Field Officer</Label>
                                                <p className="mt-1 text-xs text-muted-foreground">
                                                    Select one or more operational cities. These assignments are saved after the employee profile is created.
                                                </p>
                                            </div>

                                            {selectedAssignedCities.length > 0 && (
                                                <div className="flex flex-wrap gap-2">
                                                    {selectedAssignedCities.map((city) => (
                                                        <Badge key={city} variant="secondary" className="gap-1 pr-1">
                                                            {formatCityLabel(city)}
                                                            <button
                                                                type="button"
                                                                aria-label={`Remove ${formatCityLabel(city)}`}
                                                                className="rounded-sm p-0.5 hover:bg-background/70"
                                                                onClick={() => toggleAssignedCity(city)}
                                                            >
                                                                <X className="h-3 w-3" />
                                                            </button>
                                                        </Badge>
                                                    ))}
                                                </div>
                                            )}

                                            <Popover open={isCityAssignmentOpen} onOpenChange={setIsCityAssignmentOpen}>
                                                <PopoverTrigger asChild>
                                                    <Button type="button" variant="outline" className="w-full justify-between">
                                                        {selectedAssignedCities.length === 0
                                                            ? 'Select assigned cities'
                                                            : `${selectedAssignedCities.length} ${selectedAssignedCities.length === 1 ? 'city' : 'cities'} selected`}
                                                        <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[--radix-popover-trigger-width] p-1" align="start">
                                                    <div className="relative border-b border-border/60 p-1.5">
                                                        <Search className="absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                                                        <Input
                                                            value={citySearch}
                                                            onChange={(event) => setCitySearch(event.target.value)}
                                                            placeholder="Search cities"
                                                            className="h-8 border-0 bg-transparent pl-8 shadow-none focus-visible:ring-0"
                                                        />
                                                    </div>
                                                    {cityAssignmentOptions.length === 0 ? (
                                                        <div className="p-3 text-sm text-muted-foreground">
                                                            Enter the employee city in the Residency step first.
                                                        </div>
                                                    ) : (
                                                        <div className="max-h-56 overflow-y-auto">
                                                            {cityAssignmentOptions.map((city) => {
                                                                const checked = selectedAssignedCities.some(
                                                                    (item) => item.toLowerCase() === city.toLowerCase()
                                                                );
                                                                return (
                                                                    <label
                                                                        key={city}
                                                                        className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted"
                                                                    >
                                                                        <Checkbox
                                                                            checked={checked}
                                                                            onCheckedChange={() => toggleAssignedCity(city)}
                                                                        />
                                                                        <span>{formatCityLabel(city)}</span>
                                                                    </label>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* STEP 3: ADDRESS */}
                            {(
                                <div className="space-y-4">
                                        <Separator />
                                        <div className="flex items-start gap-2.5">
                                          <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                                          <div>
                                          <h3 className="text-sm font-semibold tracking-tight">Residency</h3>
                                          <p className="mt-0.5 text-xs text-muted-foreground">Home address and location details</p>
                                          </div>
                                        </div>
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                      <div className="space-y-2">
                                        <Label>Address line 1</Label>
                                        <Input placeholder="Street address" className="h-9 bg-background" value={newEmployee.addressLine1} onChange={(e) => setNewEmployee({...newEmployee, addressLine1: e.target.value})} />
                                      </div>
                                      <div className="space-y-2">
                                        <Label>Address line 2</Label>
                                        <Input placeholder="Optional" className="h-9 bg-background" value={newEmployee.addressLine2} onChange={(e) => setNewEmployee({...newEmployee, addressLine2: e.target.value})} />
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                                        <div className="space-y-2">
                                            <Label>City</Label>
                                            <Input 
                                                name="city" 
                                                className={cn("h-9 bg-background", cityError ? "border-red-500/50" : "")}
                                                value={newEmployee.city} 
                                                onChange={handleInputChange} 
                                            />
                                            {cityError && <span className="text-xs text-red-500">{cityError}</span>}
                                        </div>
                                        <div className="space-y-2">
                                            <Label>State</Label>
                                            <Input 
                                                name="state" 
                                                className="h-9 bg-background"
                                                value={newEmployee.state} 
                                                onChange={handleInputChange} 
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Pincode</Label>
                                            <Input 
                                                name="pincode" 
                                                className="h-9 bg-background"
                                                value={newEmployee.pincode} 
                                                onChange={handleInputChange} 
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Country</Label>
                                            <Input value="India" disabled className="h-9 border-input/50 bg-muted/20 text-muted-foreground" />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* STEP 4: CREDENTIALS */}
                            {!isEditMode && (
                                <div className="space-y-4 pt-1">
                                    <Separator />
                                    <div className="flex items-start gap-2.5">
                                        <Lock className="mt-0.5 h-4 w-4 text-muted-foreground" />
                                        <div>
                                            <h3 className="text-sm font-semibold tracking-tight">Account access</h3>
                                            <p className="mt-0.5 text-xs text-muted-foreground">A username and temporary password are suggested automatically.</p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor={usernameFieldId}>Username <span className="text-red-500">*</span></Label>
                                            <Input 
                                                id={usernameFieldId}
                                                name={usernameFieldId}
                                                data-field="userName"
                                                value={newEmployee.userName}
                                                onChange={handleInputChange}
                                                className="h-9 bg-background"
                                                autoComplete="off"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={passwordFieldId}>Password <span className="text-red-500">*</span></Label>
                                            <div className="relative">
                                                <Input 
                                                    id={passwordFieldId}
                                                    name={passwordFieldId}
                                                    data-field="password"
                                                    type={showPassword ? 'text' : 'password'}
                                                    value={newEmployee.password}
                                                    onChange={handleInputChange}
                                                    className="h-9 bg-background pr-10"
                                                    autoComplete="new-password"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                                >
                                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                </button>
                                            </div>
                                            <div className="flex justify-end">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 px-2 text-xs text-muted-foreground"
                                                    onClick={() => setNewEmployee((current) => ({ ...current, password: generateTemporaryPassword() }))}
                                                >
                                                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                                                    Generate another password
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                    {/* Action Buttons */}
                    <div className={cn("border-t border-border/60 bg-muted/15", isEditMode ? "-mx-4 -mb-4 mt-4 px-4 py-3" : "-mx-5 -mb-5 mt-6 px-5 py-4")}>
                      <div className="flex items-center justify-between gap-3">
                          <Button
                              variant="ghost"
                              onClick={handleBackClick}
                              disabled={isSubmitting}
                              className="text-muted-foreground hover:text-foreground"
                          >
                              Cancel
                          </Button>
                              <Button 
                                  onClick={handleSubmit} 
                                  disabled={!formIsValid || isSubmitting}
                              className="min-w-[140px]"
                              size="sm"
                              >
                                  {isSubmitting ? (
                                      <>
                                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {isEditMode ? "Updating..." : "Creating..."}
                                      </>
                                  ) : (
                                      <>
                                          {primaryActionLabel} <CheckCircle2 className="ml-2 h-4 w-4" />
                                      </>
                                  )}
                              </Button>
                      </div>
                    </div>
                </CardContent>
            </Card>

      {/* Back Confirmation Dialog */}
      <Dialog open={showBackConfirmDialog} onOpenChange={setShowBackConfirmDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Discard Changes?</DialogTitle>
            <DialogDescription>
              You have unsaved changes. Are you sure you want to leave? All entered data will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowBackConfirmDialog(false)}
            >
              Continue Editing
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleConfirmBack}
            >
              Yes, Leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const EmployeeFormSkeleton = () => {
  return (
    <div className="mx-auto w-full max-w-none space-y-3 py-4">
      <Skeleton className="h-10 w-full rounded-lg" />
      <Card className="shadow-none">
        <CardContent className="space-y-5 p-4">
          {[5, 3, 6].map((fieldCount, section) => (
            <div key={fieldCount} className="space-y-3">
              {section > 0 && <Separator />}
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-56" />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: fieldCount }, (_, index) => <Skeleton key={index} className="h-9 w-full" />)}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      </div>
  );
};
