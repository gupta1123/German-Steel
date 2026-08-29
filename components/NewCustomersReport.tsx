import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import Select, { MultiValue, ActionMeta, StylesConfig } from 'react-select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format, subMonths } from 'date-fns';
import { useAuth } from '@/components/auth-provider';
import { Calendar as CalendarIcon, UserCheck, UserX, RefreshCw } from 'lucide-react';
import { API } from '@/lib/api';
import { hasManagerPrivileges } from '@/lib/auth';
import { getUniqueFieldOfficersFromTeams } from '@/lib/team-access';
import { DateRangeError, isDateRangeInvalid } from '@/components/date-range-error';

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

// --- Types ---
type Employee = {
    id: number;
    firstName: string;
    lastName: string;
    role: string;
};

type ReportData = {
    employeeName: string;
    newStoreCount: number;
};

type EmployeeOption = { value: number; label: string };

// --- Clean Color Palette ---
const CHART_COLORS = [
    '#2563eb', // Blue
    '#dc2626', // Red
    '#d97706', // Amber
    '#059669', // Emerald
    '#7c3aed', // Violet
    '#db2777', // Pink
    '#0891b2', // Cyan
    '#4b5563', // Gray
    '#84cc16', // Lime
    '#4f46e5', // Indigo
];

const NewCustomersReport = () => {
    // --- State ---
    const [employees, setEmployees] = useState<EmployeeOption[]>([]);
    const [selectedEmployees, setSelectedEmployees] = useState<EmployeeOption[]>([]);
    const [excludedEmployees, setExcludedEmployees] = useState<EmployeeOption[]>([]);
    const [reportData, setReportData] = useState<Record<string, ReportData[]>>({});
    const [startDate, setStartDate] = useState(() => format(subMonths(new Date(), 2), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
    const dateRangeInvalid = isDateRangeInvalid(startDate, endDate);
    const [showTopPerformers, setShowTopPerformers] = useState(true);
    const [isAutoSelect, setIsAutoSelect] = useState(true);
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const { token, userRole, currentUser, userData } = useAuth();

    // --- Effects ---
    useEffect(() => {
        const checkDarkMode = () => {
            setIsDarkMode(document.documentElement.classList.contains('dark'));
        };
        checkDarkMode();
        const observer = new MutationObserver(checkDarkMode);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (token) {
            fetchEmployees();
        }
    }, [token, userRole, currentUser, userData?.employeeId]);

    useEffect(() => {
        if (token && startDate && endDate && !dateRangeInvalid) {
            fetchReportData();
        }
    }, [token, startDate, endDate, dateRangeInvalid]);

    // --- Data Fetching ---
    const fetchEmployees = async () => {
        try {
            const employeeDirectory = await API.getAllEmployees<Employee>();
            const isManager = hasManagerPrivileges(userRole, currentUser);
            let scopedFieldOfficerIds: Set<number> | null = null;

            if (isManager) {
                if (!userData?.employeeId) {
                    scopedFieldOfficerIds = new Set();
                } else {
                    const teamData = await API.getTeamByEmployee(userData.employeeId);
                    scopedFieldOfficerIds = new Set(getUniqueFieldOfficersFromTeams(teamData).map((officer) => officer.id));
                }
            }

            const fieldOfficers = employeeDirectory
                .filter(emp => emp.role === "Field Officer")
                .filter(emp => scopedFieldOfficerIds === null || scopedFieldOfficerIds.has(emp.id));
            const employeeOptions = fieldOfficers
                .map((emp: Employee) => ({
                    value: emp.id,
                    label: `${emp.firstName} ${emp.lastName}`
                }))
                .sort((a, b) => a.label.localeCompare(b.label));
            setEmployees(employeeOptions);
        } catch (error) {
            console.error('Error fetching employees:', error);
        }
    };

    const fetchReportData = async () => {
        if (!startDate || !endDate || dateRangeInvalid) return;
        setIsLoading(true);
        try {
            const groupedReport = await API.getReportForEmployeeRange<ReportData>(startDate, endDate);
            setReportData(groupedReport ?? {});
        } catch (error) {
            console.error('Error fetching new-customer report:', error);
            setReportData({});
        } finally {
            setIsLoading(false);
        }
    };

    // --- Calculations ---
    const filteredReportData = useMemo(() => {
        const excludedEmployeeNames = excludedEmployees.map(emp => emp.label);
        const allowedEmployeeNames = new Set(employees.map(emp => emp.label));
        return Object.fromEntries(
            Object.entries(reportData).map(([month, data]) => [
                month,
                data.filter(item =>
                    allowedEmployeeNames.has(item.employeeName) &&
                    !excludedEmployeeNames.includes(item.employeeName)
                )
            ])
        );
    }, [reportData, excludedEmployees, employees]);

    const calculatedPerformers = useMemo(() => {
        const aggregatedData = Object.values(filteredReportData).flat().reduce((acc: Record<string, number>, curr) => {
            if (!acc[curr.employeeName]) acc[curr.employeeName] = 0;
            acc[curr.employeeName] += curr.newStoreCount;
            return acc;
        }, {});

        const sortedPerformers = Object.entries(aggregatedData)
            .sort(([, a], [, b]) => b - a)
            .map(([name, count]) => ({ name, count }));

        return {
            topPerformers: sortedPerformers.slice(0, 5),
            bottomPerformers: sortedPerformers.slice(-5).reverse(),
            allPerformers: sortedPerformers
        };
    }, [filteredReportData]);

    const updateSelectedEmployees = useCallback(() => {
        if (!isAutoSelect) return;

        const performersToShow = showTopPerformers ? calculatedPerformers.topPerformers : calculatedPerformers.bottomPerformers;
        const newSelectedEmployees = performersToShow
            .map(performer => employees.find(emp => emp.label.includes(performer.name)))
            .filter((emp): emp is EmployeeOption => emp !== undefined);

        const sortedEmployees = employees
            .filter(emp => !excludedEmployees.some(excluded => excluded.value === emp.value))
            .sort((a, b) => {
                const aCount = calculatedPerformers.topPerformers.find(p => p.name.includes(a.label))?.count || 0;
                const bCount = calculatedPerformers.topPerformers.find(p => p.name.includes(b.label))?.count || 0;
                return showTopPerformers ? bCount - aCount : aCount - bCount;
            });

        while (newSelectedEmployees.length < 5 && newSelectedEmployees.length < sortedEmployees.length) {
            const nextEmployee = sortedEmployees.find(emp => !newSelectedEmployees.some(selected => selected.value === emp.value));
            if (nextEmployee) newSelectedEmployees.push(nextEmployee);
            else break;
        }
        setSelectedEmployees(newSelectedEmployees);
    }, [employees, excludedEmployees, calculatedPerformers, showTopPerformers, isAutoSelect]);

    useEffect(() => {
        updateSelectedEmployees();
    }, [updateSelectedEmployees]);

    // --- Handlers ---
    const handleExcludedEmployeeSelect = (newValue: MultiValue<EmployeeOption>, actionMeta: ActionMeta<EmployeeOption>) => {
        setExcludedEmployees(newValue as EmployeeOption[]);
        // If auto-select is on, it will re-calculate top 5 without these employees
        // If manual, we need to remove them from selected if they are there
        if (isAutoSelect) {
            updateSelectedEmployees();
        } else {
            setSelectedEmployees(prev => prev.filter(emp => !(newValue as EmployeeOption[]).some(excluded => excluded.value === emp.value)));
        }
    };

    const handleEmployeeSelect = (newValue: MultiValue<EmployeeOption>, actionMeta: ActionMeta<EmployeeOption>) => {
        setSelectedEmployees(newValue as EmployeeOption[]);
        setIsAutoSelect(false);
    };

    // --- Chart Data ---
    const chartData = useMemo(() => {
        const months = Object.keys(filteredReportData);
        const datasets = selectedEmployees.map((employee, index) => {
            const color = CHART_COLORS[index % CHART_COLORS.length];
            return {
                label: employee.label,
                data: months.map(month => {
                    const employeeData = filteredReportData[month].find(data => data.employeeName === employee.label);
                    return employeeData ? employeeData.newStoreCount : 0;
                }),
                borderColor: color,
                backgroundColor: color,
                tension: 0.3,
                pointRadius: 3,
                pointHoverRadius: 5,
            }
        });

        return { labels: months, datasets };
    }, [filteredReportData, selectedEmployees]);

    const chartOptions = useMemo(() => {
        const textColor = isDarkMode ? '#e5e7eb' : '#374151';
        const gridColor = isDarkMode ? '#374151' : '#e5e7eb';
        
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top' as const,
                    labels: { usePointStyle: true, color: textColor }
                },
                tooltip: {
                    usePointStyle: true,
                    backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
                    titleColor: isDarkMode ? '#f9fafb' : '#111827',
                    bodyColor: isDarkMode ? '#e5e7eb' : '#374151',
                    borderColor: gridColor,
                    borderWidth: 1,
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: gridColor },
                    ticks: { color: textColor }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: textColor }
                }
            }
        };
    }, [isDarkMode]);

    const getTotalNewCustomers = (employeeName: string) => {
        return calculatedPerformers.allPerformers.find(p => p.name.includes(employeeName))?.count || 0;
    };

    // --- Styles for React Select ---
    const selectStyles: StylesConfig<EmployeeOption, true> = {
        control: (base) => ({
            ...base,
            backgroundColor: 'hsl(var(--background))',
            borderColor: 'hsl(var(--input))',
            color: 'hsl(var(--foreground))',
            borderRadius: '0.375rem',
            minHeight: '2.5rem',
        }),
        menu: (base) => ({
            ...base,
            backgroundColor: 'hsl(var(--popover))',
            zIndex: 50,
            border: '1px solid hsl(var(--border))'
        }),
        option: (base, state) => ({
            ...base,
            backgroundColor: state.isFocused ? 'hsl(var(--accent))' : 'transparent',
            color: state.isFocused ? 'hsl(var(--accent-foreground))' : 'hsl(var(--foreground))',
            cursor: 'pointer'
        }),
        multiValue: (base) => ({
            ...base,
            backgroundColor: 'hsl(var(--secondary))',
        }),
        multiValueLabel: (base) => ({
            ...base,
            color: 'hsl(var(--secondary-foreground))',
        }),
        input: (base) => ({ ...base, color: 'hsl(var(--foreground))' })
    };

    return (
        <div className="container mx-auto p-6 max-w-7xl space-y-6">
            
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">New Customers Report</h1>
                    <p className="text-muted-foreground">Analyze field officer acquisition trends over time.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button 
                        variant={showTopPerformers && isAutoSelect ? "default" : "outline"}
                        onClick={() => { setShowTopPerformers(true); setIsAutoSelect(true); }}
                        size="sm"
                    >
                        Top 5
                    </Button>
                    <Button 
                        variant={!showTopPerformers && isAutoSelect ? "default" : "outline"}
                        onClick={() => { setShowTopPerformers(false); setIsAutoSelect(true); }}
                        size="sm"
                    >
                        Bottom 5
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={fetchReportData} 
                        disabled={isLoading || dateRangeInvalid || !startDate || !endDate}
                        title="Refresh Data"
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            {/* Filters Section */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold">Report Settings</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {/* Start Date */}
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                                <CalendarIcon className="w-3 h-3" /> Start Date
                            </Label>
                            <Input 
                                type="date" 
                                value={startDate} 
                                onChange={(e) => setStartDate(e.target.value)} 
                            />
                        </div>

                        {/* End Date */}
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                                <CalendarIcon className="w-3 h-3" /> End Date
                            </Label>
                            <Input 
                                type="date" 
                                value={endDate} 
                                onChange={(e) => setEndDate(e.target.value)} 
                            />
                        </div>

                        {/* Include Employees */}
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2 text-xs uppercase tracking-wide text-green-600 dark:text-green-400 font-semibold">
                                <UserCheck className="w-3 h-3" /> Include Employees
                            </Label>
                            <Select
                                isMulti
                                options={employees.filter(emp => !excludedEmployees.some(ex => ex.value === emp.value))}
                                value={selectedEmployees}
                                onChange={handleEmployeeSelect}
                                styles={selectStyles}
                                placeholder="Select to view..."
                            />
                        </div>

                        {/* Exclude Employees */}
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2 text-xs uppercase tracking-wide text-red-600 dark:text-red-400 font-semibold">
                                <UserX className="w-3 h-3" /> Exclude Employees
                            </Label>
                            <Select
                                isMulti
                                options={employees}
                                value={excludedEmployees}
                                onChange={handleExcludedEmployeeSelect}
                                styles={selectStyles}
                                placeholder="Select to remove..."
                                className="border-red-100"
                            />
                        </div>
                    </div>
                    <DateRangeError fromDate={startDate} toDate={endDate} className="mt-4" />
                </CardContent>
            </Card>

            {/* Chart Section */}
            <Card className="shadow-sm border">
                <CardHeader className="border-b bg-muted/20 py-4">
                    <CardTitle className="text-base font-medium">Performance Trend</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                    <div className="h-[400px] w-full">
                        <Line data={chartData} options={chartOptions} />
                    </div>
                </CardContent>
            </Card>

            {/* Data Table */}
            <Card>
                <CardHeader className="py-4">
                    <CardTitle className="text-base font-medium">Summary Totals</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                                <tr>
                                    <th className="px-4 py-3 rounded-l-md">Rank</th>
                                    <th className="px-4 py-3">Employee Name</th>
                                    <th className="px-4 py-3 text-right rounded-r-md">Total New Customers</th>
                                </tr>
                            </thead>
                            <tbody>
                                {selectedEmployees.length > 0 ? (
                                    selectedEmployees
                                        .sort((a, b) => getTotalNewCustomers(b.label) - getTotalNewCustomers(a.label))
                                        .map((employee, index) => (
                                            <tr key={employee.value} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                                <td className="px-4 py-3 font-medium text-muted-foreground">#{index + 1}</td>
                                                <td className="px-4 py-3 font-medium text-foreground">
                                                    <span 
                                                        className="inline-block w-2 h-2 rounded-full mr-2" 
                                                        style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                                                    />
                                                    {employee.label}
                                                </td>
                                                <td className="px-4 py-3 text-right font-bold">{getTotalNewCustomers(employee.label)}</td>
                                            </tr>
                                        ))
                                ) : (
                                    <tr>
                                        <td colSpan={3} className="text-center py-8 text-muted-foreground">
                                            No employees selected to display.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default NewCustomersReport;
