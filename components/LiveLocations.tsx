"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, MapPin, Users, Clock, RefreshCw, Navigation } from 'lucide-react';
import dynamic from 'next/dynamic';
import { apiService } from '@/lib/api';

// Dynamically import the map component to avoid SSR issues
const LeafletMap = dynamic(() => import("@/components/leaflet-map"), {
  ssr: false,
});

interface LiveLocation {
  id: number;
  empId: number;
  empName: string;
  latitude: number;
  longitude: number;
  updatedAt: string;
  updatedTime: string;
}

const LiveLocations: React.FC = () => {
  const [liveLocations, setLiveLocations] = useState<LiveLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<LiveLocation | null>(null);

  // Get auth data from localStorage
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;

  const fetchLiveLocations = useCallback(async () => {
    if (!token) {
      setError('Authentication token not found. Please log in.');
      return;
    }

    setIsRefreshing(true);
    setError(null);
    try {
      const data = await apiService.getAllEmployeeLocations();
      setLiveLocations(Array.isArray(data) ? data : []);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchLiveLocations();
    }
  }, [fetchLiveLocations]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!token) return;

    const interval = setInterval(() => {
      fetchLiveLocations();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [fetchLiveLocations, token]);

  const formatTime = (timeString: string) => {
    try {
      const [time] = timeString.split('.');
      return time;
    } catch {
      return timeString;
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const day = String(date.getDate()).padStart(2, '0');
      const month = date.toLocaleString('en-GB', { month: 'short' });
      const yearShort = String(date.getFullYear()).slice(-2);
      return `${day} ${month} '${yearShort}`;
    } catch {
      return dateString;
    }
  };

  const getTimeAgo = (dateString: string, timeString: string) => {
    try {
      const dateTime = new Date(`${dateString}T${timeString}`);
      const now = new Date();
      const diffMs = now.getTime() - dateTime.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch {
      return 'Unknown';
    }
  };

  const getStatusColor = (dateString: string, timeString: string) => {
    try {
      const dateTime = new Date(`${dateString}T${timeString}`);
      const now = new Date();
      const diffMs = now.getTime() - dateTime.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      
      if (diffMins <= 5) return 'bg-green-100 text-green-800 border-green-200';
      if (diffMins <= 30) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      return 'bg-red-100 text-red-800 border-red-200';
    } catch {
      return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusText = (dateString: string, timeString: string) => {
    try {
      const dateTime = new Date(`${dateString}T${timeString}`);
      const now = new Date();
      const diffMs = now.getTime() - dateTime.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      
      if (diffMins <= 5) return 'Live';
      if (diffMins <= 30) return 'Recent';
      return 'Stale';
    } catch {
      return 'Unknown';
    }
  };

  // Prepare markers for the map
  const markers = liveLocations.map(location => ({
    id: location.id,
    name: location.empName,
    lat: location.latitude,
    lng: location.longitude,
    subtitle: `${formatDate(location.updatedAt)} ${formatTime(location.updatedTime)}`
  }));

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-semibold text-foreground">Live Employee Locations</CardTitle>
              <p className="text-sm text-muted-foreground">Real-time tracking of employee locations</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchLiveLocations}
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Refreshing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading && (
            <div className="flex justify-center items-center py-12">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading live locations...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
              <div className="flex items-center justify-between">
                <p><strong>Error:</strong> {error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setError(null);
                    fetchLiveLocations();
                  }}
                >
                  Try Again
                </Button>
              </div>
            </div>
          )}

          {!isLoading && !error && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-muted/30">
                  <CardContent className="pt-6">
                    <div className="flex items-center space-x-2">
                      <Users className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-sm font-medium text-foreground">Total Employees</p>
                        <p className="text-2xl font-bold text-foreground">{liveLocations.length}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-muted/30">
                  <CardContent className="pt-6">
                    <div className="flex items-center space-x-2">
                      <MapPin className="h-5 w-5 text-green-500" />
                      <div>
                        <p className="text-sm font-medium text-foreground">Live Locations</p>
                        <p className="text-2xl font-bold text-foreground">
                          {liveLocations.filter(loc => {
                            const diffMs = new Date().getTime() - new Date(`${loc.updatedAt}T${loc.updatedTime}`).getTime();
                            return Math.floor(diffMs / (1000 * 60)) <= 5;
                          }).length}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-muted/30">
                  <CardContent className="pt-6">
                    <div className="flex items-center space-x-2">
                      <Clock className="h-5 w-5 text-blue-500" />
                      <div>
                        <p className="text-sm font-medium text-foreground">Last Updated</p>
                        <p className="text-sm font-medium text-foreground">
                          {liveLocations.length > 0 ? 
                            getTimeAgo(liveLocations[0].updatedAt, liveLocations[0].updatedTime) : 
                            'No data'
                          }
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Map Section */}
              {liveLocations.length > 0 && (
                <div className="space-y-4">
                  <div className="rounded-lg border bg-card">
                    <div className="p-4 border-b">
                      <h3 className="text-lg font-semibold text-foreground">Location Map</h3>
                      <p className="text-sm text-muted-foreground">Interactive map showing all employee locations</p>
                    </div>
                    <div className="h-96 w-full">
                      <LeafletMap
                        markers={markers}
                        center={[22.5726, 88.3639]} // Default to Kolkata
                        zoom={5}
                        highlightedEmployee={selectedEmployee as Record<string, unknown> | null}
                        onMarkerClick={(marker) => {
                          const location = liveLocations.find(loc => loc.id === marker.id);
                          if (location) setSelectedEmployee(location);
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Employee List */}
              <div className="space-y-4">
                <div className="rounded-lg border bg-card">
                  <div className="p-4 border-b">
                    <h3 className="text-lg font-semibold text-foreground">Employee Locations</h3>
                    <p className="text-sm text-muted-foreground">Detailed list of all employee locations</p>
                  </div>
                  <div className="overflow-x-auto">
                    {liveLocations.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No live location data available
                      </div>
                    ) : (
                      <div className="space-y-2 p-4">
                        {liveLocations.map((location) => (
                          <div
                            key={location.id}
                            className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                              selectedEmployee?.id === location.id 
                                ? 'bg-primary/10 border-primary' 
                                : 'bg-card hover:bg-muted/50'
                            }`}
                            onClick={() => setSelectedEmployee(location)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                                  {location.empName.split(' ').map(n => n[0]).join('').toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-medium text-foreground">{location.empName}</p>
                                  <p className="text-sm text-muted-foreground">
                                    ID: {location.empId} • {formatDate(location.updatedAt)} {formatTime(location.updatedTime)}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Badge className={getStatusColor(location.updatedAt, location.updatedTime)}>
                                  {getStatusText(location.updatedAt, location.updatedTime)}
                                </Badge>
                                <div className="text-right">
                                  <p className="text-sm font-medium text-foreground">
                                    {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {getTimeAgo(location.updatedAt, location.updatedTime)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Selected Employee Details */}
              {selectedEmployee && (
                <Card className="bg-muted/30">
                  <CardContent className="pt-6">
                    <div className="flex items-start space-x-3">
                      <Navigation className="h-5 w-5 text-primary mt-0.5" />
                      <div className="space-y-2">
                        <h4 className="font-medium text-foreground">Selected Employee Details</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <p><strong>Name:</strong> {selectedEmployee.empName}</p>
                            <p><strong>Employee ID:</strong> {selectedEmployee.empId}</p>
                            <p><strong>Status:</strong> 
                              <Badge className={`ml-2 ${getStatusColor(selectedEmployee.updatedAt, selectedEmployee.updatedTime)}`}>
                                {getStatusText(selectedEmployee.updatedAt, selectedEmployee.updatedTime)}
                              </Badge>
                            </p>
                          </div>
                          <div>
                            <p><strong>Coordinates:</strong> {selectedEmployee.latitude}, {selectedEmployee.longitude}</p>
                            <p><strong>Last Updated:</strong> {formatDate(selectedEmployee.updatedAt)} {formatTime(selectedEmployee.updatedTime)}</p>
                            <p><strong>Time Ago:</strong> {getTimeAgo(selectedEmployee.updatedAt, selectedEmployee.updatedTime)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LiveLocations;
