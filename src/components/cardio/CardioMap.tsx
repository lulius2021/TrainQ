// src/components/cardio/CardioMap.tsx
// Leaflet map with route polyline for cardio tracking

import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { GpsPoint } from "../../types/cardio";
import { Layers } from "lucide-react";

interface CardioMapProps {
  points: GpsPoint[];
  isTracking: boolean;
  className?: string;
}

const DARK_TILES = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const LIGHT_TILES = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
const SATELLITE_TILES = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

const CardioMap: React.FC<CardioMapProps> = ({ points, isTracking, className }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const [mapStyle, setMapStyle] = useState<"street" | "satellite">("street");

  const isDark =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;

  const getTileUrl = (style: "street" | "satellite") => {
    if (style === "satellite") return SATELLITE_TILES;
    return isDark ? DARK_TILES : LIGHT_TILES;
  };

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
      dragging: true,
      touchZoom: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      boxZoom: false,
    }).setView([51.1657, 10.4515], 13);

    const tiles = L.tileLayer(getTileUrl(mapStyle), {
      maxZoom: 19,
    }).addTo(map);

    const polyline = L.polyline([], {
      color: "#3B82F6",
      weight: 4,
      opacity: 0.9,
    }).addTo(map);

    mapRef.current = map;
    polylineRef.current = polyline;
    tileLayerRef.current = tiles;

    // Fix Leaflet size calculation when container uses flex layout
    requestAnimationFrame(() => {
      map.invalidateSize();
    });

    return () => {
      map.remove();
      mapRef.current = null;
      polylineRef.current = null;
      markerRef.current = null;
      tileLayerRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Switch tile layer when mapStyle changes
  useEffect(() => {
    if (!mapRef.current) return;

    if (tileLayerRef.current) {
      tileLayerRef.current.remove();
    }
    const newTiles = L.tileLayer(getTileUrl(mapStyle), { maxZoom: 19 }).addTo(mapRef.current);
    tileLayerRef.current = newTiles;
  }, [mapStyle, isDark]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update polyline + marker when points change
  useEffect(() => {
    if (!mapRef.current || !polylineRef.current) return;

    const latLngs = points.map((p) => [p.lat, p.lng] as L.LatLngTuple);
    polylineRef.current.setLatLngs(latLngs);

    if (latLngs.length > 0) {
      const last = latLngs[latLngs.length - 1];

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

      if (isTracking) {
        mapRef.current.panTo(last, { animate: true, duration: 0.5 });
      }

      if (latLngs.length <= 3) {
        mapRef.current.fitBounds(polylineRef.current.getBounds(), { padding: [30, 30] });
      }
    }
  }, [points, isTracking]);

  const cycleMapStyle = () => {
    setMapStyle((prev) => (prev === "street" ? "satellite" : "street"));
  };

  return (
    <div className={`relative ${className || ""}`}>
      {/* Map container */}
      <div
        ref={containerRef}
        style={{ width: "100%", height: "100%", minHeight: 200 }}
      />
      {/* Map style toggle — positioned OUTSIDE leaflet container so z-index works */}
      <div className="absolute top-3 right-3" style={{ zIndex: 9999 }}>
        <button
          onClick={cycleMapStyle}
          className="w-10 h-10 rounded-lg flex items-center justify-center shadow-lg border border-white/20"
          style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
        >
          <Layers size={18} className={mapStyle === "satellite" ? "text-blue-400" : "text-white"} />
        </button>
        <div className="mt-1 text-center">
          <span className="text-[10px] font-medium text-white drop-shadow-md">
            {mapStyle === "satellite" ? "Satellit" : "Karte"}
          </span>
        </div>
      </div>
    </div>
  );
};

export default CardioMap;
