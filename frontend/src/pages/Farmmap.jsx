import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { useState, useEffect } from "react";
import { Loader, AlertCircle } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import * as farmService from "../services/farmService";

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

// Utility function to parse location strings in multiple common formats:
// - "6.8897° N, 81.7890° E"
// - "6.8897, 81.7890" (plain decimal comma-separated)
// - "6.8897 81.7890" (space-separated)
const parseLocation = (locationString) => {
  if (!locationString) return null;
  try {
    // Try degree format first: "6.8897° N, 81.7890° E"
    const degRegex = /(-?\d+\.?\d*)\s*°?\s*([NS])[,\s]+(-?\d+\.?\d*)\s*°?\s*([EW])/i;
    const degMatch = locationString.match(degRegex);
    if (degMatch) {
      let lat = parseFloat(degMatch[1]);
      let lng = parseFloat(degMatch[3]);
      if (degMatch[2].toUpperCase() === 'S') lat = -lat;
      if (degMatch[4].toUpperCase() === 'W') lng = -lng;
      return { lat, lng };
    }

    // Try plain decimal comma or space separated: "6.8897, 81.7890" or "6.8897 81.7890"
    const decRegex = /(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)/;
    const decMatch = locationString.match(decRegex);
    if (decMatch) {
      const lat = parseFloat(decMatch[1]);
      const lng = parseFloat(decMatch[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }

    return null;
  } catch (error) {
    console.error('Error parsing location:', error);
    return null;
  }
};

// Marker colors by status
const markerColor = {
  active: "green",
  inactive: "gray",
};

// Component to auto-fit map bounds safely
const FitBounds = ({ locations }) => {
  const map = useMap();

  useEffect(() => {
    if (!locations || locations.length === 0) return;

    try {
      const latLngs = locations
        .filter(
          (loc) => Number.isFinite(loc.lat) && Number.isFinite(loc.lng)
        )
        .map((loc) => [loc.lat, loc.lng]);

      if (latLngs.length === 0) return;

      const bounds = L.latLngBounds(latLngs);

      if (bounds.isValid()) {
        map.fitBounds(bounds, {
          padding: [50, 50],
          maxZoom: 13, // Prevent over-zoom for close farms
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

  // Sync with system theme changes
  useEffect(() => {
    const darkModeQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleThemeChange = (e) => {
      const newTheme = e.matches ? "dark" : "light";
      setTheme(newTheme);
    };

    darkModeQuery.addEventListener("change", handleThemeChange);

    return () => {
      darkModeQuery.removeEventListener("change", handleThemeChange);
    };
  }, [setTheme]);

  useEffect(() => {
    const loadFarms = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await farmService.getUserFarms();

        if (response.farms && response.farms.length > 0) {
          setFarms(response.farms);

          const validLocs = response.farms
            .map((farm) => {
              const coords = parseLocation(farm.location);
              return coords ? { ...farm, ...coords } : null;
            })
            .filter((farm) => farm !== null);

          setValidLocations(validLocs);
        } else {
          setFarms([]);
          setValidLocations([]);
        }
      } catch (err) {
        console.error("Error loading farms:", err);
        setError("Failed to load farms. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    loadFarms();
  }, []);

  // Listen for farms added/updated elsewhere in the app and update map live
  useEffect(() => {
    const onFarmsUpdated = (e) => {
      try {
        const incoming = e?.detail;
        if (!incoming) return;

        // If farm exists, replace it; otherwise append
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
        console.error('Error handling farmsUpdated event', err);
      }
    };

    window.addEventListener('farmsUpdated', onFarmsUpdated);
    return () => window.removeEventListener('farmsUpdated', onFarmsUpdated);
  }, []);

  // Safe default center
  const defaultCenter =
    validLocations.length > 0 &&
    Number.isFinite(validLocations[0].lat) &&
    Number.isFinite(validLocations[0].lng)
      ? [validLocations[0].lat, validLocations[0].lng]
      : [7.8731, 80.7718]; // Sri Lanka center

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      {/* Loading Overlay */}
      {isLoading && (
        <div
          className="absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center z-50"
          style={{
            backgroundColor: theme === "dark" ? "rgba(20, 20, 20, 0.8)" : "rgba(243, 244, 246, 0.8)",
          }}
        >
          <div className="text-center">
            <Loader size={48} className="animate-spin mx-auto mb-4 text-green-500" />
            <p style={{ color: theme === "dark" ? "#d0d0d0" : "#374151" }}>Loading farms...</p>
          </div>
        </div>
      )}

      {/* Error Overlay */}
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

      {/* Empty State */}
      {validLocations.length === 0 && !isLoading && !error && (
        <div
          className="absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center z-10"
          style={{
            backgroundColor: theme === "dark" ? "rgba(20, 20, 20, 0.5)" : "rgba(249, 250, 251, 0.5)",
          }}
        >
          <div className="text-center">
            <p
              className="text-lg"
              style={{ color: theme === "dark" ? "#a0a0a0" : "#4b5563" }}
            >
              No farms with location data
            </p>
            <p
              className="text-sm mt-2"
              style={{ color: theme === "dark" ? "#808080" : "#6b7280" }}
            >
              Add farms with location information to see them on the map
            </p>
          </div>
        </div>
      )}

      {/* Map */}
      <MapContainer
        center={defaultCenter}
        zoom={10}
        minZoom={6} // Prevent zooming out too far
        maxZoom={18}
        style={{ width: "100%", height: "100%" }}
      >
        {/* Tile Layer - Dynamic based on theme */}
        <TileLayer
          key={`tile-${theme}`}
          attribution={theme === "dark" ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors & <a href="https://carto.com/aboutcarto/">CARTO</a>' : 'Tiles © Esri'}
          url={
            theme === "dark"
              ? "https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png"
              : "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"
          }
        />

        {/* Markers */}
        {validLocations.map((farm) => (
          <Marker
            key={farm._id}
            position={[farm.lat, farm.lng]}
            eventHandlers={{
              click: () => setSelectedFarm(farm),
            }}
            icon={L.divIcon({
              className: "custom-marker",
              html: `<div style="
                background:${markerColor[farm.status] || "blue"};
                width:14px;
                height:14px;
                border-radius:50%;
                border:2px solid white;
                box-shadow:0 0 4px rgba(0,0,0,.4);
              "></div>`,
            })}
          />
        ))}

        {/* Popup */}
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
                <p className="text-xs mt-1" style={{ color: theme === "dark" ? "#b0b0b0" : "#666666" }}>
                  {selectedFarm.subtitle}
                </p>
              )}
              <p className="mt-2" style={{ color: theme === "dark" ? "#e0e0e0" : "#1a1a1a" }}>
                <span className="font-medium">Area:</span> {selectedFarm.area}
              </p>
              <p className="mt-1 capitalize" style={{ color: theme === "dark" ? "#e0e0e0" : "#1a1a1a" }}>
                <span className="font-medium">Status:</span>{" "}
                <span
                  style={{
                    color: markerColor[selectedFarm.status] === "active" ? "#22c55e" : "#9ca3af",
                    fontWeight: 600,
                  }}
                >
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

        {/* Auto-fit bounds */}
        {validLocations.length > 0 && <FitBounds locations={validLocations} />}
      </MapContainer>
    </div>
  );
};

export default FarmMap;
