// src/components/cardio/CardioMap.tsx
// Leaflet map with route polyline for cardio tracking

import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { GpsPoint } from "../../types/cardio";

interface CardioMapProps {
  points: GpsPoint[];
  isTracking: boolean;
  className?: string;
}

const DARK_TILES = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const LIGHT_TILES = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

const CardioMap: React.FC<CardioMapProps> = ({ points, isTracking, className }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);

  const isDark =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
      dragging: true,
      scrollWheelZoom: false,
    }).setView([51.1657, 10.4515], 13); // Default: Germany center

    L.tileLayer(isDark ? DARK_TILES : LIGHT_TILES, {
      maxZoom: 19,
    }).addTo(map);

    const polyline = L.polyline([], {
      color: "#3B82F6",
      weight: 4,
      opacity: 0.9,
    }).addTo(map);

    mapRef.current = map;
    polylineRef.current = polyline;

    return () => {
      map.remove();
      mapRef.current = null;
      polylineRef.current = null;
      markerRef.current = null;
    };
  }, [isDark]);

  // Update polyline + marker when points change
  useEffect(() => {
    if (!mapRef.current || !polylineRef.current) return;

    const latLngs = points.map((p) => [p.lat, p.lng] as L.LatLngTuple);
    polylineRef.current.setLatLngs(latLngs);

    if (latLngs.length > 0) {
      const last = latLngs[latLngs.length - 1];

      // Current position marker
      if (markerRef.current) {
        markerRef.current.setLatLng(last);
      } else {
        markerRef.current = L.circleMarker(last, {
          radius: 8,
          fillColor: "#3B82F6",
          fillOpacity: 1,
          color: "#fff",
          weight: 2,
        }).addTo(mapRef.current);
      }

      // Auto-pan to current position while tracking
      if (isTracking) {
        mapRef.current.panTo(last, { animate: true, duration: 0.5 });
      }

      // Fit bounds on first few points
      if (latLngs.length <= 3) {
        mapRef.current.fitBounds(polylineRef.current.getBounds(), { padding: [30, 30] });
      }
    }
  }, [points, isTracking]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: "100%", height: "100%", minHeight: 200 }}
    />
  );
};

export default CardioMap;
