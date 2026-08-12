'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { useAuth } from '@/components/auth-provider';
import { isManagerRoleValue, normalizeRoleValue } from '@/lib/auth';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Loader, CalendarIcon } from "lucide-react";
import { API, type TeamDataDto } from "@/lib/api";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SpacedCalendar } from "@/components/ui/spaced-calendar";
import { getTeamIds } from "@/lib/team-access";

interface Brand {
    id: number;
    brandName: string;
    price: number;
    city: string;
    state: string;
    employeeDto: {
        id: number;
        firstName: string;
        lastName: string;
        city: string;
    };
    metric: string;
    createdAt: string;
    updatedAt: string;
}

const PricingPage = () => {
    const [brandData, setBrandData] = useState<Brand[]>([]);
    const [previousDayData, setPreviousDayData] = useState<Brand[]>([]);
    const [selectedCity, setSelectedCity] = useState('');
    const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [cities, setCities] = useState<string[]>([]);
    const [germanSteelsRate, setGermanSteelsRate] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [showGermanSteelsRate, setShowGermanSteelsRate] = useState(false);
    const [fieldOfficers, setFieldOfficers] = useState<string[]>([]);
    const [selectedFieldOfficer, setSelectedFieldOfficer] = useState("all");
    const [teamIds, setTeamIds] = useState<number[]>([]);
    const [teamLoading, setTeamLoading] = useState(false);
    const [teamError, setTeamError] = useState<string | null>(null);

    const { token, userRole, currentUser, userData } = useAuth();
    
    // State for role checking
    const [isManager, setIsManager] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isFieldOfficer, setIsFieldOfficer] = useState(false);
    const [userRoleFromAPI, setUserRoleFromAPI] = useState<string | null>(null);
    const [isRoleDetermined, setIsRoleDetermined] = useState(false);

    // Fetch current user data to determine role
    useEffect(() => {
        const fetchCurrentUser = async () => {
            if (!token) return;
            setIsRoleDetermined(false);
            
            try {
                const response = await fetch('/api/proxy/user/manage/current-user', {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                });
                
                if (response.ok) {
                    const userData = await response.json();
                    console.log('Current user data:', userData);
                    
                    // Extract role from authorities
                    const authorities = userData.authorities || [];
                    const role = authorities.length > 0 ? authorities[0].authority : null;
                    setUserRoleFromAPI(role);

                    const normalizedRole = normalizeRoleValue(role);
                    const managerFlag = isManagerRoleValue(role);
                    const adminFlag = normalizedRole === 'ROLE_ADMIN' || normalizedRole === 'ADMIN';
                    const fieldOfficerFlag = normalizedRole === 'ROLE_FIELD OFFICER' || normalizedRole === 'FIELD OFFICER';

                    // Set role flags
                    setIsManager(managerFlag);
                    setIsAdmin(adminFlag);
                    setIsFieldOfficer(fieldOfficerFlag);

                    console.log('Role from API:', role);
                    console.log('isManager:', managerFlag);
                    console.log('isAdmin:', adminFlag);
                    console.log('isFieldOfficer:', fieldOfficerFlag);
                } else {
                    console.error('Failed to fetch current user data');
                }
            } catch (error) {
                console.error('Error fetching current user:', error);
            } finally {
                setIsRoleDetermined(true);
            }
        };

        fetchCurrentUser();
    }, [token]);

    // Fetch team data for managers and field officers
    useEffect(() => {
        const loadTeamData = async () => {
            if ((!isManager && !isFieldOfficer) || !userData?.employeeId) return;
            
            setTeamLoading(true);
            setTeamError(null);
            
            try {
                const teamData: TeamDataDto[] = await API.getTeamByEmployee(userData.employeeId);
                
                if (teamData.length > 0) {
                    const accessibleTeamIds = getTeamIds(teamData);
                    setTeamIds(accessibleTeamIds);
                } else {
                    setTeamError('No team data found for this user');
                    setTeamIds([]);
                }
            } catch (err) {
                console.error('Failed to load team data:', err);
                setTeamError('Failed to load team data');
                setTeamIds([]);
            } finally {
                setTeamLoading(false);
            }
        };

        loadTeamData();
    }, [isManager, isFieldOfficer, userData?.employeeId]);

    useEffect(() => {
        if (!isRoleDetermined) return;
        fetchData();
    }, [selectedCity, selectedDate, teamIds, isRoleDetermined, isAdmin, isManager, isFieldOfficer]);

    const fetchData = async () => {
        if (!isRoleDetermined) return;
        setIsLoading(true);
        await Promise.all([fetchBrandData(), fetchPreviousDayData()]);
        setIsLoading(false);
    };

    const fetchBrandData = useCallback(async () => {
        if (!token) return;
        if ((isManager || isFieldOfficer) && teamIds.length === 0) return;
        
        try {
            const formattedStartDate = format(new Date(selectedDate), 'yyyy-MM-dd');
            const formattedEndDate = format(new Date(selectedDate), 'yyyy-MM-dd');

            console.log('fetchBrandData - isManager:', isManager, 'teamIds:', teamIds);

            let data: Brand[];

            if (isManager || isFieldOfficer) {
                const responses = await Promise.all(teamIds.map(async (id) => {
                    const url = `/api/proxy/brand/getByTeamAndDate?id=${id}&start=${formattedStartDate}&end=${formattedEndDate}`;
                    console.log('Team pricing API call:', url);
                    const response = await fetch(url, {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    });
                    return response.json() as Promise<Brand[]>;
                }));
                data = Array.from(new Map(responses.flat().map((brand) => [brand.id, brand])).values());
            } else {
                const url = `/api/proxy/brand/getByDateRange?start=${formattedStartDate}&end=${formattedEndDate}`;
                console.log(isAdmin ? 'Admin API call:' : 'Default (Admin) API call:', url);
                const response = await fetch(url, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });
                data = await response.json();
            }

            setBrandData(data);

            const uniqueCities = Array.from(new Set(data.map(brand =>
                brand.brandName.toLowerCase().replace(/\s+/g, '') === 'germansteels' ? brand.city : brand.employeeDto?.city
            ).filter(city => city && city.trim() !== "")));
            setCities(uniqueCities);

            if (!selectedCity && uniqueCities.length > 0) {
                setSelectedCity(uniqueCities[0]);
            }

            const uniqueFieldOfficers = Array.from(new Set(data.map(brand =>
                brand.employeeDto ? `${brand.employeeDto.firstName} ${brand.employeeDto.lastName}` : ''
            ).filter(officer => officer && officer.trim() !== "")));
            setFieldOfficers(uniqueFieldOfficers);

            const germanSteelsBrand = data.find(brand => brand.brandName.toLowerCase().replace(/\s+/g, '') === 'germansteels');
            if (germanSteelsBrand) {
                setGermanSteelsRate(germanSteelsBrand.price);
                setShowGermanSteelsRate(germanSteelsBrand.employeeDto?.firstName === 'Test' && germanSteelsBrand.employeeDto?.lastName === '1');
            } else {
                setGermanSteelsRate(0);
                setShowGermanSteelsRate(false);
            }
        } catch (error) {
            console.error('Error fetching brand data:', error);
            setBrandData([]);
            setGermanSteelsRate(0);
            setShowGermanSteelsRate(false);
        }
    }, [selectedDate, token, selectedCity, isAdmin, isManager, isFieldOfficer, teamIds]);

    const fetchPreviousDayData = useCallback(async () => {
        if (!token) return;
        if ((isManager || isFieldOfficer) && teamIds.length === 0) return;
        
        const previousDay = format(new Date(new Date(selectedDate).getTime() - 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
        try {
            let data: Brand[];

            if (isManager || isFieldOfficer) {
                const responses = await Promise.all(teamIds.map(async (id) => {
                    const url = `/api/proxy/brand/getByTeamAndDate?id=${id}&start=${previousDay}&end=${previousDay}`;
                    console.log('Team Previous Day API call:', url);
                    const response = await fetch(url, {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    });
                    return response.json() as Promise<Brand[]>;
                }));
                data = Array.from(new Map(responses.flat().map((brand) => [brand.id, brand])).values());
            } else {
                const url = `/api/proxy/brand/getByDateRange?start=${previousDay}&end=${previousDay}`;
                console.log(isAdmin ? 'Admin Previous Day API call:' : 'Default (Admin) Previous Day API call:', url);
                const response = await fetch(url, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });
                data = await response.json();
            }

            setPreviousDayData(data);
        } catch (error) {
            console.error('Error fetching previous day data:', error);
            setPreviousDayData([]);
        }
    }, [selectedDate, token, isAdmin, isManager, isFieldOfficer, teamIds]);

    const filteredBrands = brandData.filter(brand => {
        const cityMatch = selectedCity === "all" || (brand.brandName.toLowerCase().replace(/\s+/g, '') === 'germansteels' ? brand.city === selectedCity : brand.employeeDto?.city === selectedCity);
        const officerMatch = selectedFieldOfficer === "all" || (brand.employeeDto ? `${brand.employeeDto.firstName} ${brand.employeeDto.lastName}` === selectedFieldOfficer : false);
        return cityMatch && officerMatch;
    });

    // Group brands and consolidate GermanSteels entries
    const brandGroups = filteredBrands.reduce((acc, brand) => {
        const brandName = brand.brandName.toLowerCase();
        
        if (brandName.replace(/\s+/g, '') === 'germansteels') {
            // Consolidate all GermanSteels entries
            if (!acc['German Steels']) {
                acc['German Steels'] = {
                    brand: 'German Steels',
                    ourPrice: germanSteelsRate > 0 ? germanSteelsRate : brand.price,
                    competitorPrice: 0,
                    count: 1
                };
            } else {
                acc['German Steels'].count += 1;
                // Use the latest price if germanSteelsRate is not set
                if (germanSteelsRate === 0) {
                    acc['German Steels'].ourPrice = brand.price;
                }
            }
        } else {
            // Keep other brands separate
            if (!acc[brand.brandName]) {
                acc[brand.brandName] = {
                    brand: brand.brandName,
                    ourPrice: 0,
                    competitorPrice: brand.price,
                    count: 1
                };
            } else {
                acc[brand.brandName].count += 1;
                // Use average price for multiple entries of same brand
                acc[brand.brandName].competitorPrice = 
                    (acc[brand.brandName].competitorPrice * (acc[brand.brandName].count - 1) + brand.price) / acc[brand.brandName].count;
            }
        }
        
        return acc;
    }, {} as Record<string, { brand: string; ourPrice: number; competitorPrice: number; count: number }>);

    const chartData = Object.values(brandGroups)
        .map((item: Record<string, unknown>) => ({
            brand: item.brand as string,
            ourPrice: item.ourPrice as number,
            competitorPrice: item.competitorPrice as number
        }))
        .sort((a, b) => {
            // GermanSteels always comes first
            if (a.brand.toLowerCase().replace(/\s+/g, '') === 'germansteels') return -1;
            if (b.brand.toLowerCase().replace(/\s+/g, '') === 'germansteels') return 1;
            
            // Sort other brands alphabetically
            return a.brand.localeCompare(b.brand);
        });


    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>Pricing Report</CardTitle>
                            <div className="text-sm text-muted-foreground mt-1">
                                {(isManager || isFieldOfficer) && (
                                    <p>
                                        {teamLoading ? 'Loading team data...' : 
                                         teamError ? `Error: ${teamError}` :
                                         teamIds.length > 0 ? `Team-based view (Team IDs: ${teamIds.join(', ')})` : 
                                         'No team data available'}
                                    </p>
                                )}
                            </div>
                        </div>
                        {showGermanSteelsRate && germanSteelsRate > 0 && (
                            <div className="text-right">
                                <h2 className="text-2xl">
                                    German Steels Rate: <span className="font-bold">₹{germanSteelsRate}/ton</span>
                                </h2>
                            </div>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label>City</Label>
                            <Select value={selectedCity} onValueChange={setSelectedCity}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select city" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Cities</SelectItem>
                                    {cities.map((city) => (
                                        <SelectItem key={city} value={city}>
                                            {city}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        
                        <div className="space-y-2">
                            <Label>Date</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={`w-full justify-start text-left font-normal ${!selectedDate && 'text-muted-foreground'}`}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {selectedDate ? format(new Date(selectedDate), 'PPP') : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <SpacedCalendar
                                        initialFocus
                                        mode="single"
                                        defaultMonth={new Date(selectedDate)}
                                        selected={new Date(selectedDate)}
                                        onSelect={(date: Date | undefined) => {
                                            if (date) {
                                                setSelectedDate(format(date, 'yyyy-MM-dd'));
                                            }
                                        }}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                        
                        <div className="space-y-2">
                            <Label>Field Officer</Label>
                            <Select value={selectedFieldOfficer} onValueChange={setSelectedFieldOfficer}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select field officer" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Field Officers</SelectItem>
                                    {fieldOfficers.map((officer) => (
                                        <SelectItem key={officer} value={officer}>
                                            {officer}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Competitor Pricing</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="flex justify-center items-center h-64">
                                <Loader className="w-8 h-8 animate-spin text-primary" />
                            </div>
                        ) : (
                            <div className="rounded-md border overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Competitor</TableHead>
                                            <TableHead>Price (₹/ton)</TableHead>
                                            <TableHead>City</TableHead>
                                            <TableHead>Field Officer</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredBrands.length > 0 ? (
                                            filteredBrands.map((brand) => (
                                                <TableRow key={brand.id}>
                                                    <TableCell className="font-medium">{brand.brandName}</TableCell>
                                                    <TableCell>₹{brand.price.toFixed(2)}</TableCell>
                                                    <TableCell>{brand.city}</TableCell>
                                                    <TableCell>
                                                        {brand.brandName.toLowerCase().replace(/\s+/g, '') === 'germansteels'
                                                            ? brand.city
                                                            : brand.employeeDto
                                                                ? `${brand.employeeDto.firstName} ${brand.employeeDto.lastName}`
                                                                : 'N/A'}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={4} className="h-24 text-center">
                                                    No pricing data found matching the selected filters
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Price Comparison by Brand</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="flex justify-center items-center h-80">
                                <Loader className="w-8 h-8 animate-spin text-primary" />
                            </div>
                        ) : (
                            <>
                                <div className="h-80">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={chartData}
                                            margin={{
                                                top: 20,
                                                right: 30,
                                                left: 20,
                                                bottom: 60,
                                            }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="brand" angle={-45} textAnchor="end" height={60} />
                                            <YAxis />
                                            <Tooltip 
                                                formatter={(value) => [`₹${value}`, "Price"]}
                                                labelFormatter={(value) => `Brand: ${value}`}
                                            />
                                            <Legend />
                                            <Bar dataKey="ourPrice" name="Our Price" fill="#3b82f6" />
                                            <Bar dataKey="competitorPrice" name="Competitor Price" fill="#10b981" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="mt-4 text-sm text-muted-foreground">
                                    <p>Comparison of prices by brand between our products and competitors</p>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default PricingPage;
