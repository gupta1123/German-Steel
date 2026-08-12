"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Heading, Text } from "@/components/ui/typography";
import { Calendar, Users, MapPin, Building, Search } from "lucide-react";

const LeafletMap = dynamic(() => import("@/components/leaflet-map"), { ssr: false });

const getNumericId = (value: unknown): number | null => {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return null;
};

export interface OverviewSectionProps {
  kpis: { totalVisits: number; activeEmployees: number; liveLocations: number };
  states: Array<{ id: number; name: string; employeeCount: number; color?: string }>;
  onStateSelect: (state: { id: number; name: string; employeeCount: number; color?: string }) => void;
  markers: Record<string, unknown>[];
  highlightedEmployee: Record<string, unknown> | null;
  selectedEmployeeMarkers: Record<string, unknown>[];
  onResetView: () => void;
  mapCenter: [number, number];
  mapZoom: number;
  onMarkerClick: (marker: Record<string, unknown>) => void;
  onEmployeeSelect: (employee: Record<string, unknown>) => void;
  employeeList: Record<string, unknown>[];
  showVisitLocations?: boolean;
  onShowVisitLocations?: () => void;
}

export default function OverviewSection(props: OverviewSectionProps) {
  const {
    kpis,
    states,
    onStateSelect,
    markers,
    highlightedEmployee,
    selectedEmployeeMarkers,
    onResetView,
    mapCenter,
    mapZoom,
    onMarkerClick,
    onEmployeeSelect,
    employeeList,
    showVisitLocations,
    onShowVisitLocations,
  } = props;

  const [searchQuery, setSearchQuery] = useState("");

  // Filter employees based on search query
  const filteredEmployeeList = useMemo(() => {
    if (!searchQuery.trim()) {
      return employeeList;
    }
    
    const query = searchQuery.toLowerCase().trim();
    return employeeList.filter((employee) => {
      const name = String(employee.name || "").toLowerCase();
      const location = String(employee.location || "").toLowerCase();
      const position = String(employee.position || "").toLowerCase();
      
      return name.includes(query) || location.includes(query) || position.includes(query);
    });
  }, [employeeList, searchQuery]);

  const highlightedEmployeeId =
    highlightedEmployee == null
      ? null
      : getNumericId((highlightedEmployee as { id?: unknown }).id) ??
        getNumericId((highlightedEmployee as { listId?: unknown }).listId) ??
        getNumericId((highlightedEmployee as { employeeId?: unknown }).employeeId);

  const activeMarkers = highlightedEmployeeId != null
    ? markers.filter((marker) => {
        const markerData = marker as { employeeId?: unknown; id?: unknown };
        const markerId =
          getNumericId(markerData.employeeId) ?? getNumericId(markerData.id);
        return markerId === highlightedEmployeeId;
      })
    : markers;

  const combinedMarkers = [...activeMarkers, ...selectedEmployeeMarkers];
  const visitMarkerCount = selectedEmployeeMarkers.filter((m) => (m as { type?: unknown }).type === "visit").length;

  return (
    <>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Total Visits</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Heading as="p" size="2xl" weight="bold">
              {kpis.totalVisits}
            </Heading>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Active Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Heading as="p" size="2xl" weight="bold">
              {kpis.activeEmployees}
            </Heading>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Live Locations</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Heading as="p" size="2xl" weight="bold">
              {kpis.liveLocations}
            </Heading>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Heading as="h2" size="2xl" weight="semibold">
          State-wise Employee Distribution
        </Heading>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {states.map((state) => (
            <Card
              key={state.id}
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => onStateSelect(state)}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle>{state.name}</CardTitle>
                <Building className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <Heading as="p" size="xl" weight="bold">
                  {state.employeeCount}
                </Heading>
                <Text size="xs" tone="muted">Employees working</Text>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <Heading as="h2" size="2xl" weight="semibold">
          Live Employee Locations
        </Heading>
        <div className="flex flex-col items-center justify-between gap-4 lg:flex-row">
          <div className="flex flex-col gap-2">
            <Text tone="muted">
              Click on an employee to zoom to their location
              {highlightedEmployee && (
                <span className="ml-2 text-sm font-medium text-primary">
                  • Showing {activeMarkers.length + selectedEmployeeMarkers.length} locations
                  {visitMarkerCount > 0 && (
                    <span className="ml-1">({visitMarkerCount} visits)</span>
                  )}
                </span>
              )}
            </Text>
          </div>
          <Button variant="outline" size="sm" onClick={onResetView}>Reset View</Button>
        </div>
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="flex-1">
            <Card className="h-[750px] overflow-hidden rounded-xl">
              <LeafletMap
                center={mapCenter}
                zoom={mapZoom}
                highlightedEmployee={highlightedEmployee as { id: number | string; name?: string; lat: number; lng: number } | null}
                markers={(() => {
                  console.log('=== LEAFLET MAP MARKERS DEBUG ===');
                  console.log('Filtered main markers:', activeMarkers);
                  console.log('Selected employee markers:', selectedEmployeeMarkers);
                  console.log('Combined markers for map:', combinedMarkers);
                  return combinedMarkers as Array<{ id: number | string; name?: string; lat: number; lng: number; subtitle?: string; type?: "live" | "house" | "visit"; tooltipLines?: string[]; employeeId?: number }>;
                })()}
                onMarkerClick={onMarkerClick as (marker: { id: number | string; name?: string; lat: number; lng: number }) => void}
              />
            </Card>
          </div>

          <div className="w-full lg:w-96">
            <Card className="flex h-[750px] flex-col overflow-hidden rounded-xl">
              <CardHeader className="border-b space-y-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="h-5 w-5" />
                  <span>Active Employees</span>
                  <Badge variant="secondary" className="ml-auto">
                    {employeeList.length} online
                  </Badge>
                </CardTitle>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search employees..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-0">
                <div className="divide-y">
                  {filteredEmployeeList.length === 0 ? (
                    <div className="p-8 text-center">
                      <Text tone="muted">No employees found matching &quot;{searchQuery}&quot;</Text>
                    </div>
                  ) : (
                    filteredEmployeeList.map((employee) => (
                    <button
                      type="button"
                      key={String(employee.listId)}
                      className={`w-full p-4 text-left transition-colors ${
                        highlightedEmployee?.listId === employee.listId
                          ? "border-l-4 border-primary bg-accent"
                          : "hover:bg-accent/50"
                      }`}
                      onClick={() => onEmployeeSelect(employee)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="h-10 w-10 rounded-xl border-2 border-dashed bg-muted" />
                            <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card bg-green-500" />
                          </div>
                          <div>
                            <Heading as="p" size="md" className="text-foreground">
                              {String(employee.name)}
                            </Heading>
                            <Text size="sm" tone="muted">{String(employee.position)}</Text>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            <span>{String(employee.location).split(",")[0]}</span>
                          </div>
                          <Text as="div" size="xs" tone="muted" className="mt-1">
                            {String(employee.formattedLastUpdated)}
                          </Text>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs capitalize">
                            {String(employee.status)}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {String(employee.visits)} visits
                          </Badge>
                        </div>
                        {/* Journey now auto-loads on click; no intermediate action needed */}
                      </div>
                    </button>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}

