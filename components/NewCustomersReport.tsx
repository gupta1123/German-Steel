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
            minHeight: '2.25rem',
        }),
        menu: (base) => ({
            ...base,
            backgroundColor: 'hsl(var(--popover))',
            zIndex: 80,
            border: '1px solid hsl(var(--border))'
        }),
        menuList: (base) => ({ ...base, maxHeight: 240, paddingBlock: 4 }),
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
        <div className="space-y-5">

            {/* Filters Section */}
            <section className="space-y-3 border-b pb-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground">Compare acquisition totals for selected field officers.</p>
                        <div className="flex items-center gap-1 rounded-md border bg-background p-0.5">
                            <Button variant={showTopPerformers && isAutoSelect ? "default" : "ghost"} onClick={() => { setShowTopPerformers(true); setIsAutoSelect(true); }} size="sm" className="h-7 px-2.5">Top 5</Button>
                            <Button variant={!showTopPerformers && isAutoSelect ? "default" : "ghost"} onClick={() => { setShowTopPerformers(false); setIsAutoSelect(true); }} size="sm" className="h-7 px-2.5">Bottom 5</Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fetchReportData} disabled={isLoading || dateRangeInvalid || !startDate || !endDate} title="Refresh data" aria-label="Refresh data">
                                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                            </Button>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-2 xl:grid-cols-[minmax(150px,.75fr)_minmax(150px,.75fr)_minmax(240px,1.25fr)_minmax(240px,1.25fr)] xl:items-end">
                        {/* Start Date */}
                        <div className="min-w-0 space-y-1.5">
                            <Label htmlFor="new-customers-start" className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                                <CalendarIcon className="h-3 w-3" /> Start date
                            </Label>
                            <Input 
                                id="new-customers-start"
                                type="date" 
                                value={startDate} 
                                onChange={(e) => setStartDate(e.target.value)} 
                                className="h-9"
                            />
                        </div>

                        {/* End Date */}
                        <div className="min-w-0 space-y-1.5">
                            <Label htmlFor="new-customers-end" className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                                <CalendarIcon className="h-3 w-3" /> End date
                            </Label>
                            <Input 
                                id="new-customers-end"
                                type="date" 
                                value={endDate} 
                                onChange={(e) => setEndDate(e.target.value)} 
                                className="h-9"
                            />
                        </div>

                        {/* Include Employees */}
                        <div className="min-w-0 space-y-1.5">
                            <Label htmlFor="new-customers-include" className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                                <UserCheck className="h-3 w-3" /> Include employees
                            </Label>
                            <Select
                                inputId="new-customers-include"
                                isMulti
                                options={employees.filter(emp => !excludedEmployees.some(ex => ex.value === emp.value))}
                                value={selectedEmployees}
                                onChange={handleEmployeeSelect}
                                styles={selectStyles}
                                placeholder="Select to view..."
                            />
                        </div>

                        {/* Exclude Employees */}
                        <div className="min-w-0 space-y-1.5">
                            <Label htmlFor="new-customers-exclude" className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                                <UserX className="h-3 w-3" /> Exclude employees
                            </Label>
                            <Select
                                inputId="new-customers-exclude"
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
                    <DateRangeError fromDate={startDate} toDate={endDate} />
            </section>

            {/* Chart Section */}
            <Card className="border-border/80 shadow-sm">
                <CardHeader className="border-b bg-muted/10 px-4 py-3">
                    <CardTitle className="text-sm font-semibold">Performance trend</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                    <div className="h-[320px] w-full md:h-[400px]">
                        <Line data={chartData} options={chartOptions} />
                    </div>
                </CardContent>
            </Card>

            {/* Data Table */}
            <Card className="border-border/80 shadow-sm">
                <CardHeader className="border-b bg-muted/10 px-4 py-3">
                    <CardTitle className="text-sm font-semibold">Summary totals</CardTitle>
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
                                    selectedEmployees.slice()
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
