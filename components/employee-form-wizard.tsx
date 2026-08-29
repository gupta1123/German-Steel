"use client";

import React, { useState, useId, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

// Icons
import { 
  ArrowLeft, 
  Eye, 
  EyeOff, 
  CalendarIcon, 
  User, 
  Briefcase, 
  MapPin, 
  Lock, 
  CheckCircle2, 
  ChevronRight,
  ChevronsUpDown,
  Loader2,
  ShieldAlert,
  X
} from 'lucide-react';

import { API, EmployeeUserDto } from "@/lib/api";
import { useGuardedRouter, useUnsavedChanges } from "@/components/unsaved-changes-provider";

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
  departmentName: "",
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

// --- Steps Configuration ---
const STEPS = [
  { id: 0, title: "Personal Details", description: "Identity & Contact", icon: User },
  { id: 1, title: "Work & Role", description: "Department & Designation", icon: Briefcase },
  { id: 2, title: "Residency", description: "Address Information", icon: MapPin },
  { id: 3, title: "Security", description: "Access Credentials", icon: Lock },
];

export default function EmployeeFormWizard({ mode, employeeId }: EmployeeFormWizardProps) {
  const router = useGuardedRouter();
  const isEditMode = mode === "edit";
  const steps = isEditMode ? STEPS.slice(0, -1) : STEPS;
  const pageTitle = isEditMode ? "Edit Employee" : "Add Employee";
  const pageSubtitle = isEditMode ? "Update the existing user profile" : "Create a new user profile";
  const primaryActionLabel = isEditMode ? "Update Employee" : "Create Employee";
  
  // State
  const [currentStep, setCurrentStep] = useState(0);
  const [previousStep, setPreviousStep] = useState(0);
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
    setCurrentStep(0);
    setPreviousStep(0);
    setShowPassword(false);
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
      resetFormState(initialNewEmployeeState);
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

  // Check if form has unsaved changes
  const hasFormChanges = (): boolean => {
    return JSON.stringify(newEmployee) !== JSON.stringify(baselineEmployee) ||
      JSON.stringify(selectedAssignedCities) !== JSON.stringify(baselineAssignedCities);
  };

  // Handle back button click
  const handleBackClick = () => {
    if (hasFormChanges()) {
      setShowBackConfirmDialog(true);
    } else {
      router.push('/dashboard/employees');
    }
  };

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

  const validateStep = (stepIndex: number): boolean => {
    switch (stepIndex) {
      case 0: // Personal
        return !!(
          newEmployee.firstName &&
          newEmployee.lastName &&
          newEmployee.employeeId &&
          newEmployee.primaryContact &&
          newEmployee.primaryContact.length === 10 &&
          !primaryContactError
        );
      case 1: // Work
        return !!(newEmployee.departmentName && newEmployee.role);
      case 2: // Address
        return true; 
      case 3: // Credentials
        return !!(newEmployee.userName && newEmployee.password);
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
        setPreviousStep(currentStep);
        setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
        setPreviousStep(currentStep);
        setCurrentStep(prev => prev - 1);
    }
  };

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

        const allEmployees = await API.getAllEmployees();
        const createdEmployee = allEmployees.find(
          (emp: EmployeeUserDto) => emp?.userDto?.username === newEmployee.userName
        );
        if (createdEmployee) {
          if (roleForApi === 'Field Officer') {
            await syncAssignedCities(createdEmployee.id);
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

      markSaved();
      router.push('/dashboard/employees');
    } catch (error) {
      console.error('Error saving employee:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Animation Variants ---
  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 15 : -15,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 15 : -15,
      opacity: 0,
    }),
  };

  const direction = currentStep > previousStep ? 1 : -1;
  const cityAssignmentOptions = Array.from(
    new Set([...availableCities, newEmployee.city].map((city) => city.trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

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

  const isLastStep = currentStep === steps.length - 1;

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      {/* Ambient background glow */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-primary/5 blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-primary/5 blur-[100px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl">
        
        {/* Top Navigation Bar */}
        <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={handleBackClick} 
                  className="h-10 w-10 rounded-full border-white/10 bg-background/50 hover:bg-accent hover:text-accent-foreground backdrop-blur-md"
                >
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">{pageTitle}</h1>
                    <p className="text-sm text-muted-foreground">{pageSubtitle}</p>
                </div>
            </div>
            <div className="hidden text-sm font-medium text-muted-foreground/80 sm:block">
                Step <span className="text-foreground">{currentStep + 1}</span> of {steps.length}
            </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-12 lg:gap-10">
          
          {/* LEFT COLUMN: Stepper Navigation */}
          <div className="lg:col-span-4 lg:block">
            <div className="sticky top-8 space-y-6">
              <Card className="border-border/50 bg-card/30 shadow-none backdrop-blur-sm">
                  <CardContent className="p-6">
                      <nav aria-label="Progress">
                          <ol role="list" className="overflow-hidden">
                              {steps.map((step, stepIdx) => (
                              <li key={step.title} className={cn(stepIdx !== steps.length - 1 ? "pb-10" : "", "relative")}>
                                  {stepIdx !== steps.length - 1 ? (
                                    <div className={cn(
                                        "absolute left-4 top-4 -ml-px mt-0.5 h-full w-[2px]", 
                                        stepIdx < currentStep ? "bg-primary" : "bg-muted"
                                    )} aria-hidden="true" />
                                    ) : null}
                                  <div className="group relative flex items-start">
                                  <span className="flex h-9 items-center">
                                      <span className={cn(
                                          "relative z-10 flex h-8 w-8 items-center justify-center rounded-full transition-all duration-300",
                                          stepIdx < currentStep ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : 
                                          stepIdx === currentStep ? "bg-background ring-2 ring-primary text-primary" : "bg-muted/50 ring-1 ring-white/10 text-muted-foreground"
                                      )}>
                                          {stepIdx < currentStep ? (
                                              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                                          ) : (
                                              <step.icon className="h-4 w-4" />
                                          )}
                                      </span>
                                  </span>
                                  <span className="ml-4 flex min-w-0 flex-col pt-1">
                                      <span className={cn(
                                          "text-sm font-semibold tracking-wide transition-colors",
                                          stepIdx === currentStep ? "text-foreground" : "text-muted-foreground"
                                      )}>{step.title}</span>
                                      <span className="text-xs text-muted-foreground/70">{step.description}</span>
                                  </span>
                                  </div>
                              </li>
                              ))}
                          </ol>
                      </nav>
                  </CardContent>
              </Card>

              {/* Helper Card for Desktop */}
              <div className="hidden lg:flex items-start gap-3 rounded-lg border border-blue-900/50 bg-blue-950/20 p-4 text-sm text-blue-200">
                  <ShieldAlert className="h-5 w-5 shrink-0 text-blue-500" />
                  <div>
                    <p className="font-semibold text-blue-400 mb-1">Admin Notice</p>
                    <p className="opacity-80 leading-relaxed">Ensure all personal data is accurate. The <span className="text-blue-300">Employee ID</span> cannot be changed once the profile is created.</p>
                  </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Form Area */}
          <div className="lg:col-span-8">
            <Card className="min-h-[550px] border-border bg-card relative overflow-hidden shadow-2xl">
                
                <CardHeader className="border-b border-border/50 pb-6">
                    <div className="flex items-center gap-3">
                       <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                         {steps[currentStep]?.icon && React.createElement(steps[currentStep].icon, { className: "h-5 w-5" })}
                       </div>
                       <div>
                         <CardTitle className="text-lg">{steps[currentStep]?.title}</CardTitle>
                         <CardDescription className="text-muted-foreground">{steps[currentStep]?.description}</CardDescription>
                       </div>
                    </div>
                </CardHeader>
                
                <CardContent className="pt-6">
                    <AnimatePresence initial={false} custom={direction} mode="wait">
                        <motion.div
                            key={currentStep}
                            custom={direction}
                            variants={variants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{ x: { type: "spring", stiffness: 300, damping: 30 }, opacity: { duration: 0.2 } }}
                            className="space-y-6"
                        >
                            {/* STEP 1: PERSONAL */}
                            {currentStep === 0 && (
                                <div className="grid gap-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="firstName">First Name <span className="text-red-500">*</span></Label>
                                            <Input id="firstName" name="firstName" placeholder="e.g. John" value={newEmployee.firstName} onChange={handleInputChange} className="h-11 bg-background" autoFocus />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="lastName">Last Name <span className="text-red-500">*</span></Label>
                                            <Input id="lastName" name="lastName" placeholder="e.g. Doe" value={newEmployee.lastName} onChange={handleInputChange} className="h-11 bg-background" />
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <Label htmlFor="employeeId">Employee ID <span className="text-red-500">*</span></Label>
                                        <Input id="employeeId" name="employeeId" placeholder="EMP-001" value={newEmployee.employeeId} onChange={handleInputChange} className="h-11 font-mono uppercase bg-background" />
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
                                                className={cn("h-11 bg-background", primaryContactError ? "border-red-500/50 focus-visible:ring-red-500" : "")} 
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
                                                className={cn("h-11 bg-background", secondaryContactError ? "border-red-500/50 focus-visible:ring-red-500" : "")} 
                                                value={newEmployee.secondaryContact} 
                                                onChange={handleInputChange} 
                                            />
                                             {secondaryContactError && <span className="text-xs text-red-500 font-medium">{secondaryContactError}</span>}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* STEP 2: WORK */}
                            {currentStep === 1 && (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label>Department <span className="text-red-500">*</span></Label>
                                            <Select value={newEmployee.departmentName} onValueChange={(val) => setNewEmployee({ ...newEmployee, departmentName: val })}>
                                                <SelectTrigger className="h-11 bg-background">
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
                                                <SelectTrigger className="h-11 bg-background">
                                                    <SelectValue placeholder="Select Role" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Field Officer">Field Officer</SelectItem>
                                                    <SelectItem value="Manager">Regional Manager</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Date of Joining</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                            <Button
                                                variant={"outline"}
                                                className={cn(
                                                "w-full h-11 justify-start text-left font-normal bg-background border-input",
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
                                                            {city}
                                                            <button
                                                                type="button"
                                                                aria-label={`Remove ${city}`}
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
                                                                        <span>{city}</span>
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
                            {currentStep === 2 && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Street Address</Label>
                                        <Input 
                                            placeholder="Line 1" 
                                            className="h-11 mb-2 bg-background" 
                                            value={newEmployee.addressLine1} 
                                            onChange={(e) => setNewEmployee({...newEmployee, addressLine1: e.target.value})} 
                                        />
                                        <Input 
                                            placeholder="Line 2 (Optional)" 
                                            className="h-11 bg-background" 
                                            value={newEmployee.addressLine2} 
                                            onChange={(e) => setNewEmployee({...newEmployee, addressLine2: e.target.value})} 
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>City</Label>
                                            <Input 
                                                name="city" 
                                                className={cn("h-11 bg-background", cityError ? "border-red-500/50" : "")} 
                                                value={newEmployee.city} 
                                                onChange={handleInputChange} 
                                            />
                                            {cityError && <span className="text-xs text-red-500">{cityError}</span>}
                                        </div>
                                        <div className="space-y-2">
                                            <Label>State</Label>
                                            <Input 
                                                name="state" 
                                                className="h-11 bg-background" 
                                                value={newEmployee.state} 
                                                onChange={handleInputChange} 
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Pincode</Label>
                                            <Input 
                                                name="pincode" 
                                                className="h-11 bg-background" 
                                                value={newEmployee.pincode} 
                                                onChange={handleInputChange} 
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Country</Label>
                                            <Input value="India" disabled className="h-11 bg-muted/20 text-muted-foreground border-input/50" />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* STEP 4: CREDENTIALS */}
                            {steps[currentStep]?.id === 3 && !isEditMode && (
                                <div className="space-y-6 pt-2">
                                    <div className="rounded-lg border border-amber-900/30 bg-amber-950/20 p-4 text-amber-500/90 flex items-start gap-3">
                                        <Lock className="h-5 w-5 mt-0.5 shrink-0" />
                                        <div className="text-sm">
                                            <p className="font-semibold mb-1">Security Notice</p>
                                            <p className="opacity-90">Credentials will be generated instantly. Please handle them securely.</p>
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
                                                className="h-11 bg-background"
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
                                                    className="h-11 pr-10 bg-background"
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
                                        </div>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>

                    {/* Action Buttons */}
                    <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-border/50 bg-card/95 backdrop-blur-sm">
                      <div className="flex items-center justify-between">
                          <Button
                              variant="ghost"
                              onClick={handlePrev}
                              disabled={currentStep === 0 || isSubmitting}
                              className="text-muted-foreground hover:text-foreground hover:bg-muted/50"
                          >
                              <ArrowLeft className="mr-2 h-4 w-4" /> Back
                          </Button>
                          
                          {isLastStep ? (
                              <Button 
                                  onClick={handleSubmit} 
                                  disabled={!validateStep(currentStep) || isSubmitting}
                                  className="min-w-[150px] shadow-lg shadow-primary/20"
                                  size="lg"
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
                          ) : (
                              <Button 
                                  onClick={handleNext} 
                                  disabled={!validateStep(currentStep)}
                                  className="min-w-[130px]"
                                  size="lg"
                              >
                                  Next Step <ChevronRight className="ml-2 h-4 w-4" />
                              </Button>
                          )}
                      </div>
                    </div>
                </CardContent>
            </Card>
          </div>
        </div>
      </div>

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
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div>
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-60 mt-2" />
            </div>
          </div>
          <Skeleton className="h-6 w-24" />
        </div>
        <div className="grid gap-6 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-4 space-y-4">
            {[...Array(4)].map((_, idx) => (
              <Skeleton key={idx} className="h-20 w-full" />
            ))}
          </div>
          <div className="lg:col-span-8 space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-[480px] w-full" />
          </div>
        </div>
      </div>
    </div>
  );
};
