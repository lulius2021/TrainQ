// src/components/cardio/CardioMap.tsx
// Leaflet map with route polyline for cardio tracking

import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { GpsPoint } from "../../types/cardio";
import { Layers, Crosshair } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { getCurrentPosition } from "../../native/geolocation";

interface CardioMapProps {
  points: GpsPoint[];
  isTracking: boolean;
  className?: string;
  controlsTopOffset?: number;
}

// Tile URL templates
const DARK_TILES =
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const LIGHT_TILES =
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
// ArcGIS World Imagery uses {z}/{y}/{x} (row-then-column, reversed from standard).
// maxNativeZoom: 18 prevents requesting tiles beyond level 18.
const SATELLITE_TILES =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const SATELLITE_ATTRIBUTION =
  "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGS, and the GIS User Community";

type MapStyle = "street" | "satellite" | "dark";

const STYLE_LABELS: Record<MapStyle, string> = {
  street: "Karte",
  satellite: "Satellit",
  dark: "Dunkel",
};

const STYLE_CYCLE: MapStyle[] = ["street", "satellite", "dark"];

const CardioMap: React.FC<CardioMapProps> = ({
  points,
  isTracking,
  className,
  controlsTopOffset,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const userDotRef = useRef<L.CircleMarker | null>(null);
  const pulseCircleRef = useRef<L.CircleMarker | null>(null);

  const [mapStyle, setMapStyle] = useState<MapStyle>("street");
  const [followMode, setFollowMode] = useState(true);

  // Reactive theme — resolves "system" to effective mode via the ThemeProvider
  const { mode } = useTheme();
  // Treat "system" as dark (the app defaults to dark), unless mode is explicitly "light"
  const isDark = mode !== "light";

  // Derive tile URL based on current style + theme
  const getTileUrl = (style: MapStyle): string => {
    if (style === "satellite") return SATELLITE_TILES;
    if (style === "dark") return DARK_TILES;
    return LIGHT_TILES;
  };

  const getTileOptions = (style: MapStyle): L.TileLayerOptions => {
    const base: L.TileLayerOptions = { maxZoom: 20 };
    if (style === "satellite") {
      return {
        ...base,
        maxNativeZoom: 18,
        attribution: SATELLITE_ATTRIBUTION,
      };
    }
    return base;
  };

  const [gpsSearching, setGpsSearching] = useState(true);

  // ─── Initialize map (no default view — centered on user position) ───────────
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
    });

    // Start with a world view while we wait for GPS
    map.setView([20, 0], 2);

    const tiles = L.tileLayer(
      getTileUrl(mapStyle),
      getTileOptions(mapStyle),
    ).addTo(map);

    const polyline = L.polyline([], {
      color: "#3B82F6",
      weight: 4,
      opacity: 0.9,
    }).addTo(map);

    mapRef.current = map;
    polylineRef.current = polyline;
    tileLayerRef.current = tiles;

    // Capacitor WKWebView needs multiple invalidateSize calls — the layout
    // isn't always finalized when requestAnimationFrame fires.
    requestAnimationFrame(() => map.invalidateSize());
    setTimeout(() => { if (mapRef.current) mapRef.current.invalidateSize(); }, 150);
    setTimeout(() => { if (mapRef.current) mapRef.current.invalidateSize(); }, 600);

    return () => {
      map.remove();
      mapRef.current = null;
      polylineRef.current = null;
      markerRef.current = null;
      tileLayerRef.current = null;
      userDotRef.current = null;
      pulseCircleRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Helper: place / move the "you are here" blue circle marker ─────────────
  function _placeUserDot(map: L.Map, latlng: L.LatLngTuple) {
    if (userDotRef.current) {
      userDotRef.current.setLatLng(latlng);
      pulseCircleRef.current?.setLatLng(latlng);
    } else {
      // Outer pulse ring
      pulseCircleRef.current = L.circleMarker(latlng, {
        radius: 14,
        fillColor: "#3B82F6",
        fillOpacity: 0.2,
        color: "#3B82F6",
        weight: 1,
        opacity: 0.5,
        className: "cardio-pulse-ring",
      }).addTo(map);

      // Inner solid dot
      userDotRef.current = L.circleMarker(latlng, {
        radius: 8,
        fillColor: "#3B82F6",
        fillOpacity: 1,
        color: "#ffffff",
        weight: 2.5,
      }).addTo(map);
    }
  }

  // ─── Switch tile layer when style or theme changes ───────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;

    if (tileLayerRef.current) {
      tileLayerRef.current.remove();
    }
    const newTiles = L.tileLayer(
      getTileUrl(mapStyle),
      getTileOptions(mapStyle),
    ).addTo(mapRef.current);
    tileLayerRef.current = newTiles;
  }, [mapStyle, isDark]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Update polyline + marker when points change ─────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !polylineRef.current) return;

    const latLngs = points.map((p) => [p.lat, p.lng] as L.LatLngTuple);
    polylineRef.current.setLatLngs(latLngs);

    if (latLngs.length > 0) {
      setGpsSearching(false);
      const last = latLngs[latLngs.length - 1];

      // Move / create the route-end marker (distinct from the blue user dot)
      if (markerRef.current) {
        markerRef.current.setLatLng(last);
      } else {
        markerRef.current = L.circleMarker(last, {
          radius: 6,
          fillColor: "#22c55e",
          fillOpacity: 1,
          color: "#fff",
          weight: 2,
        }).addTo(mapRef.current);
      }

      // Move the "you are here" dot to latest GPS fix
      _placeUserDot(mapRef.current, last);

      // Auto-pan in follow mode or when actively tracking
      if (isTracking && followMode) {
        mapRef.current.panTo(last, { animate: true, duration: 0.5 });
      }

      // Auto-fit on the first few points
      if (latLngs.length <= 3) {
        mapRef.current.fitBounds(polylineRef.current.getBounds(), {
          padding: [50, 50],
          maxZoom: 17,
        });
      }
    }
  }, [points, isTracking, followMode]);

  // ─── Re-center on user position ("Follow" button handler) ────────────────────
  const handleFollow = async () => {
    setFollowMode(true);
    if (!mapRef.current) return;

    // Prefer latest tracked point
    if (points.length > 0) {
      const last = points[points.length - 1];
      mapRef.current.setView([last.lat, last.lng], 16, { animate: true });
      return;
    }

    // Fall back to fresh GPS fix
    const pos = await getCurrentPosition();
    if (pos && mapRef.current) {
      mapRef.current.setView([pos.lat, pos.lng], 15, { animate: true });
      _placeUserDot(mapRef.current, [pos.lat, pos.lng]);
    }
  };

  // Disable follow mode when user manually drags the map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const onDrag = () => setFollowMode(false);
    map.on("dragstart", onDrag);
    return () => { map.off("dragstart", onDrag); };
  }, [mapRef.current]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Cycle map style: street → satellite → dark ──────────────────────────────
  const cycleMapStyle = () => {
    setMapStyle((prev) => {
      const idx = STYLE_CYCLE.indexOf(prev);
      return STYLE_CYCLE[(idx + 1) % STYLE_CYCLE.length];
    });
  };

  return (
    <div className={`relative ${className || ""}`} style={{ isolation: "isolate" }}>
      {/* Map container */}
      <div
        ref={containerRef}
        style={{ width: "100%", height: "100%", minHeight: 200 }}
      />

      {/* GPS searching overlay */}
      {gpsSearching && isTracking && points.length === 0 && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none"
          style={{ zIndex: 9998, background: "rgba(0,0,0,0.45)" }}
        >
          <div className="w-10 h-10 rounded-full border-4 border-blue-400 border-t-transparent animate-spin" />
          <span className="text-white text-sm font-semibold drop-shadow-md">GPS wird gesucht...</span>
        </div>
      )}

      {/* Control buttons — outside leaflet container so z-index works */}
      <div
        className="absolute right-3 flex flex-col gap-2"
        style={{ zIndex: 9999, top: controlsTopOffset ?? 12 }}
      >
        {/* Map style toggle */}
        <div className="flex flex-col items-center">
          <button
            onClick={cycleMapStyle}
            className="w-11 h-11 rounded-xl flex items-center justify-center shadow-xl border border-white/30 active:scale-95 transition-transform"
            style={{
              backgroundColor:
                mapStyle !== "street"
                  ? "rgba(59,130,246,0.85)"
                  : "rgba(0,0,0,0.65)",
              backdropFilter: "blur(10px)",
            }}
          >
            <Layers
              size={20}
              className={mapStyle !== "street" ? "text-white" : "text-gray-200"}
            />
          </button>
          <span
            className="mt-0.5 text-[10px] font-semibold drop-shadow-md"
            style={{ color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}
          >
            {STYLE_LABELS[mapStyle]}
          </span>
        </div>

        {/* Follow / re-center button */}
        <div className="flex flex-col items-center">
          <button
            onClick={handleFollow}
            className="w-11 h-11 rounded-xl flex items-center justify-center shadow-xl border active:scale-95 transition-transform"
            style={{
              backgroundColor: followMode
                ? "rgba(59,130,246,0.85)"
                : "rgba(0,0,0,0.65)",
              backdropFilter: "blur(10px)",
              borderColor: followMode
                ? "rgba(59,130,246,0.6)"
                : "rgba(255,255,255,0.3)",
            }}
          >
            <Crosshair
              size={20}
              className={followMode ? "text-white" : "text-gray-200"}
            />
          </button>
          <span
            className="mt-0.5 text-[10px] font-semibold drop-shadow-md"
            style={{ color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}
          >
            Follow
          </span>
        </div>
      </div>
    </div>
  );
};

export default CardioMap;
