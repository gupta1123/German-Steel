"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { API, type ClientTypeDto, type EmployeeUserDto, type LocationMasterDto } from '@/lib/api';
import { getApiErrorMessage, getErrorMessage } from '@/lib/api-error';
import { isManagerRoleValue } from '@/lib/auth';
import { getUniqueFieldOfficersFromTeams } from '@/lib/team-access';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertCircle, Search, Check, Loader2, ChevronDown } from 'lucide-react';
import { useUnsavedChanges } from '@/components/unsaved-changes-provider';

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

interface SearchableSelectOption {
  id: number;
  name: string;
}

interface SearchableSelectProps<T extends SearchableSelectOption> {
  id: string;
  value?: string;
  options: T[];
  placeholder: string;
  searchPlaceholder: string;
  emptyMessage: string;
  loadingLabel: string;
  loading?: boolean;
  disabled?: boolean;
  onSelect: (option: T) => void;
}

const SearchableSelect = <T extends SearchableSelectOption,>({
  id,
  value,
  options,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  loadingLabel,
  loading = false,
  disabled = false,
  onSelect,
}: SearchableSelectProps<T>) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const filteredOptions = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return options;
    return options.filter((option) => option.name.toLowerCase().includes(query));
  }, [options, searchTerm]);

  const isDisabled = disabled || loading;

  return (
    <Popover open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (!open) setSearchTerm('');
    }}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className="w-full justify-between font-normal"
          disabled={isDisabled}
        >
          <span className={`truncate ${value ? '' : 'text-muted-foreground'}`}>
            {loading ? loadingLabel : value || placeholder}
          </span>
          {loading
            ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
            : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        portalled={false}
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
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-9 pl-9"
            />
          </div>
        </div>
        <div className="max-h-56 overflow-y-auto overscroll-contain p-1">
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </div>
          ) : (
            filteredOptions.map((option) => {
              const isSelected = value?.trim().toLowerCase() === option.name.trim().toLowerCase();
              return (
                <button
                  key={option.id}
                  type="button"
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    isSelected ? 'bg-primary/10 font-medium text-primary' : 'hover:bg-muted'
                  }`}
                  onClick={() => {
                    onSelect(option);
                    setIsOpen(false);
                    setSearchTerm('');
                  }}
                >
                  <span className="truncate">{option.name}</span>
                  {isSelected && <Check className="ml-2 h-4 w-4 shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

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
      country: 'India',
    }
  );
  const [activeTab, setActiveTab] = useState<string>('basic');
  const [employees, setEmployees] = useState<EmployeeUserDto[]>([]);
  const [isFieldOfficerPopoverOpen, setIsFieldOfficerPopoverOpen] = useState(false);
  const [fieldOfficerSearchTerm, setFieldOfficerSearchTerm] = useState("");
  const [dobDisplayValue, setDobDisplayValue] = useState<string>('');
  const [locationStates, setLocationStates] = useState<LocationMasterDto[]>([]);
  const [locationDistricts, setLocationDistricts] = useState<LocationMasterDto[]>([]);
  const [locationCities, setLocationCities] = useState<LocationMasterDto[]>([]);
  const [selectedStateId, setSelectedStateId] = useState<number | null>(null);
  const [selectedDistrictId, setSelectedDistrictId] = useState<number | null>(null);
  const [isLoadingStates, setIsLoadingStates] = useState(false);
  const [isLoadingDistricts, setIsLoadingDistricts] = useState(false);
  const [isLoadingCities, setIsLoadingCities] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [clientTypes, setClientTypes] = useState<ClientTypeDto[]>([]);
  const [isLoadingClientTypes, setIsLoadingClientTypes] = useState(false);
  const [clientTypeError, setClientTypeError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasUserChanges, setHasUserChanges] = useState(false);
  const { markSaved, requestDiscard } = useUnsavedChanges(isOpen && hasUserChanges);

  const primaryContactDigits = String(customerData.primaryContact ?? '').replace(/\D/g, '');
  const secondaryContactDigits = String(customerData.secondaryContact ?? '').replace(/\D/g, '');
  const primaryContactError = primaryContactDigits.length > 0 && primaryContactDigits.length !== 10
    ? 'Primary contact must be exactly 10 digits'
    : null;
  const secondaryContactError = secondaryContactDigits.length > 0 && secondaryContactDigits.length !== 10
    ? 'Secondary contact must be exactly 10 digits'
    : null;

  const fieldOfficerOptions = useMemo(() => {
    return employees
      .filter((employee) => employee.role?.trim().toLowerCase() === 'field officer')
      .map((employee) => ({
        id: employee.id,
        name: [employee.firstName, employee.lastName].filter(Boolean).join(' ').trim(),
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

  const joiningYearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 76 }, (_, index) => {
      const year = currentYear - index;
      return { id: year, name: String(year) };
    });
  }, []);

  const clientTypeOptions = useMemo(() => {
    const uniqueTypes = new Map<string, ClientTypeDto>();

    clientTypes.forEach((clientType) => {
      const type = clientType.type?.trim();
      if (!type) return;

      const normalizedType = type.toLowerCase();
      if (!uniqueTypes.has(normalizedType)) {
        uniqueTypes.set(normalizedType, { ...clientType, type });
      }
    });

    return Array.from(uniqueTypes.values());
  }, [clientTypes]);

  const clientTypeSelectOptions = useMemo(() => {
    return clientTypeOptions.flatMap((clientType) => {
      const type = clientType.type;
      return type ? [{ id: clientType.id, name: type }] : [];
    });
  }, [clientTypeOptions]);

  const handleCustomerStateChange = (state: LocationMasterDto) => {
    setHasUserChanges(true);
    setSelectedStateId(state.id);
    setSelectedDistrictId(null);
    setLocationDistricts([]);
    setLocationCities([]);
    setCustomerData((previous) => ({
      ...previous,
      state: state.name,
      district: '',
      city: '',
    }));
  };

  const handleCustomerDistrictChange = (district: LocationMasterDto) => {
    setHasUserChanges(true);
    setSelectedDistrictId(district.id);
    setLocationCities([]);
    setCustomerData((previous) => ({
      ...previous,
      district: district.name,
      city: '',
    }));
  };

  const handleCustomerCityChange = (city: LocationMasterDto) => {
    setHasUserChanges(true);
    setCustomerData((previous) => ({
      ...previous,
      city: city.name,
    }));
  };

  const handleFieldOfficerSelect = (id: number) => {
    setHasUserChanges(true);
    setCustomerData((previous) => ({
      ...previous,
      fieldOfficerId: id,
    }));
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

    setCustomerData((previous) => ({
      ...previous,
      fieldOfficerId: employeeId,
    }));
  }, [isOpen, existingData?.id, employeeId, fieldOfficerOptions, customerData.fieldOfficerId]);

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
    setCustomerData(existingData ? { ...existingData } : {
      clientFirstName: '',
      clientLastName: '',
      email: '',
      dateOfBirth: '',
      dob: '',
      country: 'India',
    });
    setActiveTab('basic');
    setSelectedStateId(null);
    setSelectedDistrictId(null);
    setLocationDistricts([]);
    setLocationCities([]);
    setLocationError(null);
    setSubmitError(null);
    setIsSubmitting(false);
    setHasUserChanges(false);
    setFieldOfficerSearchTerm('');
    setIsFieldOfficerPopoverOpen(false);
  }, [isOpen, existingData]);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setIsLoadingStates(true);
    setLocationError(null);

    API.getLocationStates()
      .then((states) => {
        if (cancelled) return;
        setLocationStates([...states].sort((left, right) => left.name.localeCompare(right.name)));
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Failed to load location states:', error);
        setLocationStates([]);
        setLocationError('Unable to load states. Please close this form and try again.');
      })
      .finally(() => {
        if (!cancelled) setIsLoadingStates(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setIsLoadingClientTypes(true);
    setClientTypeError(null);

    API.getClientTypes()
      .then((types) => {
        if (!cancelled) setClientTypes(types);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Failed to load client types:', error);
        setClientTypes([]);
        setClientTypeError('Unable to load client types.');
      })
      .finally(() => {
        if (!cancelled) setIsLoadingClientTypes(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || selectedStateId !== null || !customerData.state?.trim()) return;
    const state = locationStates.find(
      (option) => option.name.trim().toLowerCase() === customerData.state?.trim().toLowerCase()
    );
    if (state) setSelectedStateId(state.id);
  }, [isOpen, locationStates, selectedStateId, customerData.state]);

  useEffect(() => {
    if (!isOpen || selectedStateId === null) {
      setLocationDistricts([]);
      setIsLoadingDistricts(false);
      return;
    }

    let cancelled = false;
    setIsLoadingDistricts(true);
    setLocationError(null);

    API.getLocationDistricts(selectedStateId)
      .then((districts) => {
        if (cancelled) return;
        setLocationDistricts([...districts].sort((left, right) => left.name.localeCompare(right.name)));
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Failed to load location districts:', error);
        setLocationDistricts([]);
        setLocationError('Unable to load districts for the selected state.');
      })
      .finally(() => {
        if (!cancelled) setIsLoadingDistricts(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, selectedStateId]);

  useEffect(() => {
    if (
      !isOpen ||
      selectedStateId === null ||
      selectedDistrictId !== null ||
      !customerData.district?.trim()
    ) {
      return;
    }

    const district = locationDistricts.find(
      (option) => option.name.trim().toLowerCase() === customerData.district?.trim().toLowerCase()
    );
    if (district) setSelectedDistrictId(district.id);
  }, [isOpen, locationDistricts, selectedStateId, selectedDistrictId, customerData.district]);

  useEffect(() => {
    if (!isOpen || selectedDistrictId === null) {
      setLocationCities([]);
      setIsLoadingCities(false);
      return;
    }

    let cancelled = false;
    setIsLoadingCities(true);
    setLocationError(null);

    API.getLocationCities(selectedDistrictId)
      .then((cities) => {
        if (cancelled) return;
        setLocationCities([...cities].sort((left, right) => left.name.localeCompare(right.name)));
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Failed to load location cities:', error);
        setLocationCities([]);
        setLocationError('Unable to load cities for the selected district.');
      })
      .finally(() => {
        if (!cancelled) setIsLoadingCities(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, selectedDistrictId]);

  const handleInputChange = (field: keyof CustomerData, value: string | number) => {
    setHasUserChanges(true);
    setSubmitError(null);
    let parsedValue: string | number = value;
    const numberFields: (keyof CustomerData)[] = ['pincode', 'monthlySale', 'fieldOfficerId', 'yearOfJoining'];
    
    // Validate contact fields
    if (field === 'primaryContact') {
      // Keep contact values as strings while editing so leading zeroes and the
      // validation state always match what the user sees in the input.
      parsedValue = value.toString().replace(/\D/g, '').slice(0, 10);
    } else if (field === 'secondaryContact') {
      parsedValue = value.toString().replace(/\D/g, '').slice(0, 10);
    } else if (numberFields.includes(field)) {
      parsedValue = value === '' ? '' : parseInt(value.toString(), 10);
    }

    setCustomerData((prevData) => ({
      ...prevData,
      [field]: parsedValue,
    }));
  };

  const handleSubmit = async () => {
    if (isSubmitting || primaryContactError || secondaryContactError) {
      if (primaryContactError || secondaryContactError) setActiveTab('contact');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

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
        country: customerData.country || 'India',
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

      if (response.ok) {
        setHasUserChanges(false);
        markSaved();
        onClose(); // Close the modal after successful submission
        if (onCustomerAdded) {
          onCustomerAdded(); // Refresh the customers list
        }
      } else {
        setSubmitError(
          await getApiErrorMessage(
            response,
            existingData?.id ? 'Unable to update customer.' : 'Unable to create customer.'
          )
        );
      }
    } catch (error) {
      console.error('Error updating/creating customer:', error);
      setSubmitError(
        getErrorMessage(
          error,
          existingData?.id ? 'Unable to update customer.' : 'Unable to create customer.'
        )
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseRequest = () => {
    requestDiscard(() => {
      setHasUserChanges(false);
      markSaved();
      onClose();
    });
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
    if (!isOpen) return;
    const dateValue = existingData?.dateOfBirth || existingData?.dob || '';
    setDobDisplayValue(formatDateForDisplay(dateValue));
  }, [isOpen, existingData]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) handleCloseRequest();
    }}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Add Customer</DialogTitle>
          <DialogDescription>Enter the details of the new customer.</DialogDescription>
        </DialogHeader>
        {submitError && (
          <div
            role="alert"
            aria-live="assertive"
            className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}
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
                    inputMode="numeric"
                    maxLength={10}
                    value={customerData.primaryContact ?? ''}
                    className={primaryContactError ? 'border-red-500' : ''}
                    aria-invalid={!!primaryContactError}
                    aria-describedby={primaryContactError ? 'primaryContact-error' : undefined}
                    onChange={(e) => handleInputChange('primaryContact', e.target.value)} 
                  />
                  {primaryContactError && (
                    <p id="primaryContact-error" className="text-sm text-red-600 mt-1">{primaryContactError}</p>
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
                    inputMode="numeric"
                    maxLength={10}
                    value={customerData.secondaryContact ?? ''}
                    className={secondaryContactError ? 'border-red-500' : ''}
                    aria-invalid={!!secondaryContactError}
                    aria-describedby={secondaryContactError ? 'secondaryContact-error' : undefined}
                    onChange={(e) => handleInputChange('secondaryContact', e.target.value)} 
                  />
                  {secondaryContactError && (
                    <p id="secondaryContact-error" className="text-sm text-red-600 mt-1">{secondaryContactError}</p>
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
                <Label htmlFor="customer-country" className="text-right">
                  Country
                </Label>
                <Input
                  id="customer-country"
                  autoComplete="country"
                  value={customerData.country || 'India'}
                  className="col-span-3 bg-muted/50 text-foreground"
                  readOnly
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="customer-state" className="text-right">
                  State
                </Label>
                <div className="col-span-3">
                  <SearchableSelect
                    id="customer-state"
                    value={customerData.state}
                    options={locationStates}
                    placeholder="Select state"
                    searchPlaceholder="Search states..."
                    emptyMessage="No states available"
                    loadingLabel="Loading states..."
                    loading={isLoadingStates}
                    onSelect={handleCustomerStateChange}
                  />
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="customer-district" className="text-right">
                  District
                </Label>
                <div className="col-span-3">
                  <SearchableSelect
                    id="customer-district"
                    value={customerData.district}
                    options={locationDistricts}
                    placeholder={selectedStateId === null ? 'Select state first' : 'Select district'}
                    searchPlaceholder="Search districts..."
                    emptyMessage="No districts available"
                    loadingLabel="Loading districts..."
                    loading={isLoadingDistricts}
                    disabled={selectedStateId === null}
                    onSelect={handleCustomerDistrictChange}
                  />
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="customer-city" className="text-right">
                  City
                </Label>
                <div className="col-span-3">
                  <SearchableSelect
                    id="customer-city"
                    value={customerData.city}
                    options={locationCities}
                    placeholder={selectedDistrictId === null ? 'Select district first' : 'Select city'}
                    searchPlaceholder="Search cities..."
                    emptyMessage="No cities available"
                    loadingLabel="Loading cities..."
                    loading={isLoadingCities}
                    disabled={selectedDistrictId === null}
                    onSelect={handleCustomerCityChange}
                  />
                </div>
              </div>
              {locationError && (
                <div className="grid grid-cols-4 gap-4">
                  <p role="alert" className="col-span-3 col-start-2 text-sm text-destructive">
                    {locationError}
                  </p>
                </div>
              )}
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
                  <SearchableSelect
                    id="yearOfJoining"
                    value={customerData.yearOfJoining ? String(customerData.yearOfJoining) : ''}
                    options={joiningYearOptions}
                    placeholder="Select year"
                    searchPlaceholder="Search years..."
                    emptyMessage="No matching year"
                    loadingLabel="Loading years..."
                    onSelect={(option) => handleInputChange('yearOfJoining', Number(option.name))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="clientType" className="text-right">
                  Client Type
                </Label>
                <div className="col-span-3">
                  <SearchableSelect
                    id="customer-clientType"
                    value={customerData.clientType}
                    options={clientTypeSelectOptions}
                    placeholder="Select client type"
                    searchPlaceholder="Search client types..."
                    emptyMessage={clientTypeError || 'No client types available'}
                    loadingLabel="Loading client types..."
                    loading={isLoadingClientTypes}
                    onSelect={(option) => handleInputChange('clientType', option.name)}
                  />
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button variant="outline" onClick={handleCloseRequest}>
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
              disabled={isSubmitting || !!primaryContactError || !!secondaryContactError}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {existingData?.id ? 'Save Changes' : 'Add Customer'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddCustomerModal;
