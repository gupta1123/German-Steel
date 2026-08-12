import React, { useState, useEffect, useCallback } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    Title,
    Tooltip,
    Legend,
    TimeScale,
    ChartOptions,
    BarController,
    LineController
} from 'chart.js';
import 'chartjs-adapter-moment';
import { Chart } from 'react-chartjs-2';
import Select, { type InputActionMeta, type StylesConfig } from 'react-select';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import axios from 'axios';
import moment from 'moment';
import { useAuth } from '@/components/auth-provider';
import './SalesPerformanceReport.css';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    Title,
    Tooltip,
    Legend,
    TimeScale,
    BarController,
    LineController
);

type Store = {
    storeId: number;
    storeName: string;
    city: string;
};

type MonthlyData = {
    month: string;
    avgMonthlySale: number;
    avgIntent: number;
    totalVisitCount: number;
};

type StoreOption = {
    value: number;
    label: string;
    city: string;
};

const SalesPerformanceReport: React.FC = () => {
    const [stores, setStores] = useState<StoreOption[]>([]);
    const [selectedStore, setSelectedStore] = useState<StoreOption | null>(null);
    const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [startDate, setStartDate] = useState(moment().subtract(3, 'months').format('YYYY-MM-DD'));
    const [endDate, setEndDate] = useState(moment().format('YYYY-MM-DD'));
    const [storeNameFilter, setStoreNameFilter] = useState('');
    const [cityFilter, setCityFilter] = useState('');
    const [storeSearchQuery, setStoreSearchQuery] = useState('');
    const [storeSelectInput, setStoreSelectInput] = useState('');

    const { token } = useAuth();

    const fetchStores = useCallback(async () => {
        try {
            const response = await axios.get<{ content: Store[], totalPages: number }>(
                '/api/proxy/store/filteredValues',
                {
                    params: {
                        storeName: storeSearchQuery || storeNameFilter,
                        city: cityFilter,
                        page: 0,
                        size: 10,
                        sort: 'storeName,asc'
                    },
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            if (response.data && response.data.content) {
                const storeOptions = response.data.content.map((store: Store) => ({
                    value: store.storeId,
                    label: store.storeName,
                    city: store.city
                }));
                setStores(storeOptions);
            } else {
                setError('Unexpected API response structure');
            }
        } catch (error) {
            console.error('Error fetching stores:', error);
            setError('Failed to fetch stores');
        }
    }, [token, storeNameFilter, cityFilter, storeSearchQuery]);

    useEffect(() => {
        if (token) {
            fetchStores();
        }
    }, [fetchStores, token]);

    const fetchMonthData = useCallback(async (start: string, end: string, storeId: number) => {
        try {
            const response = await axios.get('/api/proxy/report/getAvgValues', {
                params: { startDate: start, endDate: end, storeId },
                headers: { Authorization: `Bearer ${token}` }
            });
            return response.data;
        } catch (err) {
            console.error(`Error fetching data for ${start} to ${end}:`, err);
            throw err;
        }
    }, [token]);

    const fetchReportData = useCallback(async () => {
        if (!selectedStore) {
            setError('Please select a store');
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const monthlyDataArray = [];
            const currentDate = moment(startDate).startOf('month');
            const endMoment = moment(endDate);

            while (currentDate.isSameOrBefore(endMoment)) {
                const monthStart = currentDate.format('YYYY-MM-DD');
                const monthEnd = moment.min(currentDate.clone().endOf('month'), endMoment).format('YYYY-MM-DD');

                const monthData = await fetchMonthData(monthStart, monthEnd, selectedStore.value);

                const avgMonthlySale = monthData.monthlySaleLogs.length > 0
                    ? monthData.monthlySaleLogs.reduce((sum: number, log: { newMonthlySale: number }) => sum + log.newMonthlySale, 0) / monthData.monthlySaleLogs.length
                    : 0;

                const avgIntent = monthData.intentLogs.length > 0
                    ? monthData.intentLogs.reduce((sum: number, log: { newIntentLevel: number }) => sum + log.newIntentLevel, 0) / monthData.intentLogs.length
                    : 0;

                monthlyDataArray.push({
                    month: currentDate.format('YYYY-MM'),
                    avgMonthlySale,
                    avgIntent,
                    totalVisitCount: monthData.totalVisitCount
                });

                currentDate.add(1, 'month');
            }

            setMonthlyData(monthlyDataArray);
        } catch (err) {
            setError('Failed to fetch report data');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [selectedStore, startDate, endDate, fetchMonthData]);

    const chartData = {
        labels: monthlyData.map(data => data.month),
        datasets: [
            {
                type: 'line' as const,
                label: 'Average Monthly Sales',
                data: monthlyData.map(data => Math.round(data.avgMonthlySale)),
                borderColor: 'rgba(75, 192, 192, 1)',
                backgroundColor: 'rgba(75, 192, 192, 0.5)',
                borderWidth: 2,
                fill: false,
                yAxisID: 'y',
            },
            {
                type: 'bar' as const,
                label: 'Average Intent Level',
                data: monthlyData.map(data => Math.round(data.avgIntent)),
                backgroundColor: 'rgba(255, 159, 64, 0.5)',
                borderColor: 'rgba(255, 159, 64, 1)',
                borderWidth: 1,
                yAxisID: 'y1',
            },
            {
                type: 'bar' as const,
                label: 'Total Visit Count',
                data: monthlyData.map(data => data.totalVisitCount),
                backgroundColor: 'rgba(153, 102, 255, 0.5)',
                borderColor: 'rgba(153, 102, 255, 1)',
                borderWidth: 1,
                yAxisID: 'y2',
            }
        ]
    };

    const chartOptions: ChartOptions<'bar' | 'line'> = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: {
                type: 'time',
                time: {
                    unit: 'month',
                    displayFormats: {
                        month: 'MMM YYYY'
                    }
                },
                title: {
                    display: true,
                    text: 'Month',
                    font: {
                        size: 12
                    }
                },
                ticks: {
                    font: {
                        size: 10
                    }
                }
            },
            y: {
                type: 'linear',
                display: true,
                position: 'left',
                title: {
                    display: true,
                    text: 'Average Monthly Sales',
                    font: {
                        size: 12
                    }
                },
                ticks: {
                    callback: (value) => Math.round(Number(value)),
                    font: {
                        size: 10
                    }
                }
            },
            y1: {
                type: 'linear',
                display: true,
                position: 'right',
                title: {
                    display: true,
                    text: 'Average Intent Level',
                    font: {
                        size: 12
                    }
                },
                grid: {
                    drawOnChartArea: false,
                },
                ticks: {
                    callback: (value) => Math.round(Number(value)),
                    font: {
                        size: 10
                    }
                }
            },
            y2: {
                type: 'linear',
                display: true,
                position: 'right',
                title: {
                    display: true,
                    text: 'Total Visit Count',
                    font: {
                        size: 12
                    }
                },
                grid: {
                    drawOnChartArea: false,
                },
                ticks: {
                    font: {
                        size: 10
                    }
                }
            }
        },
        plugins: {
            tooltip: {
                callbacks: {
                    title: (context) => moment(context[0].parsed.x).format('MMMM YYYY')
                }
            },
            legend: {
                position: 'top',
                labels: {
                    font: {
                        size: 10
                    },
                    boxWidth: 10,
                    padding: 10
                }
            }
        },
    };

    const storeSelectStyles: StylesConfig<StoreOption, false> = {
        control: (base, state) => ({
            ...base,
            minHeight: 46,
            borderRadius: 8,
            backgroundColor: 'hsl(var(--background))',
            borderColor: state.isFocused ? 'hsl(var(--ring))' : 'hsl(var(--border))',
            boxShadow: state.isFocused ? '0 0 0 1px hsl(var(--ring))' : 'none',
            '&:hover': {
                borderColor: state.isFocused ? 'hsl(var(--ring))' : 'hsl(var(--border))',
            },
        }),
        valueContainer: (base) => ({
            ...base,
            paddingLeft: 12,
            paddingRight: 8,
        }),
        singleValue: (base) => ({
            ...base,
            color: 'hsl(var(--foreground))',
        }),
        placeholder: (base) => ({
            ...base,
            color: 'hsl(var(--muted-foreground))',
        }),
        input: (base) => ({
            ...base,
            color: 'hsl(var(--foreground))',
        }),
        indicatorSeparator: (base) => ({
            ...base,
            backgroundColor: 'hsl(var(--border))',
        }),
        dropdownIndicator: (base) => ({
            ...base,
            color: 'hsl(var(--muted-foreground))',
            '&:hover': { color: 'hsl(var(--foreground))' },
        }),
        menu: (base) => ({
            ...base,
            backgroundColor: 'hsl(var(--popover))',
            border: '1px solid hsl(var(--border))',
            boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
            borderRadius: 8,
            overflow: 'hidden',
            zIndex: 60,
        }),
        menuList: (base) => ({
            ...base,
            paddingTop: 4,
            paddingBottom: 4,
        }),
        option: (base, state) => ({
            ...base,
            backgroundColor: state.isSelected
                ? 'hsl(var(--accent))'
                : state.isFocused
                    ? 'hsl(var(--muted))'
                    : 'transparent',
            color: 'hsl(var(--foreground))',
            cursor: 'pointer',
            fontSize: 14,
        }),
        noOptionsMessage: (base) => ({
            ...base,
            color: 'hsl(var(--muted-foreground))',
        }),
    };

    const handleStoreSelect = (selected: StoreOption | null) => {
        setSelectedStore(selected);
        setStoreSelectInput('');
        setStoreSearchQuery('');
    };

    const handleStoreSearchInput = (inputValue: string, actionMeta: InputActionMeta) => {
        if (actionMeta.action !== 'input-change') {
            return storeSelectInput;
        }
        setStoreSelectInput(inputValue);
        setStoreSearchQuery(inputValue);
        return inputValue;
    };

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        if (name === 'startDate') setStartDate(value);
        if (name === 'endDate') setEndDate(value);
    };

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        if (name === 'storeName') setStoreNameFilter(value);
        if (name === 'city') setCityFilter(value);
    };

    return (
        <div className="container-salesPerformanceReport space-y-4 p-4 md:space-y-6 md:p-6">
            <Card className="shadow-md">
                <CardContent className="p-4 md:p-6">
                    <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">Sales Performance Report</h2>
                    <div className="space-y-4 md:space-y-0 md:grid md:grid-cols-3 md:gap-4">
                        <div className="space-y-2">
                            <label className="block text-sm font-medium">Store Filter</label>
                            <Input
                                placeholder="Store Name"
                                name="storeName"
                                value={storeNameFilter}
                                onChange={handleFilterChange}
                                className="w-full"
                            />
                            <Input
                                placeholder="City"
                                name="city"
                                value={cityFilter}
                                onChange={handleFilterChange}
                                className="w-full"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-sm font-medium">Store Selection</label>
                            <Select
                                options={stores}
                                value={selectedStore}
                                onChange={handleStoreSelect}
                                onInputChange={handleStoreSearchInput}
                                inputValue={storeSelectInput}
                                className="basic-single"
                                classNamePrefix="select"
                                placeholder="Select Store"
                                styles={storeSelectStyles}
                                isSearchable
                                isClearable
                                backspaceRemovesValue
                                noOptionsMessage={() => "No matching stores found"}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-sm font-medium">Date Range</label>
                            <Input
                                type="date"
                                name="startDate"
                                value={startDate}
                                onChange={handleDateChange}
                                className="w-full"
                            />
                            <Input
                                type="date"
                                name="endDate"
                                value={endDate}
                                onChange={handleDateChange}
                                className="w-full"
                            />
                        </div>
                    </div>
                    <div className="flex flex-col md:flex-row justify-end space-y-2 md:space-y-0 md:space-x-2 mt-4">
                        <Button onClick={fetchStores} className="w-full md:w-auto">Apply Filters</Button>
                        <Button onClick={fetchReportData} disabled={loading || !selectedStore} className="w-full md:w-auto">
                            Generate Report
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {loading && <p className="text-center py-4">Loading...</p>}
            {error && <p className="text-red-500 text-center py-4">{error}</p>}

            {monthlyData.length > 0 && (
                <Card className="shadow-md">
                    <CardContent className="p-4 md:p-6">
                        <h2 className="text-lg md:text-xl font-bold mb-4">Monthly Report for {selectedStore?.label}</h2>
                        <div className="h-[300px] md:h-[500px]">
                            <Chart type="bar" data={chartData} options={chartOptions} />
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default SalesPerformanceReport;
