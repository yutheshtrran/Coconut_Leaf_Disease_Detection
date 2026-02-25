import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import { useState, useEffect } from "react";
import { Loader, AlertCircle } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import * as farmService from "../services/farmService";
import API from "../services/api";

// Fix default marker icon issue in Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Validate that coordinates are within Sri Lanka's bounds (with some buffer)
const isValidSriLankaCoordinate = (lat, lng) => {
  const minLat = 5.0;
  const maxLat = 9.0;
  const minLng = 79.5;
  const maxLng = 83.0;
  return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
};

// Parse location strings
const parseLocation = (locationString) => {
  if (!locationString) return null;
  try {
    const degRegex = /(-?\d+\.?\d*)\s*°?\s*([NS])[,\s]+(-?\d+\.?\d*)\s*°?\s*([EW])/i;
    const degMatch = locationString.match(degRegex);
    if (degMatch) {
      let lat = parseFloat(degMatch[1]);
      let lng = parseFloat(degMatch[3]);
      if (degMatch[2].toUpperCase() === "S") lat = -lat;
      if (degMatch[4].toUpperCase() === "W") lng = -lng;
      if (isValidSriLankaCoordinate(lat, lng)) {
        return { lat, lng };
      }
    }
    const decRegex = /(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)/;
    const decMatch = locationString.match(decRegex);
    if (decMatch) {
      const lat = parseFloat(decMatch[1]);
      const lng = parseFloat(decMatch[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng) && isValidSriLankaCoordinate(lat, lng)) {
        return { lat, lng };
      }
    }
    return null;
  } catch (error) {
    console.error("Error parsing location:", error);
    return null;
  }
};

// Severity colour palette
const severityConfig = {
  CRITICAL: { bg: "#dc2626", text: "#fff", dot: "#dc2626", border: "#fca5a5", glassBg: "rgba(220,38,38,0.18)", glassBorder: "rgba(220,38,38,0.35)", titleColor: "#991b1b", subColor: "#b91c1c" },
  HIGH: { bg: "#ea580c", text: "#fff", dot: "#ea580c", border: "#fdba74", glassBg: "rgba(234,88,12,0.18)", glassBorder: "rgba(234,88,12,0.35)", titleColor: "#9a3412", subColor: "#c2410c" },
  MODERATE: { bg: "#eab308", text: "#422006", dot: "#eab308", border: "#fde047", glassBg: "rgba(234,179,8,0.18)", glassBorder: "rgba(234,179,8,0.35)", titleColor: "#854d0e", subColor: "#a16207" },
  LOW: { bg: "#16a34a", text: "#fff", dot: "#16a34a", border: "#86efac", glassBg: "rgba(22,163,74,0.15)", glassBorder: "rgba(22,163,74,0.30)", titleColor: "#166534", subColor: "#15803d" },
};
const defaultSeverity = { bg: "#6b7280", text: "#fff", dot: "#6b7280", border: "#d1d5db", glassBg: "rgba(107,114,128,0.12)", glassBorder: "rgba(107,114,128,0.25)", titleColor: "#374151", subColor: "#6b7280" };

const getSeverityStyle = (label) => severityConfig[label] || defaultSeverity;

// Auto-fit bounds
const FitBounds = ({ locations }) => {
  const map = useMap();

  useEffect(() => {
    if (!locations || locations.length === 0) return;

    try {
      const latLngs = locations
        .filter((loc) => Number.isFinite(loc.lat) && Number.isFinite(loc.lng))
        .map((loc) => [loc.lat, loc.lng]);

      if (latLngs.length === 0) return;

      const bounds = L.latLngBounds(latLngs);

      if (bounds.isValid()) {
        map.fitBounds(bounds, {
          padding: [50, 50],
          maxZoom: 13,
          animate: true,
        });
      }
    } catch (err) {
      console.error("Error fitting map bounds:", err);
    }
  }, [locations, map]);

  return null;
};

const FarmMap = () => {
  const { theme, setTheme } = useTheme();
  const [farms, setFarms] = useState([]);
  const [selectedFarm, setSelectedFarm] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [validLocations, setValidLocations] = useState([]);
  const [farmReportData, setFarmReportData] = useState({}); // { farmName: { label, value, issue } }

  // Sync with system theme changes
  useEffect(() => {
    const darkModeQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleThemeChange = (e) => setTheme(e.matches ? "dark" : "light");
    darkModeQuery.addEventListener("change", handleThemeChange);
    return () => darkModeQuery.removeEventListener("change", handleThemeChange);
  }, [setTheme]);

  // Load farms + reports
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch farms and reports in parallel
        const [farmResponse, reportsResponse] = await Promise.all([
          farmService.getUserFarms(),
          API.get("/reports").catch(() => ({ data: { data: [] } })),
        ]);

        const allFarms = farmResponse.farms || [];
        setFarms(allFarms);

        const validLocs = allFarms
          .map((farm) => {
            const coords = parseLocation(farm.location);
            return coords ? { ...farm, ...coords } : null;
          })
          .filter((farm) => farm !== null);

        setValidLocations(validLocs);

        // Build per-farm severity summary from reports
        const reports = reportsResponse.data?.data || reportsResponse.data || [];
        const farmMap = {};

        for (const report of reports) {
          const name = report.farm;
          if (!name || !report.severity) continue;

          const existing = farmMap[name];
          // Keep the worst (highest) severity per farm
          if (!existing || (report.severity.value > existing.value)) {
            farmMap[name] = {
              label: report.severity.label,
              value: report.severity.value,
              issue: report.issue || "No issue noted",
            };
          }
        }

        setFarmReportData(farmMap);
      } catch (err) {
        console.error("Error loading farms:", err);
        setError("Failed to load farms. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // Listen for live farm updates
  useEffect(() => {
    const onFarmsUpdated = (e) => {
      try {
        const incoming = e?.detail;
        if (!incoming) return;

        setFarms((prev) => {
          const exists = prev.find((f) => f._id === incoming._id);
          if (exists) return prev.map((f) => (f._id === incoming._id ? incoming : f));
          return [...prev, incoming];
        });

        const coords = parseLocation(incoming.location);
        if (coords) {
          setValidLocations((prev) => {
            const exists = prev.find((f) => f._id === incoming._id);
            if (exists) return prev.map((f) => (f._id === incoming._id ? { ...incoming, ...coords } : f));
            return [...prev, { ...incoming, ...coords }];
          });
        }
      } catch (err) {
        console.error("Error handling farmsUpdated event", err);
      }
    };

    window.addEventListener("farmsUpdated", onFarmsUpdated);
    return () => window.removeEventListener("farmsUpdated", onFarmsUpdated);
  }, []);

  // Build custom marker icon with status badge
  const buildMarkerIcon = (farm) => {
    const reportInfo = farmReportData[farm.name];
    const sevLabel = reportInfo?.label || null;
    const style = getSeverityStyle(sevLabel);

    const badgeHtml = sevLabel
      ? `<div style="
          position:absolute;
          left:50%;
          transform:translateX(-50%);
          top:18px;
          white-space:nowrap;
          background:${style.bg};
          color:${style.text};
          font-size:9px;
          font-weight:700;
          padding:1px 5px;
          border-radius:6px;
          letter-spacing:0.3px;
          box-shadow:0 1px 3px rgba(0,0,0,.35);
          pointer-events:none;
        ">${sevLabel}</div>`
      : "";

    return L.divIcon({
      className: "custom-marker-with-badge",
      iconSize: [14, 14],
      iconAnchor: [7, 7],
      popupAnchor: [0, -10],
      tooltipAnchor: [10, 0],
      html: `
        <div style="position:relative;width:14px;height:14px;">
          <div style="
            background:${style.dot};
            width:14px;
            height:14px;
            border-radius:50%;
            border:2px solid white;
            box-shadow:0 0 6px rgba(0,0,0,.45);
          "></div>
          ${badgeHtml}
        </div>
      `,
    });
  };

  // Build tooltip content for hover
  const buildTooltipContent = (farm) => {
    const reportInfo = farmReportData[farm.name];
    const style = reportInfo ? getSeverityStyle(reportInfo.label) : defaultSeverity;
    const sevLabel = reportInfo?.label || "N/A";
    const sevValue = reportInfo?.value != null ? `${reportInfo.value}%` : "—";
    const issue = reportInfo?.issue || "No reports";

    return `
      <div style="
        min-width:170px;
        font-family:system-ui,sans-serif;
        background:${style.glassBg};
        backdrop-filter:blur(12px);
        -webkit-backdrop-filter:blur(12px);
        border:1.5px solid ${style.glassBorder};
        border-radius:12px;
        padding:10px 14px;
      ">
        <div style="font-weight:700;font-size:13px;margin-bottom:5px;color:${style.titleColor};">${farm.name}</div>
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
          <span style="
            display:inline-block;
            background:${style.bg};
            color:${style.text};
            font-size:10px;
            font-weight:700;
            padding:2px 8px;
            border-radius:8px;
            box-shadow:0 1px 3px rgba(0,0,0,.15);
          ">${sevLabel}</span>
          <span style="font-size:12px;font-weight:600;color:${style.subColor};">${sevValue}</span>
        </div>
        <div style="font-size:11px;color:${style.subColor};border-top:1px solid ${style.glassBorder};padding-top:4px;margin-top:3px;">
          ${issue}
        </div>
      </div>
    `;
  };

  // Default center Sri Lanka
  const SRI_LANKA_CENTER = [7.8731, 80.7718];
  const defaultCenter =
    validLocations.length > 0
      ? validLocations
        .filter((loc) => Number.isFinite(loc.lat) && Number.isFinite(loc.lng))
        .map((loc) => [loc.lat, loc.lng])[0] || SRI_LANKA_CENTER
      : SRI_LANKA_CENTER;

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      {/* Loading */}
      {isLoading && (
        <div
          className="absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center z-50"
          style={{
            backgroundColor: theme === "dark" ? "rgba(20,20,20,0.8)" : "rgba(243,244,246,0.8)",
          }}
        >
          <div className="text-center">
            <Loader size={48} className="animate-spin mx-auto mb-4 text-green-500" />
            <p style={{ color: theme === "dark" ? "#d0d0d0" : "#374151" }}>Loading farms...</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          className="absolute top-4 left-4 right-4 p-4 rounded-lg flex items-center gap-3 z-50"
          style={{
            backgroundColor: theme === "dark" ? "#7f1d1d" : "#fee2e2",
            border: `1px solid ${theme === "dark" ? "#991b1b" : "#fecaca"}`,
            color: theme === "dark" ? "#fca5a5" : "#dc2626",
          }}
        >
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {/* Empty state */}
      {validLocations.length === 0 && !isLoading && !error && (
        <div
          className="absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center z-10"
          style={{
            backgroundColor: theme === "dark" ? "rgba(20,20,20,0.5)" : "rgba(249,250,251,0.5)",
          }}
        >
          <div className="text-center">
            <p className="text-lg" style={{ color: theme === "dark" ? "#a0a0a0" : "#4b5563" }}>
              No farms with location data
            </p>
            <p className="text-sm mt-2" style={{ color: theme === "dark" ? "#808080" : "#6b7280" }}>
              Add farms with location information to see them on the map
            </p>
          </div>
        </div>
      )}

      {/* Map */}
      <MapContainer
        center={defaultCenter}
        zoom={validLocations.length > 0 ? 10 : 7}
        minZoom={6}
        maxZoom={18}
        style={{ width: "100%", height: "100%" }}
      >
        {/* Tile Layer */}
        <TileLayer
          key={`tile-${theme}`}
          attribution={
            theme === "dark"
              ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors & <a href="https://carto.com/aboutcarto/">CARTO</a>'
              : 'Tiles © Esri'
          }
          url={
            theme === "dark"
              ? "https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png"
              : "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"
          }
        />

        {/* Markers with Tooltip + Popup */}
        {validLocations.map((farm) => (
          <Marker
            key={farm._id}
            position={[farm.lat, farm.lng]}
            eventHandlers={{ click: () => setSelectedFarm(farm) }}
            icon={buildMarkerIcon(farm)}
          >
            {/* Hover tooltip */}
            <Tooltip
              direction="right"
              offset={[12, 0]}
              opacity={0.95}
              className="farm-tooltip-custom"
            >
              <div dangerouslySetInnerHTML={{ __html: buildTooltipContent(farm) }} />
            </Tooltip>
          </Marker>
        ))}

        {/* Click Popup */}
        {selectedFarm && (
          <Popup
            position={[selectedFarm.lat, selectedFarm.lng]}
            onClose={() => setSelectedFarm(null)}
          >
            <div
              className="text-sm max-w-xs"
              style={{
                backgroundColor: theme === "dark" ? "#2a2a2a" : "#ffffff",
                color: theme === "dark" ? "#e0e0e0" : "#1a1a1a",
              }}
            >
              <p
                className="font-semibold"
                style={{ color: theme === "dark" ? "#22c55e" : "#000000" }}
              >
                {selectedFarm.name}
              </p>
              {selectedFarm.subtitle && (
                <p
                  className="text-xs mt-1"
                  style={{ color: theme === "dark" ? "#b0b0b0" : "#666666" }}
                >
                  {selectedFarm.subtitle}
                </p>
              )}
              <p className="mt-2">
                <span className="font-medium">Area:</span> {selectedFarm.area}
              </p>
              {(() => {
                const info = farmReportData[selectedFarm.name];
                if (!info) return null;
                const s = getSeverityStyle(info.label);
                return (
                  <>
                    <p className="mt-1">
                      <span className="font-medium">Severity:</span>{" "}
                      <span style={{ color: s.dot, fontWeight: 700 }}>
                        {info.label} ({info.value}%)
                      </span>
                    </p>
                    <p className="mt-1">
                      <span className="font-medium">Issue:</span> {info.issue}
                    </p>
                  </>
                );
              })()}
              <p className="mt-1 capitalize">
                <span className="font-medium">Status:</span>{" "}
                <span style={{ fontWeight: 600 }}>
                  {selectedFarm.status}
                </span>
              </p>
              {selectedFarm.description && (
                <p className="mt-2 text-xs" style={{ color: theme === "dark" ? "#a0a0a0" : "#666666" }}>
                  {selectedFarm.description}
                </p>
              )}
            </div>
          </Popup>
        )}

        {/* Fit bounds */}
        {validLocations.length > 0 && <FitBounds locations={validLocations} />}
      </MapContainer>

      {/* Custom tooltip styles — transparent wrapper so inner glass bg shows */}
      <style>{`
        .farm-tooltip-custom {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
        }
        .farm-tooltip-custom::before {
          display: none !important;
        }
        .farm-tooltip-custom .leaflet-tooltip-content-wrapper {
          background: transparent !important;
          border: none !important;
          border-radius: 0 !important;
          padding: 0 !important;
          box-shadow: none !important;
        }
        .farm-tooltip-custom > div {
          box-shadow: 0 4px 20px rgba(0,0,0,.18);
        }
        .custom-marker-with-badge {
          background: none !important;
          border: none !important;
        }
      `}</style>
    </div>
  );
};

export default FarmMap;
