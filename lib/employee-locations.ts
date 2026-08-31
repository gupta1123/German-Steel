/** Pure location rules shared by the map, roster and regression tests. */
export interface LocationMarker {
  id: number | string;
  employeeId?: number;
  name?: string;
  lat: number;
  lng: number;
  type?: 'live' | 'house' | 'visit';
  subtitle?: string;
  tooltipLines?: string[];
  order?: number;
  updatedAt?: number | null;
  visitId?: number;
  coordinateSource?: string;
}

export function validCoordinates(lat: unknown, lng: unknown): boolean {
  if (lat == null || lng == null || lat === '' || lng === '') return false;
  const a = Number(lat), b = Number(lng);
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180 && !(a === 0 && b === 0);
}

// The API supplies Indian local date/time without an offset. Do not let the
// viewing device's timezone move a GPS update into another day.
export function locationTimestamp(date?: string | null, time?: string | null): number | null {
  if (!date) return null;
  const raw = date.includes('T') ? date : `${date}T${time || '00:00:00'}`;
  const zoned = /(?:Z|[+-]\d{2}:\d{2})$/i.test(raw) ? raw : `${raw}+05:30`;
  const value = Date.parse(zoned);
  return Number.isFinite(value) ? value : null;
}

export function locationAge(timestamp: number | null | undefined, now = Date.now()) {
  if (timestamp == null || !Number.isFinite(timestamp) || timestamp > now + 60_000) {
    return { label: 'Update time unavailable', fresh: false };
  }
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60_000));
  const age = minutes < 1 ? 'just now' : minutes < 60 ? `${minutes} min ago` : minutes < 1440 ? `${Math.floor(minutes / 60)} hr ago` : `${Math.floor(minutes / 1440)} days ago`;
  return { label: `Updated ${age}`, fresh: minutes < 15 };
}

export function formatLocationTime(timestamp: number | null | undefined): string {
  return timestamp == null ? 'Time unavailable' : new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(timestamp) + ' IST';
}

export function latestLocationMarkers(rows: Array<{ empId: number; empName: string; latitude: number; longitude: number; updatedAt: string; updatedTime: string }>): LocationMarker[] {
  const latest = new Map<number, LocationMarker>();
  for (const row of rows) {
    if (!validCoordinates(row.latitude, row.longitude)) continue;
    const updatedAt = locationTimestamp(row.updatedAt, row.updatedTime);
    const previous = latest.get(row.empId);
    if (previous && (previous.updatedAt ?? -Infinity) >= (updatedAt ?? -Infinity)) continue;
    latest.set(row.empId, { id: row.empId, employeeId: row.empId, name: row.empName,
      lat: Number(row.latitude), lng: Number(row.longitude), type: 'live', updatedAt,
      subtitle: formatLocationTime(updatedAt) });
  }
  return [...latest.values()].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

interface JourneyPoint {
  id: number; employeeId: number; employeeName: string; storeName: string;
  lat: number; lng: number; coordinateSource: string; visitDate: string;
  checkinDate?: string | null; checkinTime?: string | null;
  checkoutDate?: string | null; checkoutTime?: string | null;
  purpose?: string | null; city?: string | null; state?: string | null; country?: string | null;
}

export function journeyLocationMarkers(visits: JourneyPoint[], start: string, end: string) {
  const unique = new Map<number, JourneyPoint>();
  for (const visit of visits) {
    const day = (visit.checkinDate || visit.visitDate || '').slice(0, 10);
    if (day >= start && day <= end) unique.set(visit.id, visit);
  }
  const ordered = [...unique.values()].sort((a, b) =>
    (locationTimestamp(a.checkinDate || a.visitDate, a.checkinTime) ?? Infinity) -
    (locationTimestamp(b.checkinDate || b.visitDate, b.checkinTime) ?? Infinity) || a.id - b.id);
  const markers: LocationMarker[] = [];
  ordered.forEach((visit, index) => {
    if (!validCoordinates(visit.lat, visit.lng)) return;
    const place = [visit.city, visit.state, visit.country].filter(Boolean).join(', ');
    markers.push({ id: `visit-${visit.id}`, visitId: visit.id, employeeId: visit.employeeId,
      name: visit.storeName || 'Visit', lat: Number(visit.lat), lng: Number(visit.lng), type: 'visit', order: index + 1,
      coordinateSource: visit.coordinateSource, subtitle: visit.purpose || 'Visit',
      tooltipLines: [
        `Check-in: ${formatLocationTime(locationTimestamp(visit.checkinDate || visit.visitDate, visit.checkinTime))}`,
        `Check-out: ${visit.checkoutDate ? formatLocationTime(locationTimestamp(visit.checkoutDate, visit.checkoutTime)) : 'Not recorded'}`,
        ...(place ? [`Customer address: ${place}`] : []),
      ] });
  });
  return { markers, total: ordered.length, unmapped: ordered.length - markers.length };
}

/** Group nearby screen points, without changing the underlying GPS coordinates. */
export function groupNearbyPoints<T extends { x: number; y: number }>(points: T[], distance = 44): T[][] {
  const groups: T[][] = [];
  for (const point of points) {
    const matches = groups.filter(group => group.some(other => Math.hypot(point.x - other.x, point.y - other.y) < distance));
    if (!matches.length) groups.push([point]);
    else {
      matches[0].push(point);
      for (const group of matches.slice(1)) { matches[0].push(...group); groups.splice(groups.indexOf(group), 1); }
    }
  }
  return groups;
}
