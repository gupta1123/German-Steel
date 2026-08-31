"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Users, MapPin, Home, Search, RefreshCw, RotateCcw, ChevronRight, AlertCircle, LocateFixed } from 'lucide-react';
import { formatLocationTime, locationAge, sortEmployeesByLocationUpdate, type LocationMarker } from '@/lib/employee-locations';

const LeafletMap = dynamic(() => import('@/components/leaflet-map'), {
  ssr: false, loading: () => <div className="grid h-full place-items-center text-sm text-muted-foreground">Loading map…</div>,
});

export interface LocationEmployee {
  id: number; listId: string; name: string; position: string; location: string;
  visits: number; hasLocation?: boolean; locationTimestamp?: number | null;
}
export interface OverviewSectionProps {
  kpis: { totalVisits: number; activeEmployees: number; liveLocations: number };
  states: Array<{ id: number; name: string; employeeCount: number; color?: string }>;
  onStateSelect: (state: OverviewSectionProps['states'][number]) => void;
  markers: LocationMarker[];
  highlightedEmployee: LocationEmployee | null;
  selectedEmployeeMarkers: LocationMarker[];
  onResetView: () => void;
  mapCenter: [number, number]; mapZoom: number;
  onMarkerClick: (marker: LocationMarker) => void;
  onEmployeeSelect: (employee: LocationEmployee) => void;
  employeeList: LocationEmployee[];
  locationsLoading: boolean; locationsError: string | null; locationsSyncedAt: number | null;
  onRefreshLocations: () => void;
  journeyLoading: boolean; journeyError: string | null;
  journeySummary: { total: number; unmapped: number; hasHome: boolean };
  onRetryJourney: () => void;
  periodLabel: string; mapResetKey: number;
}

export default function OverviewSection(props: OverviewSectionProps) {
  const { kpis, states, onStateSelect, markers, highlightedEmployee, selectedEmployeeMarkers,
    onResetView, onMarkerClick, onEmployeeSelect, employeeList, locationsLoading, locationsError,
    locationsSyncedAt, onRefreshLocations, journeyLoading, journeyError, journeySummary,
    onRetryJourney, periodLabel, mapResetKey } = props;
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('all');
  const [freshness, setFreshness] = useState('all');
  const [mobileView, setMobileView] = useState<'map' | 'list'>('map');
  const [now, setNow] = useState(Date.now);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(timer); }, []);
  const cities = useMemo(() => [...new Set(employeeList.map(e => e.location.split(',')[0].trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [employeeList]);
  const filtered = useMemo(() => sortEmployeesByLocationUpdate(employeeList.filter(employee => {
    const recent = employee.hasLocation && locationAge(employee.locationTimestamp, now).fresh;
    return (!search.trim() || `${employee.name} ${employee.position} ${employee.location}`.toLowerCase().includes(search.trim().toLowerCase()))
      && (city === 'all' || employee.location.split(',')[0].trim() === city)
      && (freshness === 'all' || (freshness === 'recent' ? recent : freshness === 'missing' ? !employee.hasLocation : employee.hasLocation && !recent));
  })), [employeeList, search, city, freshness, now]);
  const ids = useMemo(() => new Set(filtered.map(employee => employee.id)), [filtered]);
  const selectedId = highlightedEmployee?.id;
  useEffect(() => { if (selectedId != null && !ids.has(selectedId)) onResetView(); }, [ids, selectedId, onResetView]);
  useEffect(() => {
    const row = listRef.current?.querySelector<HTMLButtonElement>(`[data-employee-id="${selectedId}"]`);
    if (row && listRef.current) listRef.current.scrollTop = Math.max(0, row.offsetTop - listRef.current.offsetTop - 8);
  }, [selectedId]);
  const visibleMarkers = useMemo(() => {
    const base = markers.filter(marker => ids.has(Number(marker.employeeId ?? marker.id)) && (selectedId == null || Number(marker.employeeId ?? marker.id) === selectedId));
    return selectedId != null && ids.has(selectedId) ? [...base, ...selectedEmployeeMarkers] : base;
  }, [markers, ids, selectedId, selectedEmployeeMarkers]);
  const knownCount = employeeList.filter(employee => employee.hasLocation).length;
  const chooseEmployee = (employee: LocationEmployee) => { onEmployeeSelect(employee); setMobileView('map'); };

  return <>
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {[{ label: 'Visits in period', value: kpis.totalVisits, icon: Calendar },
        { label: 'Employees with activity', value: kpis.activeEmployees, icon: Users },
        { label: 'Last-known locations', value: knownCount, icon: MapPin }].map(({ label, value, icon: Icon }) =>
        <div key={label} className="rounded-lg border bg-card px-3 py-3 sm:px-4">
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>{label}</span><Icon className="hidden h-4 w-4 shrink-0 sm:block" /></div>
          <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
        </div>)}
    </div>
    {states.length > 0 && <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-muted-foreground">Activity by state</span>
      {states.map(state => <button key={state.id} type="button" onClick={() => onStateSelect(state)} className="inline-flex items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
        {state.name}<span className="font-semibold tabular-nums">{state.employeeCount}</span><ChevronRight className="h-3 w-3" />
      </button>)}
    </div>}

    <section className="space-y-3" aria-label="Employee locations">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="text-sm font-semibold">Employee locations</h2><p className="mt-0.5 text-xs text-muted-foreground">Last-known positions · select an employee to see home and visits.</p></div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground" title={locationsSyncedAt ? formatLocationTime(locationsSyncedAt) : undefined}>
            {locationsLoading ? 'Refreshing…' : locationsError ? 'Refresh failed' : locationsSyncedAt ? `Synced ${new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' }).format(locationsSyncedAt)}` : 'Not synced'}
          </span>
          <Button size="sm" variant="outline" onClick={onRefreshLocations} disabled={locationsLoading} aria-label="Refresh employee locations"><RefreshCw className="h-3.5 w-3.5" /></Button>
          <Button size="sm" variant="outline" onClick={onResetView}><RotateCcw className="mr-1.5 h-3.5 w-3.5" />Reset view</Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1 sm:max-w-xs"><Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" /><Input type="search" aria-label="Search employees" placeholder="Search employees…" value={search} onChange={event => setSearch(event.target.value)} className="h-9 pl-8 text-sm" /></div>
        <Select value={city} onValueChange={setCity}><SelectTrigger aria-label="Assigned city" className="h-9 w-[160px]"><SelectValue placeholder="All assigned cities" /></SelectTrigger><SelectContent><SelectItem value="all">All assigned cities</SelectItem>{cities.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
        <Select value={freshness} onValueChange={setFreshness}><SelectTrigger aria-label="Location freshness" className="h-9 w-[170px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All locations</SelectItem><SelectItem value="recent">Updated &lt;15 min</SelectItem><SelectItem value="older">Older updates</SelectItem><SelectItem value="missing">No location</SelectItem></SelectContent></Select>
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} of {employeeList.length} employees</span>
      </div>
      {locationsError && <div role="alert" className="flex items-center gap-2 rounded-md border border-amber-300/50 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"><AlertCircle className="h-4 w-4 shrink-0" />{locationsError}</div>}
      <div className="flex gap-1 lg:hidden" aria-label="Location display">
        {(['map', 'list'] as const).map(mode => <Button key={mode} size="sm" variant={mobileView === mode ? 'default' : 'outline'} aria-pressed={mobileView === mode} onClick={() => setMobileView(mode)}>{mode === 'map' ? 'Map' : 'Employees'}</Button>)}
      </div>
      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className={`${mobileView === 'map' ? 'flex' : 'hidden'} min-w-0 flex-col overflow-hidden rounded-lg border bg-card lg:flex`}>
          <div className="flex min-h-10 shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-b px-3 py-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><LocateFixed className="h-3.5 w-3.5" />Last known</span>
            {selectedId != null && <><span className="inline-flex items-center gap-1.5"><Home className="h-3.5 w-3.5" />Home</span><span>1, 2, 3 · visits in order</span></>}
            <span className="ml-auto">{selectedId != null ? periodLabel : 'Latest available updates'}</span>
          </div>
          <div className="relative isolate h-[55dvh] min-h-[360px] grow lg:h-[calc(100dvh-350px)]">
            <div className="absolute inset-0">
              <LeafletMap center={props.mapCenter} zoom={props.mapZoom} markers={visibleMarkers} highlightedEmployee={highlightedEmployee as unknown as Record<string, unknown> | null} onMarkerClick={onMarkerClick} fitMarkers viewKey={`${selectedId ?? 'all'}:${selectedId != null ? periodLabel : ''}:${search}:${city}:${freshness}:${mapResetKey}`} />
            </div>
            {visibleMarkers.length === 0 && <div className="pointer-events-none absolute inset-0 z-[500] grid place-items-center p-6"><p role="status" className="max-w-sm rounded-lg border bg-card/95 px-4 py-3 text-center text-sm shadow-sm">{locationsLoading || journeyLoading ? 'Loading locations…' : selectedId != null ? 'No mapped locations for this employee in the selected period.' : filtered.length ? 'No last-known positions for these employees.' : 'No employees match your filters.'}</p></div>}
          </div>
          {selectedId != null && <div className="shrink-0 border-t px-3 py-2.5 text-xs" aria-live="polite">
            <div className="flex flex-wrap items-center justify-between gap-1"><span className="font-medium">{highlightedEmployee?.name}</span><span className="text-muted-foreground">{journeyLoading ? 'Loading home and visits…' : `${journeySummary.total} ${journeySummary.total === 1 ? 'visit' : 'visits'} · ${journeySummary.hasHome ? 'Home available' : 'No saved home location'}`}</span></div>
            {!journeyLoading && journeySummary.unmapped > 0 && <p className="mt-1 text-muted-foreground">{journeySummary.unmapped} visits have no valid coordinates. Numbering preserves their place in the sequence.</p>}
            {journeyError && <div role="alert" className="mt-1 flex items-center gap-2 text-destructive">{journeyError}<button type="button" className="underline" onClick={onRetryJourney}>Retry</button></div>}
            <p className="mt-1 text-muted-foreground">Nearby markers are spread apart for selection; connecting lines point to the recorded coordinates.</p>
          </div>}
        </div>
        <aside className={`${mobileView === 'list' ? 'flex' : 'hidden'} min-h-0 flex-col overflow-hidden rounded-lg border bg-card lg:flex`} aria-label="Employee location list">
          <div className="flex min-h-10 items-center justify-between border-b px-3 py-2"><h3 className="text-sm font-medium">Employees</h3><span className="text-xs text-muted-foreground">{filtered.filter(employee => employee.hasLocation).length} with GPS</span></div>
          <div ref={listRef} className="relative max-h-[65dvh] flex-1 divide-y overflow-y-auto lg:max-h-[calc(100dvh-310px)]">
            {filtered.length === 0 ? <p className="p-5 text-center text-sm text-muted-foreground">{search || city !== 'all' || freshness !== 'all' ? 'No employees match your filters.' : 'No employees available.'}</p> : filtered.map(employee => {
              const age = locationAge(employee.locationTimestamp, now);
              return <button key={employee.id} data-employee-id={employee.id} type="button" aria-pressed={selectedId === employee.id} onClick={() => chooseEmployee(employee)} className={`block w-full border-l-2 px-3 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring ${selectedId === employee.id ? 'border-l-primary bg-accent' : 'border-l-transparent hover:bg-muted/50'}`}>
                <div className="flex items-start gap-2.5"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted text-[11px] font-medium" aria-hidden="true">{employee.name.split(' ').filter(Boolean).slice(0, 2).map(part => part[0]).join('')}</span><div className="min-w-0 flex-1"><p className="truncate text-[13px] font-medium" title={employee.name}>{employee.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{employee.position}</p></div><ChevronRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" /></div>
                <p className="mt-2 truncate text-xs text-muted-foreground" title="Assigned city, not a GPS-derived address">Assigned: {employee.location || 'Not set'}</p>
                <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1 text-[11px]"><span title={formatLocationTime(employee.locationTimestamp)} className={`inline-flex items-center gap-1.5 ${employee.hasLocation && age.fresh ? 'text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground'}`}><span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${employee.hasLocation && age.fresh ? 'bg-emerald-500' : 'bg-muted-foreground/50'}`} />{employee.hasLocation ? age.label : 'No location available'}</span><span className="text-muted-foreground">{employee.visits} {employee.visits === 1 ? 'visit' : 'visits'}</span></div>
              </button>;
            })}
          </div>
          <p className="border-t px-3 py-2 text-[11px] text-muted-foreground">Visit counts: {periodLabel}. GPS refreshes every minute while this page is visible.</p>
        </aside>
      </div>
    </section>
  </>;
}

