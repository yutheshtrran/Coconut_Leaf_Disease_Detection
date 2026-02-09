import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { useState, useEffect } from "react";
import { Loader, AlertCircle } from "lucide-react";
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

// Utility function to parse location string "lat° N/S, lng° E/W"
const parseLocation = (locationString) => {
  if (!locationString) return null;
  
  try {
    // Match pattern like "7.29° N, 80.64° E"
    const regex = /(-?\d+\.?\d*)\s*°\s*([NS]),\s*(-?\d+\.?\d*)\s*°\s*([EW])/;
    const match = locationString.match(regex);
    
    if (!match) return null;
    
    let lat = parseFloat(match[1]);
    let lng = parseFloat(match[3]);
    
    // Adjust for South latitude
    if (match[2] === 'S') lat = -lat;
    // Adjust for West longitude
    if (match[4] === 'W') lng = -lng;
    
    return { lat, lng };
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

// Component to auto-fit map bounds
const FitBounds = ({ locations }) => {
  const map = useMap();

  useEffect(() => {
    if (locations.length === 0) return;
    const bounds = L.latLngBounds(locations.map((loc) => [loc.lat, loc.lng]));
    map.fitBounds(bounds, { padding: [50, 50] });
  }, [locations, map]);

  return null;
};

const FarmMap = () => {
  const [farms, setFarms] = useState([]);
  const [selectedFarm, setSelectedFarm] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [validLocations, setValidLocations] = useState([]);

  useEffect(() => {
    const loadFarms = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await farmService.getUserFarms();
        
        if (response.farms && response.farms.length > 0) {
          setFarms(response.farms);
          
          // Parse and filter farms with valid coordinates
          const validLocs = response.farms
            .map(farm => {
              const coords = parseLocation(farm.location);
              return coords ? { ...farm, ...coords } : null;
            })
            .filter(farm => farm !== null);
          
          setValidLocations(validLocs);
        } else {
          setFarms([]);
          setValidLocations([]);
        }
      } catch (err) {
        console.error('Error loading farms:', err);
        setError('Failed to load farms. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    loadFarms();
  }, []);

  // Default center for map (Sri Lanka's approximate center)
  const defaultCenter = validLocations.length > 0 
    ? [validLocations[0].lat, validLocations[0].lng]
    : [7.8731, 80.7718];

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      {isLoading && (
        <div className="absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center bg-gray-100/80 z-50">
          <div className="text-center">
            <Loader size={48} className="animate-spin mx-auto mb-4 text-green-600" />
            <p className="text-gray-700">Loading farms...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute top-4 left-4 right-4 bg-red-100 border border-red-400 text-red-700 p-4 rounded-lg flex items-center gap-3 z-50">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {validLocations.length === 0 && !isLoading && !error && (
        <div className="absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center bg-gray-50 z-10">
          <div className="text-center">
            <p className="text-gray-600 text-lg">No farms with location data</p>
            <p className="text-gray-500 text-sm mt-2">Add farms with location information to see them on the map</p>
          </div>
        </div>
      )}

      <MapContainer
        center={defaultCenter}
        zoom={12}
        style={{ width: "100%", height: "100%" }}
      >
        {/* Free vegetation-friendly ESRI map */}
        <TileLayer
          attribution="Tiles © Esri"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"
        />

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

        {selectedFarm && (
          <Popup
            position={[selectedFarm.lat, selectedFarm.lng]}
            onClose={() => setSelectedFarm(null)}
          >
            <div className="text-sm max-w-xs">
              <p className="font-semibold text-gray-900">{selectedFarm.name}</p>
              {selectedFarm.subtitle && (
                <p className="text-gray-600 text-xs mt-1">{selectedFarm.subtitle}</p>
              )}
              <p className="mt-2 text-gray-700">
                <span className="font-medium">Area:</span> {selectedFarm.area}
              </p>
              <p className="mt-1 capitalize text-gray-700">
                <span className="font-medium">Status:</span>{" "}
                <span
                  style={{
                    color: markerColor[selectedFarm.status] || "blue",
                    fontWeight: 600,
                  }}
                >
                  {selectedFarm.status}
                </span>
              </p>
              {selectedFarm.description && (
                <p className="mt-2 text-gray-600 text-xs">{selectedFarm.description}</p>
              )}
            </div>
          </Popup>
        )}

        {/* Auto-fit map bounds to show all farms */}
        {validLocations.length > 0 && <FitBounds locations={validLocations} />}
      </MapContainer>
    </div>
  );
};

export default FarmMap;
