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
import { Search, Check } from 'lucide-react';

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
  country?: string;
  pincode?: string | number;
  gstNumber?: string;
  monthlySale?: string | number;
  clientType?: string;
  fieldOfficerId?: number;
  dateOfBirth?: string;
  dob?: string;
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

  const fieldOfficerOptions = useMemo(() => {
    return employees.map((employee) => ({
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

  const handleFieldOfficerSelect = (id: number) => {
    handleInputChange('fieldOfficerId', id);
    setFieldOfficerSearchTerm('');
    setIsFieldOfficerPopoverOpen(false);
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

  const handleInputChange = (field: keyof CustomerData, value: string | number) => {
    let parsedValue: string | number = value;
    const numberFields: (keyof CustomerData)[] = ['pincode', 'monthlySale', 'primaryContact', 'secondaryContact', 'fieldOfficerId'];
    
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
      
      const { dateOfBirth: _ignoreDateOfBirth, dob: _ignoreDob, ...restCustomerData } = customerData;
      
      const requestBody = {
        ...restCustomerData,
        primaryContact: customerData.primaryContact ? parseInt(customerData.primaryContact.toString(), 10) : undefined,
        secondaryContact: customerData.secondaryContact ? parseInt(customerData.secondaryContact.toString(), 10) : undefined,
        pincode: customerData.pincode ? parseInt(customerData.pincode.toString(), 10) : undefined,
        monthlySale: customerData.monthlySale ? parseInt(customerData.monthlySale.toString(), 10) : undefined,
        latitude: 10.0,
        longitude: -23.0,
        employeeId: customerData.fieldOfficerId, // Use selected field officer's ID
        dob: formattedDob || undefined,
      };

      console.log('requestBody', requestBody)
      const url = existingData && existingData.id
        ? `/api/proxy/store/update?id=${existingData.id}`
        : '/api/proxy/store/create';
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
                <Input id="customer-city" autoComplete="address-level2" value={customerData.city || ''} className="col-span-3" onChange={(e) => handleInputChange('city', e.target.value)} />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="customer-state" className="text-right">
                  State
                </Label>
                <Input id="customer-state" autoComplete="address-level1" value={customerData.state || ''} className="col-span-3" onChange={(e) => handleInputChange('state', e.target.value)} />
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
