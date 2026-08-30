'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import { useAuth } from '@/components/auth-provider';
import { isManagerRoleValue, normalizeRoleValue } from '@/lib/auth';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { BarChart3, CalendarIcon, Loader2, MapPin } from "lucide-react";
import { API, type TeamDataDto } from "@/lib/api";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SpacedCalendar } from "@/components/ui/spaced-calendar";
import { getTeamIds } from "@/lib/team-access";
import { formatCityLabel } from "@/lib/city-options";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select2";

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

const isGermanSteelsBrand = (brandName: string) =>
    brandName.toLowerCase().replace(/\s+/g, '') === 'germansteels';

const getBrandCity = (brand: Brand) =>
    isGermanSteelsBrand(brand.brandName) ? brand.city : brand.employeeDto?.city || brand.city;

const formatPrice = (price: number) =>
    new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2,
    }).format(price);

const PricingPage = () => {
    const [brandData, setBrandData] = useState<Brand[]>([]);
    const [selectedCity, setSelectedCity] = useState('all');
    const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
    const [cities, setCities] = useState<string[]>([]);
    const [germanSteelsRate, setGermanSteelsRate] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [pricingError, setPricingError] = useState<string | null>(null);
    const pricingRequest = useRef(0);
    const [showGermanSteelsRate, setShowGermanSteelsRate] = useState(false);
    const [fieldOfficers, setFieldOfficers] = useState<string[]>([]);
    const [selectedFieldOfficer, setSelectedFieldOfficer] = useState("all");
    const [teamIds, setTeamIds] = useState<number[]>([]);
    const [teamLoading, setTeamLoading] = useState(false);
    const [teamError, setTeamError] = useState<string | null>(null);

    const { token, userData } = useAuth();
    
    // State for role checking
    const [isManager, setIsManager] = useState(false);
    const [isFieldOfficer, setIsFieldOfficer] = useState(false);
    const [isRoleDetermined, setIsRoleDetermined] = useState(false);

    // Fetch current user data to determine role
    useEffect(() => {
        const fetchCurrentUser = async () => {
            if (!token) return;
            setIsRoleDetermined(false);
            
            try {
                const response = await fetch('http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/user/manage/current-user', {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                });
                
                if (response.ok) {
                    const userData = await response.json();
                    
                    // Extract role from authorities
                    const authorities = userData.authorities || [];
                    const role = authorities.length > 0 ? authorities[0].authority : null;
                    const normalizedRole = normalizeRoleValue(role);
                    const managerFlag = isManagerRoleValue(role);
                    const adminFlag = normalizedRole === 'ROLE_ADMIN' || normalizedRole === 'ADMIN';
                    const fieldOfficerFlag = normalizedRole === 'ROLE_FIELD OFFICER' || normalizedRole === 'FIELD OFFICER';

                    // Set role flags
                    setIsManager(managerFlag);
                    setIsFieldOfficer(fieldOfficerFlag);

                    if (!adminFlag && !managerFlag && !fieldOfficerFlag) {
                        throw new Error('Pricing access is not available for this role.');
                    }
                    setIsRoleDetermined(true);
                } else {
                    throw new Error('Could not verify pricing access. Please sign in again.');
                }
            } catch (error) {
                setPricingError(error instanceof Error ? error.message : 'Could not verify pricing access.');
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

    const fetchBrandData = useCallback(async () => {
        const request = ++pricingRequest.current;
        if (!token || !isRoleDetermined || ((isManager || isFieldOfficer) && teamIds.length === 0)) {
            setBrandData([]);
            setCities([]);
            setFieldOfficers([]);
            setShowGermanSteelsRate(false);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setPricingError(null);
        
        try {
            const formattedStartDate = format(new Date(selectedDate), 'yyyy-MM-dd');
            const formattedEndDate = format(new Date(selectedDate), 'yyyy-MM-dd');


            let data: Brand[];

            if (isManager || isFieldOfficer) {
                const responses = await Promise.all(teamIds.map(async (id) => {
                    const url = `http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/brand/getByTeamAndDate?id=${id}&start=${formattedStartDate}&end=${formattedEndDate}`;
                    const response = await fetch(url, {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    });
                    if (!response.ok) throw new Error('Could not load pricing. Please try again.');
                    const records = await response.json();
                    if (!Array.isArray(records)) throw new Error('Unexpected pricing response. Please try again.');
                    return records as Brand[];
                }));
                data = Array.from(new Map(responses.flat().map((brand) => [brand.id, brand])).values());
            } else {
                const url = `http://ec2-18-211-58-135.compute-1.amazonaws.com:8081/brand/getByDateRange?start=${formattedStartDate}&end=${formattedEndDate}`;
                const response = await fetch(url, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });
                if (!response.ok) throw new Error('Could not load pricing. Please try again.');
                data = await response.json();
                if (!Array.isArray(data)) throw new Error('Unexpected pricing response. Please try again.');
            }

            if (request !== pricingRequest.current) return;
            setBrandData(data);

            const uniqueCities = Array.from(new Set(data.map(brand =>
                brand.brandName.toLowerCase().replace(/\s+/g, '') === 'germansteels' ? brand.city : brand.employeeDto?.city
            ).filter(city => city && city.trim() !== "")));
            setCities(uniqueCities.sort((left, right) => formatCityLabel(left).localeCompare(formatCityLabel(right))));

            const uniqueFieldOfficers = Array.from(new Set(data.map(brand =>
                brand.employeeDto ? `${brand.employeeDto.firstName} ${brand.employeeDto.lastName}` : ''
            ).filter(officer => officer && officer.trim() !== "")));
            setFieldOfficers(uniqueFieldOfficers.sort((left, right) => left.localeCompare(right)));

            const germanSteelsBrand = data.find(brand => brand.brandName.toLowerCase().replace(/\s+/g, '') === 'germansteels');
            if (germanSteelsBrand) {
                setGermanSteelsRate(germanSteelsBrand.price);
                setShowGermanSteelsRate(germanSteelsBrand.employeeDto?.firstName === 'Test' && germanSteelsBrand.employeeDto?.lastName === '1');
            } else {
                setGermanSteelsRate(0);
                setShowGermanSteelsRate(false);
            }
        } catch (error) {
            if (request !== pricingRequest.current) return;
            setPricingError(error instanceof Error ? error.message : 'Could not load pricing. Please try again.');
            setBrandData([]);
            setGermanSteelsRate(0);
            setShowGermanSteelsRate(false);
            setCities([]);
            setFieldOfficers([]);
        } finally {
            if (request === pricingRequest.current) setIsLoading(false);
        }
    }, [selectedDate, token, isRoleDetermined, isManager, isFieldOfficer, teamIds]);

    useEffect(() => {
        void fetchBrandData();
        return () => { pricingRequest.current += 1; };
    }, [fetchBrandData]);

    const fieldOfficerOptions = React.useMemo<SearchableOption[]>(() =>
        fieldOfficers.map((officer) => ({ value: officer, label: officer })),
    [fieldOfficers]);

    const filteredBrands = brandData.filter(brand => {
        const cityMatch = selectedCity === "all" || getBrandCity(brand) === selectedCity;
        const officerMatch = selectedFieldOfficer === "all" || (brand.employeeDto ? `${brand.employeeDto.firstName} ${brand.employeeDto.lastName}` === selectedFieldOfficer : false);
        return cityMatch && officerMatch;
    });

    // Group brands and consolidate GermanSteels entries
    const brandGroups = filteredBrands.reduce((acc, brand) => {
        const brandName = brand.brandName.toLowerCase();
        
        if (isGermanSteelsBrand(brandName)) {
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
            if (isGermanSteelsBrand(a.brand)) return -1;
            if (isGermanSteelsBrand(b.brand)) return 1;
            
            // Sort other brands alphabetically
            return a.brand.localeCompare(b.brand);
        });


    return (
        <div className="space-y-4 py-4">
            <div className="flex flex-col gap-3 border-b border-border/70 pb-4 lg:flex-row lg:items-end">
                        <div className="min-w-0 space-y-1.5 lg:w-[180px]">
                            <Label className="text-xs font-medium">City</Label>
                            <Select value={selectedCity} onValueChange={setSelectedCity}>
                                <SelectTrigger className="h-9 w-full text-sm shadow-none">
                                    <SelectValue placeholder="All cities" />
                                </SelectTrigger>
                                <SelectContent className="max-h-56">
                                    <SelectItem value="all">All cities</SelectItem>
                                    {cities.map((city) => (
                                        <SelectItem key={city} value={city}>
                                            {formatCityLabel(city)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        
                        <div className="min-w-0 space-y-1.5 lg:w-[190px]">
                            <Label className="text-xs font-medium">Date</Label>
                            <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={`h-9 w-full justify-start text-left text-sm font-normal shadow-none ${!selectedDate && 'text-muted-foreground'}`}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {selectedDate ? format(new Date(selectedDate), 'MMM dd, yyyy') : <span>Pick a date</span>}
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
                                                setIsDatePickerOpen(false);
                                            }
                                        }}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                        
                        <div className="min-w-0 space-y-1.5 lg:w-[240px]">
                            <Label className="text-xs font-medium">Field officer</Label>
                            <SearchableSelect
                                options={fieldOfficerOptions}
                                value={selectedFieldOfficer === 'all' ? undefined : selectedFieldOfficer}
                                onSelect={(option) => setSelectedFieldOfficer(option?.value ?? 'all')}
                                placeholder="All field officers"
                                searchPlaceholder="Search field officers..."
                                emptyMessage="No field officers found"
                                allowClear
                                triggerClassName="h-9 w-full text-sm shadow-none"
                                contentClassName="w-[var(--radix-popover-trigger-width)]"
                            />
                        </div>

                        {showGermanSteelsRate && germanSteelsRate > 0 && (
                            <div className="ml-auto rounded-md border bg-muted/30 px-3 py-2 text-right">
                                <p className="text-[11px] text-muted-foreground">German Steels rate</p>
                                <p className="text-sm font-semibold tabular-nums">{formatPrice(germanSteelsRate)}<span className="font-normal text-muted-foreground">/ton</span></p>
                            </div>
                        )}
            </div>

            {pricingError && <p role="alert" className="text-sm text-destructive">{pricingError}</p>}

            {(isManager || isFieldOfficer) && (teamLoading || teamError) && (
                <p className={`text-xs ${teamError ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {teamLoading ? 'Loading team pricing access…' : teamError}
                </p>
            )}

            <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.35fr)]">
                <Card className="overflow-hidden shadow-none">
                    <CardHeader className="border-b px-4 py-3">
                        <CardTitle className="text-sm font-semibold">Competitor pricing</CardTitle>
                        <p className="text-xs text-muted-foreground">Recorded prices for the selected day and market.</p>
                    </CardHeader>
                    <CardContent className="p-0">
                        {isLoading ? (
                            <div className="flex h-64 items-center justify-center text-muted-foreground">
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                <span className="text-sm">Loading pricing…</span>
                            </div>
                        ) : (
                            <div className="max-h-[360px] overflow-auto">
                                <Table className="text-xs">
                                    <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
                                        <TableRow>
                                            <TableHead className="h-9 text-xs">Brand</TableHead>
                                            <TableHead className="h-9 text-right text-xs">Price/ton</TableHead>
                                            <TableHead className="h-9 text-xs">City</TableHead>
                                            <TableHead className="h-9 text-xs">Field officer</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredBrands.length > 0 ? (
                                            filteredBrands.map((brand) => (
                                                <TableRow key={brand.id}>
                                                    <TableCell className="max-w-[160px] truncate font-medium" title={brand.brandName}>{brand.brandName}</TableCell>
                                                    <TableCell className="text-right font-medium tabular-nums">{formatPrice(brand.price)}</TableCell>
                                                    <TableCell><span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3 text-muted-foreground" />{formatCityLabel(getBrandCity(brand))}</span></TableCell>
                                                    <TableCell className="max-w-[170px] truncate" title={brand.employeeDto ? `${brand.employeeDto.firstName} ${brand.employeeDto.lastName}` : undefined}>
                                                        {isGermanSteelsBrand(brand.brandName)
                                                            ? '—'
                                                            : brand.employeeDto
                                                                ? `${brand.employeeDto.firstName} ${brand.employeeDto.lastName}`
                                                                : '—'}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={4} className="h-48 text-center">
                                                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                                        <BarChart3 className="h-7 w-7 stroke-[1.5]" />
                                                        <span className="text-sm font-medium text-foreground">No pricing data found</span>
                                                        <span className="text-xs">Try a different date, city, or field officer.</span>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="overflow-hidden shadow-none">
                    <CardHeader className="border-b px-4 py-3">
                        <CardTitle className="text-sm font-semibold">Price comparison by brand</CardTitle>
                        <p className="text-xs text-muted-foreground">German Steels and competitor rates per ton.</p>
                    </CardHeader>
                    <CardContent className="p-4">
                        {isLoading ? (
                            <div className="flex h-72 items-center justify-center text-muted-foreground">
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                <span className="text-sm">Building comparison…</span>
                            </div>
                        ) : chartData.length === 0 ? (
                            <div className="flex h-72 flex-col items-center justify-center gap-2 text-muted-foreground">
                                <BarChart3 className="h-7 w-7 stroke-[1.5]" />
                                <span className="text-sm font-medium text-foreground">Nothing to compare yet</span>
                                <span className="text-xs">Pricing entries will appear here.</span>
                            </div>
                        ) : (
                                <div className="h-[320px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            layout="vertical"
                                            data={chartData}
                                            margin={{
                                                top: 8,
                                                right: 20,
                                                left: 8,
                                                bottom: 8,
                                            }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                                            <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(value) => `₹${value}`} />
                                            <YAxis type="category" dataKey="brand" width={105} tick={{ fontSize: 11 }} />
                                            <Tooltip 
                                                formatter={(value) => [formatPrice(Number(value)), "Price"]}
                                                labelFormatter={(value) => `Brand: ${value}`}
                                                contentStyle={{ borderRadius: 8, borderColor: 'hsl(var(--border))', fontSize: 12 }}
                                            />
                                            <Legend wrapperStyle={{ fontSize: 11 }} />
                                            <Bar dataKey="ourPrice" name="Our price" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                                            <Bar dataKey="competitorPrice" name="Competitor price" fill="#16a085" radius={[0, 4, 4, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default PricingPage;
