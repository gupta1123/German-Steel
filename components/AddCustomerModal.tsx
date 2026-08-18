"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { API, type EmployeeUserDto } from '@/lib/api';
import { isManagerRoleValue } from '@/lib/auth';
import { getUniqueFieldOfficersFromTeams } from '@/lib/team-access';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Search, Check, MapPin, Loader2, ChevronDown } from 'lucide-react';
import { getAllStates, getDistricts } from 'india-state-district';

interface CustomerData {
  id?: number;
  storeName?: string;
  clientFirstName?: string;
  clientLastName?: string;
  primaryContact?: string | number;
  secondaryContact?: string | number;
  email?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  district?: string;
  country?: string;
  pincode?: string | number;
  gstNumber?: string;
  monthlySale?: string | number;
  clientType?: string;
  fieldOfficerId?: number;
  dateOfBirth?: string;
  dob?: string;
  yearOfJoining?: string | number;
}

// Using EmployeeUserDto from API instead of local interface

interface AddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  employeeId: number | null;
  existingData?: CustomerData;
  onCustomerAdded?: () => void;
  userRole?: string;
  userData?: Record<string, unknown>;
}

const AddCustomerModal: React.FC<AddCustomerModalProps> = ({
  isOpen,
  onClose,
  token,
  employeeId,
  existingData,
  onCustomerAdded,
  userRole,
  userData,
}) => {
  const [customerData, setCustomerData] = useState<CustomerData>(
    existingData || {
      clientFirstName: '',
      clientLastName: '',
      email: '',
      dateOfBirth: '',
      dob: '',
    }
  );
  const [activeTab, setActiveTab] = useState<string>('basic');
  const [employees, setEmployees] = useState<EmployeeUserDto[]>([]);
  const [primaryContactError, setPrimaryContactError] = useState<string | null>(null);
  const [secondaryContactError, setSecondaryContactError] = useState<string | null>(null);
  const [isFieldOfficerPopoverOpen, setIsFieldOfficerPopoverOpen] = useState(false);
  const [fieldOfficerSearchTerm, setFieldOfficerSearchTerm] = useState("");
  const [dobDisplayValue, setDobDisplayValue] = useState<string>('');
  const [isAssigningCustomerCity, setIsAssigningCustomerCity] = useState(false);
  const [cityAssignmentError, setCityAssignmentError] = useState<string | null>(null);
  const [assignableCities, setAssignableCities] = useState<string[]>([]);
  const [isDistrictPopoverOpen, setIsDistrictPopoverOpen] = useState(false);
  const [districtSearchTerm, setDistrictSearchTerm] = useState('');

  const fieldOfficerOptions = useMemo(() => {
    return employees
      .filter((employee) => employee.role?.trim().toLowerCase() === 'field officer')
      .map((employee) => ({
        id: employee.id,
        name: [employee.firstName, employee.lastName].filter(Boolean).join(' ').trim(),
        profileCity: employee.city?.trim() || '',
        state: employee.state?.trim() || '',
        district: employee.district?.trim() || '',
        country: employee.country?.trim() || '',
        assignedCities: Array.from(
          new Set(
            (Array.isArray(employee.assignedCity) ? employee.assignedCity : [])
              .map((city) => city?.trim())
              .filter((city): city is string => Boolean(city)),
          ),
        ),
      }));
  }, [employees]);

  const filteredFieldOfficers = useMemo(() => {
    const query = fieldOfficerSearchTerm.trim().toLowerCase();
    if (!query) return fieldOfficerOptions;
    return fieldOfficerOptions.filter((option) =>
      option.name.toLowerCase().includes(query)
    );
  }, [fieldOfficerOptions, fieldOfficerSearchTerm]);

  const selectedFieldOfficerName = useMemo(() => {
    if (!customerData.fieldOfficerId) return '';
    const match = fieldOfficerOptions.find((option) => option.id === customerData.fieldOfficerId);
    return match?.name ?? '';
  }, [customerData.fieldOfficerId, fieldOfficerOptions]);

  const selectedFieldOfficer = useMemo(() => {
    if (!customerData.fieldOfficerId) return undefined;
    return fieldOfficerOptions.find((option) => option.id === customerData.fieldOfficerId);
  }, [customerData.fieldOfficerId, fieldOfficerOptions]);

  const selectedOfficerCities = useMemo(() => {
    if (!selectedFieldOfficer) return [];
    return selectedFieldOfficer.assignedCities;
  }, [selectedFieldOfficer]);

  const districtOptions = useMemo(() => {
    const state = customerData.state?.trim();
    if (!state) return [];
    const stateCode = getAllStates().find(
      (option) => option.name.toLowerCase() === state.toLowerCase(),
    )?.code;
    if (!stateCode) return [];
    return [...getDistricts(stateCode)]
      .sort((left, right) => left.localeCompare(right));
  }, [customerData.state]);

  const stateOptions = useMemo(() => (
    getAllStates()
      .map((option) => option.name)
      .sort((left, right) => left.localeCompare(right))
  ), []);

  const filteredDistrictOptions = useMemo(() => {
    const query = districtSearchTerm.trim().toLowerCase();
    if (!query) return districtOptions;
    return districtOptions.filter((district) => district.toLowerCase().includes(query));
  }, [districtOptions, districtSearchTerm]);

  const joiningYearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 76 }, (_, index) => currentYear - index);
  }, []);

  const applyOfficerLocation = (
    officer: (typeof fieldOfficerOptions)[number] | undefined,
    city?: string,
  ) => {
    const selectedCity = city ?? officer?.assignedCities[0] ?? '';
    const matchesProfileCity = Boolean(
      selectedCity && officer?.profileCity && selectedCity.trim().toLowerCase() === officer.profileCity.toLowerCase(),
    );
    setCustomerData((previous) => ({
      ...previous,
      city: selectedCity,
      state: matchesProfileCity ? officer?.state ?? '' : '',
      district: matchesProfileCity ? officer?.district ?? '' : '',
      country: matchesProfileCity ? officer?.country || previous.country || '' : previous.country || '',
    }));
  };

  const handleCustomerStateChange = (state: string) => {
    setCustomerData((previous) => ({
      ...previous,
      state,
      district: '',
    }));
    setDistrictSearchTerm('');
    setIsDistrictPopoverOpen(false);
  };

  const handleFieldOfficerSelect = (id: number) => {
    const officer = fieldOfficerOptions.find((option) => option.id === id);
    const assignedCity = officer?.assignedCities[0] ?? '';
    const matchesProfileCity = Boolean(
      assignedCity && officer?.profileCity && assignedCity.toLowerCase() === officer.profileCity.toLowerCase(),
    );
    setCustomerData((previous) => ({
      ...previous,
      fieldOfficerId: id,
      city: assignedCity,
      state: matchesProfileCity ? officer?.state ?? '' : '',
      district: matchesProfileCity ? officer?.district ?? '' : '',
      country: matchesProfileCity ? officer?.country || previous.country || '' : previous.country || '',
    }));
    setCityAssignmentError(null);
    setFieldOfficerSearchTerm('');
    setIsFieldOfficerPopoverOpen(false);
  };

  useEffect(() => {
    if (
      !isOpen ||
      existingData?.id ||
      customerData.fieldOfficerId ||
      employeeId == null ||
      !fieldOfficerOptions.some((option) => option.id === employeeId)
    ) {
      return;
    }

    const officer = fieldOfficerOptions.find((option) => option.id === employeeId);
    const assignedCity = officer?.assignedCities[0] ?? '';
    const matchesProfileCity = Boolean(
      assignedCity && officer?.profileCity && assignedCity.toLowerCase() === officer.profileCity.toLowerCase(),
    );
    setCustomerData((previous) => ({
      ...previous,
      fieldOfficerId: employeeId,
      city: assignedCity,
      state: matchesProfileCity ? officer?.state ?? '' : '',
      district: matchesProfileCity ? officer?.district ?? '' : '',
      country: matchesProfileCity ? officer?.country || previous.country || '' : previous.country || '',
    }));
  }, [isOpen, existingData?.id, employeeId, fieldOfficerOptions, customerData.fieldOfficerId]);

  const handleAssignCustomerCity = async (city: string) => {
    const officerId = customerData.fieldOfficerId;
    const normalizedCity = city.trim();
    if (!officerId || !normalizedCity) return;

    setIsAssigningCustomerCity(true);
    setCityAssignmentError(null);
    try {
      await API.assignEmployeeCity(officerId, normalizedCity);
      setEmployees((current) => current.map((employee) => {
        if (employee.id !== officerId) return employee;
        const assignedCity = Array.from(new Set([...(employee.assignedCity ?? []), normalizedCity]));
        return { ...employee, assignedCity };
      }));
      applyOfficerLocation(selectedFieldOfficer, normalizedCity);
    } catch (error) {
      setCityAssignmentError(error instanceof Error ? error.message : `Failed to assign ${normalizedCity}`);
    } finally {
      setIsAssigningCustomerCity(false);
    }
  };

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        // Check if user is a manager
        const isManager = isManagerRoleValue(userRole);
        
        if (isManager && userData?.employeeId) {
          // For managers, fetch only their field officers
          const teamData = await API.getTeamByEmployee(Number(userData.employeeId));
          setEmployees(getUniqueFieldOfficersFromTeams(teamData));
        } else {
          // For admins, fetch all employees
          const data = await API.getAllEmployees();
          setEmployees(data);
        }
      } catch (error) {
        console.error('Error fetching employees:', error);
        const isManager = isManagerRoleValue(userRole);
        if (isManager) {
          setEmployees([]);
          return;
        }

        try {
          const data = await API.getAllEmployees();
          setEmployees(data);
        } catch (fallbackError) {
          console.error('Error fetching all employees:', fallbackError);
        }
      }
    };

    fetchEmployees();
  }, [token, userRole, userData?.employeeId]);

  useEffect(() => {
    if (!isOpen) return;
    API.getCities()
      .then((cities) => {
        const normalized = Array.from(new Set(
          (Array.isArray(cities) ? cities : [])
            .map((city) => city?.trim())
            .filter((city): city is string => Boolean(city)),
        )).sort((left, right) => left.localeCompare(right));
        setAssignableCities(normalized);
      })
      .catch((error) => {
        console.error('Failed to load cities for assignment:', error);
        setAssignableCities([]);
      });
  }, [isOpen]);

  const handleInputChange = (field: keyof CustomerData, value: string | number) => {
    let parsedValue: string | number = value;
    const numberFields: (keyof CustomerData)[] = ['pincode', 'monthlySale', 'primaryContact', 'secondaryContact', 'fieldOfficerId', 'yearOfJoining'];
    
    // Validate contact fields
    if (field === 'primaryContact') {
      const stringValue = value.toString();
      // Only allow digits and limit to 10 characters
      const digitsOnly = stringValue.replace(/\D/g, '');
      if (digitsOnly.length > 10) {
        return; // Don't update if more than 10 digits
      }
      
      if (digitsOnly.length > 0 && digitsOnly.length < 10) {
        setPrimaryContactError('Primary contact must be exactly 10 digits');
      } else if (digitsOnly.length === 10) {
        setPrimaryContactError(null);
      } else {
        setPrimaryContactError(null);
      }
      
      parsedValue = digitsOnly === '' ? '' : parseInt(digitsOnly, 10);
    } else if (field === 'secondaryContact') {
      const stringValue = value.toString();
      // Only allow digits and limit to 10 characters
      const digitsOnly = stringValue.replace(/\D/g, '');
      if (digitsOnly.length > 10) {
        return; // Don't update if more than 10 digits
      }
      
      if (digitsOnly.length > 0 && digitsOnly.length < 10) {
        setSecondaryContactError('Secondary contact must be exactly 10 digits');
      } else if (digitsOnly.length === 10) {
        setSecondaryContactError(null);
      } else {
        setSecondaryContactError(null);
      }
      
      parsedValue = digitsOnly === '' ? '' : parseInt(digitsOnly, 10);
    } else if (numberFields.includes(field)) {
      parsedValue = value === '' ? '' : parseInt(value.toString(), 10);
    }

    setCustomerData((prevData) => ({
      ...prevData,
      [field]: parsedValue,
    }));
  };

  const handleSubmit = async () => {
    try {
      // Get dob in yyyy-MM-dd format for API (only send `dob`, not `dateOfBirth`)
      const dobValue = customerData.dateOfBirth || customerData.dob || '';
      let formattedDob: string | undefined;
      if (dobValue) {
        if (dobValue.includes('-') && dobValue.split('-').length === 3 && dobValue.split('-')[0].length === 4) {
          // Already in yyyy-MM-dd format
          formattedDob = dobValue;
        } else if (dobDisplayValue) {
          // Convert from MM/DD/YYYY display format
          formattedDob = convertDateToAPIFormat(dobDisplayValue) || undefined;
        }
      }
      
      const restCustomerData = { ...customerData };
      delete restCustomerData.id;
      delete restCustomerData.dateOfBirth;
      delete restCustomerData.dob;
      delete restCustomerData.fieldOfficerId;
      
      const requestBody = {
        ...restCustomerData,
        primaryContact: customerData.primaryContact ? parseInt(customerData.primaryContact.toString(), 10) : undefined,
        secondaryContact: customerData.secondaryContact ? parseInt(customerData.secondaryContact.toString(), 10) : undefined,
        pincode: customerData.pincode ? parseInt(customerData.pincode.toString(), 10) : undefined,
        monthlySale: customerData.monthlySale ? parseInt(customerData.monthlySale.toString(), 10) : undefined,
        yearOfJoining: customerData.yearOfJoining ? parseInt(customerData.yearOfJoining.toString(), 10) : undefined,
        latitude: 10.0,
        longitude: -23.0,
        employeeId: customerData.fieldOfficerId, // Use selected field officer's ID
        dob: formattedDob || undefined,
      };

      console.log('requestBody', requestBody)
      const url = existingData && existingData.id
        ? `http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/store/edit?id=${existingData.id}`
        : 'http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/store/create';
      const method = existingData && existingData.id ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      console.log(response)
      if (response.ok) {
        const data = await response.json();
        console.log(data)
        onClose(); // Close the modal after successful submission
        if (onCustomerAdded) {
          onCustomerAdded(); // Refresh the customers list
        }
      } else {
        console.error('Failed to update/create customer');
        // Handle error case, e.g., show an error message to the user
      }
    } catch (error) {
      console.error('Error updating/creating customer:', error);
      // Handle error case, e.g., show an error message to the user
    }
  };

  const handleNext = () => {
    if (activeTab === 'basic') {
      setActiveTab('contact');
    } else if (activeTab === 'contact') {
      setActiveTab('address');
    } else if (activeTab === 'address') {
      setActiveTab('additional');
    }
  };

  const handlePrevious = () => {
    if (activeTab === 'additional') {
      setActiveTab('address');
    } else if (activeTab === 'address') {
      setActiveTab('contact');
    } else if (activeTab === 'contact') {
      setActiveTab('basic');
    }
  };

  // Convert yyyy/mm/dd or yyyy-MM-dd to MM/DD/YYYY format for display
  const formatDateForDisplay = (dateStr: string): string => {
    if (!dateStr) return '';
    try {
      // Handle both yyyy/mm/dd and yyyy-MM-dd formats
      const normalizedDate = dateStr.replace(/\//g, '-');
      const date = new Date(normalizedDate);
      if (isNaN(date.getTime())) return '';
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const year = date.getFullYear();
      return `${month}/${day}/${year}`;
    } catch {
      return '';
    }
  };

  // Convert MM/DD/YYYY to yyyy-MM-dd format for API
  const convertDateToAPIFormat = (dateStr: string): string => {
    if (!dateStr) return '';
    const parts = dateStr.split('/').filter(Boolean);
    if (parts.length === 3) {
      const month = parts[0].padStart(2, '0');
      const day = parts[1].padStart(2, '0');
      const year = parts[2];
      if (month.length === 2 && day.length === 2 && year.length === 4) {
        return `${year}-${month}-${day}`;
      }
    }
    return '';
  };

  // Handle DOB input with auto-formatting
  const handleDobInputChange = (value: string) => {
    // Remove all non-digit characters
    const digitsOnly = value.replace(/\D/g, '');
    
    // Limit to 8 digits (MMDDYYYY)
    const limitedDigits = digitsOnly.slice(0, 8);
    
    let formatted = '';
    if (limitedDigits.length > 0) {
      // Add month (first 2 digits)
      formatted = limitedDigits.slice(0, 2);
      if (limitedDigits.length > 2) {
        // Add separator and day (next 2 digits)
        formatted += '/' + limitedDigits.slice(2, 4);
        if (limitedDigits.length > 4) {
          // Add separator and year (remaining digits)
          formatted += '/' + limitedDigits.slice(4, 8);
        }
      }
    }
    
    setDobDisplayValue(formatted);
    
    // Convert to API format and update customerData
    const apiFormat = convertDateToAPIFormat(formatted);
    if (apiFormat) {
      handleInputChange('dateOfBirth', apiFormat);
      handleInputChange('dob', apiFormat);
    } else {
      handleInputChange('dateOfBirth', '');
      handleInputChange('dob', '');
    }
  };

  // Sync DOB display value when modal opens or existingData changes
  useEffect(() => {
    if (isOpen) {
      if (existingData?.dateOfBirth || existingData?.dob) {
        const displayValue = formatDateForDisplay(existingData.dateOfBirth || existingData.dob || '');
        setDobDisplayValue(displayValue);
      } else if (customerData?.dateOfBirth || customerData?.dob) {
        const displayValue = formatDateForDisplay(customerData.dateOfBirth || customerData.dob || '');
        setDobDisplayValue(displayValue);
      } else {
        setDobDisplayValue('');
      }
    }
  }, [isOpen, existingData]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Add Customer</DialogTitle>
          <DialogDescription>Enter the details of the new customer.</DialogDescription>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList>
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="contact">Contact</TabsTrigger>
            <TabsTrigger value="address">Address</TabsTrigger>
            <TabsTrigger value="additional">Additional</TabsTrigger>
          </TabsList>
          <TabsContent value="basic" className="mt-4">
            <div className="grid gap-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="customer-storeName" className="text-right">
                  Shop Name
                </Label>
                <Input id="customer-storeName" autoComplete="off" value={customerData.storeName || ''} className="col-span-3" onChange={(e) => handleInputChange('storeName', e.target.value)} />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="clientFirstName" className="text-right">
                  First Name
                </Label>
                <Input id="clientFirstName" value={customerData.clientFirstName || ''} className="col-span-3" onChange={(e) => handleInputChange('clientFirstName', e.target.value)} />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="clientLastName" className="text-right">
                  Last Name
                </Label>
                <Input id="clientLastName" value={customerData.clientLastName || ''} className="col-span-3" onChange={(e) => handleInputChange('clientLastName', e.target.value)} />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="dateOfBirth" className="text-right">
                  Date of Birth
                </Label>
                <div className="col-span-3">
                  <Input
                    id="dateOfBirth"
                    type="text"
                    placeholder="MM/DD/YYYY"
                    value={dobDisplayValue}
                    onChange={(e) => handleDobInputChange(e.target.value)}
                    className="w-full"
                    maxLength={10}
                  />
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="fieldOfficer" className="text-right">
                  Field Officer
                </Label>
                <div className="col-span-3">
                  <Popover open={isFieldOfficerPopoverOpen} onOpenChange={setIsFieldOfficerPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-between text-left font-normal"
                        id="fieldOfficer"
                      >
                        <span className={`truncate ${selectedFieldOfficerName ? 'text-foreground' : 'text-gray-400'}`}>
                          {selectedFieldOfficerName || 'Select Field Officer'}
                        </span>
                        <Search className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[320px] p-0" align="start">
                      <div className="p-3 border-b">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            placeholder="Search field officer..."
                            value={fieldOfficerSearchTerm}
                            onChange={(event) => setFieldOfficerSearchTerm(event.target.value)}
                            className="pl-9"
                          />
                        </div>
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                        {filteredFieldOfficers.length === 0 ? (
                          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                            {fieldOfficerOptions.length === 0 ? 'No field officers available' : 'No matches found'}
                          </div>
                        ) : (
                          filteredFieldOfficers.map((officer) => {
                            const isSelected = officer.id === customerData.fieldOfficerId;
                            return (
                              <button
                                key={officer.id}
                                type="button"
                                className={`flex w-full items-center justify-between px-4 py-2 text-sm ${
                                  isSelected ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-muted/40'
                                }`}
                                onClick={() => handleFieldOfficerSelect(officer.id)}
                              >
                                <span className="truncate text-left">{officer.name}</span>
                                {isSelected && <Check className="h-4 w-4 text-primary" />}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                  <p className="mt-1 text-xs text-muted-foreground">
                    The selected officer&apos;s location will prefill the Address step.
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="contact" className="mt-4">
            <div className="grid gap-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="primaryContact" className="text-right">
                  Primary Contact
                </Label>
                <div className="col-span-3">
                  <Input 
                    id="primaryContact" 
                    type="tel" 
                    value={customerData.primaryContact || ''} 
                    className={primaryContactError ? 'border-red-500' : ''}
                    onChange={(e) => handleInputChange('primaryContact', e.target.value)} 
                  />
                  {primaryContactError && (
                    <p className="text-sm text-red-600 mt-1">{primaryContactError}</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="secondaryContact" className="text-right">
                  Secondary Contact
                </Label>
                <div className="col-span-3">
                  <Input 
                    id="secondaryContact" 
                    type="tel" 
                    value={customerData.secondaryContact || ''} 
                    className={secondaryContactError ? 'border-red-500' : ''}
                    onChange={(e) => handleInputChange('secondaryContact', e.target.value)} 
                  />
                  {secondaryContactError && (
                    <p className="text-sm text-red-600 mt-1">{secondaryContactError}</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="email" className="text-right">
                  Email
                </Label>
                <Input id="email" type="email" value={customerData.email || ''} className="col-span-3" onChange={(e) => handleInputChange('email', e.target.value)} />
              </div>
            </div>
          </TabsContent>
          <TabsContent value="address" className="mt-4">
            <div className="grid gap-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="customer-addressLine1" className="text-right">
                  Address Line 1
                </Label>
                <Input id="customer-addressLine1" autoComplete="street-address" value={customerData.addressLine1 || ''} className="col-span-3" onChange={(e) => handleInputChange('addressLine1', e.target.value)} />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="customer-addressLine2" className="text-right">
                  Address Line 2
                </Label>
                <Input id="customer-addressLine2" autoComplete="address-line2" value={customerData.addressLine2 || ''} className="col-span-3" onChange={(e) => handleInputChange('addressLine2', e.target.value)} />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="customer-city" className="text-right">
                  City
                </Label>
                <div className="col-span-3 space-y-2">
                  {selectedOfficerCities.length > 1 ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button id="customer-city" type="button" variant="outline" className="w-full justify-between font-normal">
                          <span className="flex min-w-0 items-center">
                            <MapPin className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="truncate">{customerData.city || 'Select assigned city'}</span>
                          </span>
                          <span className="text-xs text-muted-foreground">{selectedOfficerCities.length} options</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-[320px]" align="start">
                        {selectedOfficerCities.map((city) => (
                          <DropdownMenuItem key={city} onClick={() => applyOfficerLocation(selectedFieldOfficer, city)}>
                            {city}
                            {customerData.city?.trim().toLowerCase() === city.toLowerCase() && (
                              <Check className="ml-auto h-4 w-4" />
                            )}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : selectedOfficerCities.length === 1 ? (
                    <Button id="customer-city" type="button" variant="outline" className="w-full cursor-default justify-start font-normal" disabled>
                      <MapPin className="mr-2 h-4 w-4 text-muted-foreground" />
                      {selectedOfficerCities[0]}
                    </Button>
                  ) : selectedFieldOfficer ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          id="customer-city"
                          type="button"
                          variant="outline"
                          className="w-full justify-between font-normal"
                          disabled={isAssigningCustomerCity || assignableCities.length === 0}
                        >
                          <span className="flex min-w-0 items-center">
                            {isAssigningCustomerCity
                              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              : <MapPin className="mr-2 h-4 w-4 text-muted-foreground" />}
                            <span className="truncate">Assign a city to this Field Officer</span>
                          </span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="max-h-64 w-[320px] overflow-y-auto" align="start">
                        {assignableCities.map((city) => (
                          <DropdownMenuItem key={city} onClick={() => handleAssignCustomerCity(city)}>
                            Assign and use {city}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <Button id="customer-city" type="button" variant="outline" className="w-full justify-start font-normal" disabled>
                      Select a Field Officer first
                    </Button>
                  )}
                  {selectedFieldOfficer && selectedOfficerCities.length === 0 && (
                    <p className="text-xs text-amber-600">
                      No sales city is assigned. Choose an available city above to assign and use it.
                    </p>
                  )}
                  {cityAssignmentError && (
                    <p className="text-xs text-destructive">{cityAssignmentError}</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="customer-state" className="text-right">
                  State
                </Label>
                <div className="col-span-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button id="customer-state" type="button" variant="outline" className="w-full justify-start font-normal">
                        {customerData.state || 'Select state'}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="max-h-64 w-[320px] overflow-y-auto" align="start">
                      {stateOptions.map((state) => (
                        <DropdownMenuItem key={state} onClick={() => handleCustomerStateChange(state)}>
                          {state}
                          {customerData.state?.toLowerCase() === state.toLowerCase() && <Check className="ml-auto h-4 w-4" />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="customer-district" className="text-right">
                  District
                </Label>
                <div className="col-span-3">
                  <Popover open={isDistrictPopoverOpen} onOpenChange={(open) => {
                    setIsDistrictPopoverOpen(open);
                    if (!open) setDistrictSearchTerm('');
                  }}>
                    <PopoverTrigger asChild>
                      <Button
                        id="customer-district"
                        type="button"
                        variant="outline"
                        className="w-full justify-between font-normal"
                        disabled={!customerData.state?.trim() || districtOptions.length === 0}
                      >
                        <span className={customerData.district ? '' : 'text-muted-foreground'}>
                          {customerData.district || (customerData.state?.trim() ? 'Select district' : 'Select state first')}
                        </span>
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      side="bottom"
                      collisionPadding={16}
                      className="p-0 shadow-xl"
                      style={{ width: 'var(--radix-popover-trigger-width)' }}
                    >
                      <div className="border-b p-2">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            autoFocus
                            value={districtSearchTerm}
                            onChange={(event) => setDistrictSearchTerm(event.target.value)}
                            placeholder={`Search ${customerData.state || ''} districts...`}
                            className="h-9 pl-9"
                          />
                        </div>
                      </div>
                      <div className="max-h-56 overflow-y-auto overscroll-contain p-1">
                        {filteredDistrictOptions.length === 0 ? (
                          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                            No districts match your search
                          </div>
                        ) : (
                          filteredDistrictOptions.map((district) => {
                            const isSelected = customerData.district === district;
                            return (
                              <button
                                key={district}
                                type="button"
                                className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors ${
                                  isSelected ? 'bg-primary/10 font-medium text-primary' : 'hover:bg-muted'
                                }`}
                                onClick={() => {
                                  handleInputChange('district', district);
                                  setIsDistrictPopoverOpen(false);
                                  setDistrictSearchTerm('');
                                }}
                              >
                                <span className="truncate">{district}</span>
                                {isSelected && <Check className="ml-2 h-4 w-4 shrink-0" />}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="customer-country" className="text-right">
                  Country
                </Label>
                <Input id="customer-country" autoComplete="country" value={customerData.country || ''} className="col-span-3" onChange={(e) => handleInputChange('country', e.target.value)} />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="customer-pincode" className="text-right">
                  Pincode
                </Label>
                <Input id="customer-pincode" type="number" autoComplete="postal-code" value={customerData.pincode || ''} className="col-span-3" onChange={(e) => handleInputChange('pincode', e.target.value)} />
              </div>
            </div>
          </TabsContent>
          <TabsContent value="additional" className="mt-4">
            <div className="grid gap-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="gstNumber" className="text-right">
                  GST Number
                </Label>
                <Input id="gstNumber" value={customerData.gstNumber || ''} className="col-span-3" onChange={(e) => handleInputChange('gstNumber', e.target.value)} />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="monthlySale" className="text-right">
                  Monthly Sale
                </Label>
                <Input id="monthlySale" type="number" value={customerData.monthlySale || ''} className="col-span-3" onChange={(e) => handleInputChange('monthlySale', e.target.value)} />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="yearOfJoining" className="text-right">
                  Year of Joining
                </Label>
                <div className="col-span-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button id="yearOfJoining" type="button" variant="outline" className="w-full justify-start font-normal">
                        {customerData.yearOfJoining || 'Select year'}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="max-h-64 overflow-y-auto" align="start">
                      {joiningYearOptions.map((year) => (
                        <DropdownMenuItem key={year} onClick={() => handleInputChange('yearOfJoining', year)}>
                          {year}
                          {customerData.yearOfJoining === year && <Check className="ml-auto h-4 w-4" />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="clientType" className="text-right">
                  Client Type
                </Label>
                <div className="col-span-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger className="w-full">
                      <Input
                        id="customer-clientType"
                        autoComplete="off"
                        value={customerData.clientType || ''}
                        placeholder="Select Client Type"
                        readOnly
                        className="cursor-pointer text-gray-400"
                      />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => handleInputChange('clientType', 'Project')}>Project</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleInputChange('clientType', 'Shop')}>Shop</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {activeTab !== 'basic' && (
            <Button variant="outline" onClick={handlePrevious}>
              Previous
            </Button>
          )}
          {activeTab !== 'additional' ? (
            <Button onClick={handleNext}>Next</Button>
          ) : (
            <Button 
              onClick={handleSubmit}
              disabled={!!primaryContactError || !!secondaryContactError}
            >
              Add Customer
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddCustomerModal;
