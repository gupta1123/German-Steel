"use client";

import { Fragment, useEffect, useMemo, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Home, UserRound } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './location-map.css';
import { groupNearbyPoints, validCoordinates, type LocationMarker } from '@/lib/employee-locations';

interface LeafletMapProps {
  center: [number, number]; zoom: number;
  highlightedEmployee: Record<string, unknown> | null;
  markers?: LocationMarker[];
  onMarkerClick?: (marker: LocationMarker) => void;
  fitMarkers?: boolean;
  viewKey?: string;
}
const homeSvg = renderToStaticMarkup(<Home size={16} aria-hidden />);
const employeeSvg = renderToStaticMarkup(<UserRound size={16} aria-hidden />);
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
const markerLabel = (marker: LocationMarker) => marker.type === 'visit' ? `Visit ${marker.order ?? ''}: ${marker.name || 'Customer'}` : marker.type === 'house' ? marker.name || 'Home location' : `${marker.name || 'Employee'}: last-known location`;

function pointIcon(marker: LocationMarker) {
  const type = marker.type || 'live';
  const content = type === 'house' ? homeSvg : type === 'visit' ? escapeHtml(String(marker.order ?? 'V')) : employeeSvg;
  return L.divIcon({ className: 'location-marker',
    html: `<span class="location-marker-face location-marker-${type}" aria-label="${escapeHtml(markerLabel(marker))}">${content}</span>`,
    iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -20] });
}

function LocationDetails({ marker }: { marker: LocationMarker }) {
  return <div className="location-popup-content">
    <h3>{marker.name || 'Employee location'}</h3>
    <p className="location-popup-kind">{marker.type === 'house' ? 'Home location' : marker.type === 'visit' ? `Visit ${marker.order ?? ''} · ${marker.subtitle || ''}` : 'Last-known location'}</p>
    {marker.type !== 'visit' && marker.subtitle && <p>{marker.type === 'live' ? 'Updated: ' : ''}{marker.subtitle}</p>}
    {marker.tooltipLines?.map((line, index) => {
      const separator = line.indexOf(': ');
      return <div className="location-popup-row" key={index}><span>{separator < 0 ? '' : line.slice(0, separator)}</span><strong>{separator < 0 ? line : line.slice(separator + 2)}</strong></div>;
    })}
    <div className="location-popup-coordinate">Recorded coordinates: {marker.lat.toFixed(5)}, {marker.lng.toFixed(5)}{marker.coordinateSource ? ` · ${marker.coordinateSource}` : ''}</div>
    {marker.visitId != null && <a className="location-popup-link" href={`/dashboard/visits/${marker.visitId}`}>View visit details →</a>}
  </div>;
}

function MapViewport({ markers, center, zoom, fitMarkers, viewKey }: { markers: LocationMarker[]; center: [number, number]; zoom: number; fitMarkers: boolean; viewKey?: string }) {
  const map = useMap();
  // Timestamp-only refreshes preserve the user's pan and zoom.
  const geometry = markers.map(marker => `${marker.id}:${marker.lat}:${marker.lng}`).sort().join('|');
  useEffect(() => {
    const fit = () => {
      map.invalidateSize({ pan: false });
      if (fitMarkers && markers.length) {
        map.fitBounds(L.latLngBounds(markers.map(marker => [marker.lat, marker.lng] as [number, number])), { padding: [72, 72], maxZoom: 15, animate: false });
      } else map.setView(center, zoom, { animate: false });
    };
    fit();
    const observer = new ResizeObserver(() => { if (map.getContainer().clientWidth > 0) fit(); });
    observer.observe(map.getContainer());
    return () => observer.disconnect();
    // geometry represents marker positions, not incoming array identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, geometry, viewKey, fitMarkers, center[0], center[1], zoom]);
  return null;
}

function LocationLayers({ markers, focused, onMarkerClick }: { markers: LocationMarker[]; focused: boolean; onMarkerClick?: (marker: LocationMarker) => void }) {
  const [revision, setRevision] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const map = useMapEvents({
    zoomend: () => { setRevision(value => value + 1); setExpanded(null); },
    moveend: () => setRevision(value => value + 1),
    resize: () => setRevision(value => value + 1),
  });
  const groups = useMemo(() => groupNearbyPoints(markers.map(marker => {
    const point = map.latLngToLayerPoint([marker.lat, marker.lng]);
    return { marker, x: point.x, y: point.y };
  })), [markers, map, revision]);

  return <>{groups.map(group => {
    const groupKey = group.map(point => `${point.marker.type || 'live'}-${point.marker.id}`).sort().join('|');
    const centerPoint = L.point(group.reduce((sum, point) => sum + point.x, 0) / group.length, group.reduce((sum, point) => sum + point.y, 0) / group.length);
    const groupPosition = map.layerPointToLatLng(centerPoint);
    const spread = group.length > 1 && (focused || expanded === groupKey);
    if (group.length > 1 && !spread) {
      const label = `${group.length} nearby employee locations. Click to expand.`;
      return <Marker key={groupKey} position={groupPosition} title={label} alt={label}
        icon={L.divIcon({ className: 'location-marker', html: `<span class="location-cluster">${group.length}<small>people</small></span>`, iconSize: [46, 46], iconAnchor: [23, 23] })}
        eventHandlers={{ click: () => {
          const coordinates = new Set(group.map(point => `${point.marker.lat},${point.marker.lng}`));
          if (coordinates.size > 1 && map.getZoom() < 17) map.fitBounds(L.latLngBounds(group.map(point => [point.marker.lat, point.marker.lng] as [number, number])), { padding: [70, 70], maxZoom: 17, animate: false });
          setExpanded(groupKey);
        } }} />;
    }
    return <Fragment key={groupKey}>{group.map(({ marker }, index) => {
      // Spread hit targets, not source GPS. Lines terminate at the original points.
      const ring = Math.floor(index / 10);
      const countInRing = Math.min(10, group.length - ring * 10);
      const angle = ((index % 10) / countInRing) * Math.PI * 2 - Math.PI / 2;
      const radius = 48 + ring * 42;
      const display = spread ? map.layerPointToLatLng(centerPoint.add(L.point(Math.cos(angle) * radius, Math.sin(angle) * radius))) : L.latLng(marker.lat, marker.lng);
      const label = markerLabel(marker);
      return <Fragment key={`${marker.type || 'live'}-${marker.id}`}>
        {spread && <Polyline positions={[[marker.lat, marker.lng], [display.lat, display.lng]]} interactive={false} pathOptions={{ color: '#64748b', weight: 1.5, opacity: 0.65, dashArray: '3 3' }} />}
        <Marker position={display} icon={pointIcon(marker)} title={label} alt={label}
          eventHandlers={onMarkerClick ? { click: () => onMarkerClick(marker) } : undefined}>
          <Popup minWidth={180} maxWidth={280} className="employee-location-popup"><LocationDetails marker={marker} /></Popup>
        </Marker>
      </Fragment>;
    })}</Fragment>;
  })}</>;
}

export default function LeafletMap({ center, zoom, highlightedEmployee, markers = [], onMarkerClick, fitMarkers = false, viewKey }: LeafletMapProps) {
  const [tileError, setTileError] = useState(false);
  const [tileRetry, setTileRetry] = useState(0);
  const validMarkers = useMemo(() => markers.filter(marker => !String(marker.id).startsWith('no-location-') && validCoordinates(marker.lat, marker.lng))
    .map(marker => ({ ...marker, lat: Number(marker.lat), lng: Number(marker.lng) })), [markers]);
  return <div className="employee-location-map relative h-full w-full">
    <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
      <MapViewport markers={validMarkers} center={center} zoom={zoom} fitMarkers={fitMarkers} viewKey={viewKey} />
      <TileLayer key={tileRetry} url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        referrerPolicy="strict-origin-when-cross-origin" maxNativeZoom={19} maxZoom={20}
        eventHandlers={{ tileerror: () => setTileError(true) }} />
      <LocationLayers markers={validMarkers} focused={highlightedEmployee != null} onMarkerClick={onMarkerClick} />
    </MapContainer>
    {tileError && <div role="alert" className="absolute bottom-8 left-2 right-2 z-[600] flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 text-xs text-foreground shadow-sm">Some map tiles could not load.<button type="button" className="font-medium underline" onClick={() => { setTileError(false); setTileRetry(value => value + 1); }}>Retry map</button></div>}
  </div>;
}
